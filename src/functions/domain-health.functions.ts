import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { requireAuth } from "@/auth/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PLATFORM_DOMAIN } from "@/config/domains";

export type DomainHealthCheck = "https" | "ssl" | "app_match" | "redirect";

export interface DomainHealthIssue {
  check: DomainHealthCheck;
  severity: "error" | "warning";
  message: string;
  hint?: string;
}

export interface DomainHealthResult {
  hostname: string;
  domainId: string;
  ok: boolean;
  httpsReachable: boolean;
  httpStatus: number | null;
  finalUrl: string | null;
  redirected: boolean;
  servesThisApp: boolean;
  responseMs: number | null;
  fetchedAt: string;
  // SSL is implied by a successful HTTPS fetch; the Workers runtime exposes
  // no cert details, so we surface validity rather than expiry.
  sslValid: boolean;
  issues: DomainHealthIssue[];
}

export interface CheckDomainHealthInput {
  organizationId: string;
}

export interface CheckDomainHealthResponse {
  ok: boolean;
  results: DomainHealthResult[];
}

// Markers we emit in the SSR shell that we look for in the live response to
// confirm the hostname is actually serving this CRM (and not a parked page,
// 404, or a different project on the same proxy).
//
// We accept ANY of these — the published build, the preview shell, or a
// recognisable TanStack Start asset hash all count as "this app".
const APP_FINGERPRINTS = [
  "/_build/assets/", // Vite/TanStack asset prefix
  "data-tanstack-router",
  'id="root"',
  "/__root",
];

async function probeHostname(hostname: string, domainId: string): Promise<DomainHealthResult> {
  const url = `https://${hostname}/`;
  const startedAt = Date.now();
  const issues: DomainHealthIssue[] = [];

  let httpStatus: number | null = null;
  let finalUrl: string | null = null;
  let redirected = false;
  let httpsReachable = false;
  let sslValid = false;
  let servesThisApp = false;
  let body = "";

  try {
    // 8s per-domain timeout so a slow/dead host can't hang the panel.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // Identify ourselves so reseller logs can attribute these probes.
        "User-Agent": `VireCRMHealthCheck/1.0 (+https://${PLATFORM_DOMAIN})`,
        Accept: "text/html,*/*;q=0.5",
      },
    });
    clearTimeout(timer);

    httpsReachable = true;
    sslValid = true; // fetch() over https only resolves on a valid chain
    httpStatus = res.status;
    finalUrl = res.url;
    redirected = res.redirected || (finalUrl !== null && !finalUrl.startsWith(url));

    // Only read up to 64KB — the SSR shell is well under this and we don't
    // want to pull megabytes of HTML through the worker.
    const reader = res.body?.getReader();
    if (reader) {
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (total < 65536) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          total += value.byteLength;
        }
      }
      try {
        await reader.cancel();
      } catch {
        /* noop */
      }
      body = new TextDecoder().decode(
        chunks.length === 1 ? chunks[0] : concatChunks(chunks, total),
      );
    }

    if (res.status >= 500) {
      issues.push({
        check: "https",
        severity: "error",
        message: `Origin returned HTTP ${res.status}`,
        hint: "The hostname resolves but the server is failing. Check that DNS points to this app and not an old origin.",
      });
    } else if (res.status === 404) {
      issues.push({
        check: "https",
        severity: "error",
        message: "Hostname returned 404",
        hint: "DNS reaches a server that doesn't recognise this hostname. Add it as a custom domain on the host.",
      });
    } else if (res.status >= 400) {
      issues.push({
        check: "https",
        severity: "error",
        message: `Origin returned HTTP ${res.status}`,
        hint: "The host accepted the request but rejected it. Check any auth/firewall rules on the upstream.",
      });
    }

    servesThisApp = APP_FINGERPRINTS.some((m) => body.includes(m));
    if (!servesThisApp && res.status < 400) {
      issues.push({
        check: "app_match",
        severity: "warning",
        message: "Responded, but the page doesn't look like this CRM",
        hint: "DNS may be pointing at a parked page, an old project, or a different app. Verify the A/CNAME record matches the one shown in setup.",
      });
    }

    if (redirected && finalUrl) {
      try {
        const finalHost = new URL(finalUrl).hostname.toLowerCase();
        if (finalHost !== hostname.toLowerCase()) {
          issues.push({
            check: "redirect",
            severity: "warning",
            message: `Redirects to ${finalHost}`,
            hint: "The hostname is sending visitors elsewhere. If this is intentional (e.g. www → apex), set the destination as the primary instead.",
          });
        }
      } catch {
        /* ignore URL parse errors */
      }
    }
  } catch (err) {
    httpsReachable = false;
    sslValid = false;
    const msg = err instanceof Error ? err.message : String(err);
    // Best-effort classification of the most common failure modes.
    const isTimeout = /abort|timeout/i.test(msg);
    const isCert = /cert|ssl|tls|self.signed|unable to verify/i.test(msg);
    const isDns = /enotfound|getaddrinfo|dns|name not resolved/i.test(msg);
    if (isCert) {
      issues.push({
        check: "ssl",
        severity: "error",
        message: "SSL certificate is missing or invalid",
        hint: "Issue or renew a certificate for this hostname on your host. If you just pointed DNS, wait a few minutes for cert provisioning.",
      });
    } else if (isDns) {
      issues.push({
        check: "https",
        severity: "error",
        message: "Hostname doesn't resolve",
        hint: "DNS isn't returning an address yet. Double-check the A/CNAME record at your registrar and wait for propagation.",
      });
    } else if (isTimeout) {
      issues.push({
        check: "https",
        severity: "error",
        message: "No HTTPS response within 8s",
        hint: "The host accepted the connection but didn't reply. The origin may be down or behind a firewall.",
      });
    } else {
      issues.push({
        check: "https",
        severity: "error",
        message: `HTTPS request failed: ${msg}`,
        hint: "Check that DNS points at a server that terminates HTTPS for this hostname.",
      });
    }
  }

  const responseMs = Date.now() - startedAt;
  const ok =
    httpsReachable &&
    sslValid &&
    servesThisApp &&
    httpStatus !== null &&
    httpStatus < 400 &&
    issues.every((i) => i.severity !== "error");

  return {
    hostname,
    domainId,
    ok,
    httpsReachable,
    httpStatus,
    finalUrl,
    redirected,
    servesThisApp,
    responseMs,
    fetchedAt: new Date().toISOString(),
    sslValid,
    issues,
  };
}

function concatChunks(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/**
 * Probe every custom hostname for the caller's organization and return a
 * health report (HTTPS reachability, SSL validity, app fingerprint, redirects).
 *
 * Auth: requires a signed-in user; hostnames are loaded with the service-role
 * client AFTER we confirm the caller belongs to the requested org.
 */
export const checkDomainHealth = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown): CheckDomainHealthInput => {
    if (
      !input ||
      typeof input !== "object" ||
      typeof (input as { organizationId?: unknown }).organizationId !== "string"
    ) {
      throw new Error("organizationId is required");
    }
    return { organizationId: (input as { organizationId: string }).organizationId };
  })
  .handler(async ({ data, context }): Promise<CheckDomainHealthResponse> => {
    const admin = supabaseAdmin;
    const userId = context.userId;

    // Confirm the caller is a member of this org before we probe anything.
    const { data: profile } = await admin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile || profile.organization_id !== data.organizationId) {
      setResponseStatus(403);
      throw new Error("Forbidden");
    }

    const { data: domains, error } = await admin
      .from("org_custom_domains")
      .select("id, hostname, verified_at")
      .eq("organization_id", data.organizationId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const verified = (domains ?? []).filter((d) => d.verified_at);
    if (verified.length === 0) {
      return { ok: true, results: [] };
    }

    // Probe in parallel — one slow host shouldn't block the rest.
    const results = await Promise.all(verified.map((d) => probeHostname(d.hostname, d.id)));

    return {
      ok: results.every((r) => r.ok),
      results,
    };
  });
