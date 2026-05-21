/**
 * Email deliverability checks — verifies SPF, DKIM and DMARC DNS records
 * for the organisation's sending domain via Cloudflare DNS-over-HTTPS.
 *
 * Why DoH and not Node `dns`? The Workers runtime that executes server
 * functions does not expose `dns.resolveTxt`. Cloudflare's 1.1.1.1 DoH
 * endpoint speaks plain HTTPS + JSON, which `fetch` handles natively, so
 * this works in dev (Node) and in production (Workers) with one code path.
 *
 * Domain selection priority:
 *   1) `organizations.support_email` (the address replies route to — the
 *      domain shown in the From/Reply-To header)
 *   2) The org's primary custom domain hostname (root domain)
 *
 * We deliberately check the *visible* domain (the one recipients see in
 * From/Reply-To), because that's what mailbox providers grade for SPF
 * alignment and what DMARC pins to. The Lovable-managed `notify.<root>`
 * subdomain has its own DKIM/SPF managed for us — it isn't what trips
 * deliverability for replies and outreach.
 */
import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type DeliverabilityCheck = "spf" | "dkim" | "dmarc";
export type DeliverabilityStatus = "pass" | "warn" | "fail" | "unknown";

export interface DeliverabilityRecord {
  check: DeliverabilityCheck;
  status: DeliverabilityStatus;
  /** Short human-readable headline for the status badge. */
  summary: string;
  /** Longer explanation of what's wrong (or right) and why it matters. */
  detail: string;
  /** The hostname we actually queried (e.g. `_dmarc.example.com`). */
  queried: string;
  /** Raw TXT record string(s) we found, if any. */
  rawRecords: string[];
  /**
   * For DKIM, which selector(s) we tried. Empty for SPF/DMARC.
   * Most providers publish on a known selector — we try the common ones.
   */
  selectorsTried?: string[];
  /** A suggested DNS record to publish to fix the issue. Optional. */
  suggestedRecord?: { type: "TXT"; host: string; value: string };
}

export interface CheckEmailDeliverabilityInput {
  organizationId: string;
}

export interface CheckEmailDeliverabilityResponse {
  ok: boolean;
  domain: string | null;
  /** How we picked the domain — useful for the UI to explain its choice. */
  source: "support_email" | "custom_domain" | "none";
  checkedAt: string;
  records: DeliverabilityRecord[];
  /** True if any check is `fail` (deliverability is at risk). */
  hasCriticalIssue: boolean;
}

// ───────────────────────────────────────────────────────────────────────────
// DNS over HTTPS
// ───────────────────────────────────────────────────────────────────────────

const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";

interface DohAnswer {
  name: string;
  type: number;
  TTL?: number;
  data: string;
}

interface DohResponse {
  Status: number;
  Answer?: DohAnswer[];
}

/**
 * Resolve TXT records for a name. Returns concatenated string per record
 * (Cloudflare gives us each TXT chunk already quoted; we strip quotes and
 * join multi-string TXTs into one logical string per RFC 1035).
 */
async function resolveTxt(name: string): Promise<string[]> {
  try {
    const url = `${DOH_ENDPOINT}?name=${encodeURIComponent(name)}&type=TXT`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/dns-json" },
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const json = (await res.json()) as DohResponse;
    if (json.Status !== 0 || !json.Answer) return [];
    return json.Answer.filter((a) => a.type === 16).map((a) => {
      // TXT data may come as \"v=spf1 ...\" or multiple quoted chunks
      // joined: \"chunk1\" \"chunk2\". Strip outer quotes and join.
      const parts = a.data.match(/"([^"]*)"/g);
      if (parts) return parts.map((p) => p.slice(1, -1)).join("");
      return a.data;
    });
  } catch {
    return [];
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Per-check logic
// ───────────────────────────────────────────────────────────────────────────

async function checkSpf(domain: string): Promise<DeliverabilityRecord> {
  const records = await resolveTxt(domain);
  const spfRecords = records.filter((r) => /^v=spf1\b/i.test(r));

  if (spfRecords.length === 0) {
    return {
      check: "spf",
      status: "fail",
      summary: "No SPF record found",
      detail:
        "Without an SPF record, mailbox providers can't verify which servers are authorised to send for your domain. Outbound mail is far more likely to land in spam or be rejected.",
      queried: domain,
      rawRecords: [],
      suggestedRecord: {
        type: "TXT",
        host: "@",
        value: "v=spf1 include:_spf.google.com include:sendgrid.net ~all",
      },
    };
  }

  if (spfRecords.length > 1) {
    return {
      check: "spf",
      status: "fail",
      summary: "Multiple SPF records — invalid",
      detail:
        "RFC 7208 only allows one SPF record per domain. Mailbox providers will treat your SPF as PermError and ignore it. Merge the includes into a single TXT record.",
      queried: domain,
      rawRecords: spfRecords,
    };
  }

  const spf = spfRecords[0];
  const endsHardFail = /-all\s*$/i.test(spf);
  const endsSoftFail = /~all\s*$/i.test(spf);
  const endsNeutral = /\?all\s*$/i.test(spf);
  const endsPassAll = /\+all\s*$/i.test(spf);

  if (endsPassAll) {
    return {
      check: "spf",
      status: "fail",
      summary: "SPF ends with +all (insecure)",
      detail:
        "`+all` tells the world that any server may send mail as your domain. This makes spoofing trivial. Replace with `~all` (soft-fail) or `-all` (hard-fail).",
      queried: domain,
      rawRecords: spfRecords,
    };
  }

  if (!endsHardFail && !endsSoftFail && !endsNeutral) {
    return {
      check: "spf",
      status: "warn",
      summary: "SPF record missing an `all` mechanism",
      detail:
        "Your SPF doesn't end with `~all`, `-all`, or `?all`. Some receivers will treat it as undefined behaviour. Append `~all` to the end of the record.",
      queried: domain,
      rawRecords: spfRecords,
    };
  }

  return {
    check: "spf",
    status: "pass",
    summary: endsHardFail ? "SPF configured (strict)" : "SPF configured",
    detail:
      "Your SPF record is published and well-formed. Keep the include list to under 10 DNS lookups to stay within the SPF limit.",
    queried: domain,
    rawRecords: spfRecords,
  };
}

const DKIM_SELECTORS = [
  "google", // Google Workspace
  "selector1", // Microsoft 365
  "selector2", // Microsoft 365
  "s1", // SendGrid
  "s2", // SendGrid
  "k1", // Mailchimp
  "mte1", // Mailgun (default)
  "mte2",
  "default", // Postmark / common
  "resend", // Resend
  "krs", // Klaviyo
  "lovable", // Lovable Emails
];

async function checkDkim(domain: string): Promise<DeliverabilityRecord> {
  const triedSelectors: string[] = [];
  let foundOn: string | null = null;
  let foundRecord: string | null = null;

  // Probe in parallel — DoH is cheap and we don't want to serialise 12 calls.
  const probes = await Promise.all(
    DKIM_SELECTORS.map(async (selector) => {
      const host = `${selector}._domainkey.${domain}`;
      triedSelectors.push(selector);
      const records = await resolveTxt(host);
      const dkim = records.find((r) => /(^|;)\s*[vp]\s*=/.test(r));
      return { selector, host, dkim };
    }),
  );

  for (const probe of probes) {
    if (probe.dkim) {
      foundOn = probe.selector;
      foundRecord = probe.dkim;
      break;
    }
  }

  if (!foundRecord) {
    return {
      check: "dkim",
      status: "fail",
      summary: "No DKIM record found",
      detail:
        "We checked the most common DKIM selectors and none of them returned a record. DKIM signs your outbound mail so receivers can verify it wasn't tampered with — without it, DMARC can't pass and deliverability suffers. Publish the DKIM TXT record provided by your email service (Google Workspace, Microsoft 365, SendGrid, etc.).",
      queried: `*._domainkey.${domain}`,
      rawRecords: [],
      selectorsTried: triedSelectors,
    };
  }

  // Sanity-check: the public key (`p=`) must be non-empty.
  const revoked = /(^|;)\s*p\s*=\s*(;|$)/.test(foundRecord);
  if (revoked) {
    return {
      check: "dkim",
      status: "fail",
      summary: `DKIM key on selector "${foundOn}" is revoked`,
      detail:
        "The DKIM record exists but the public key is empty (`p=`). Receivers will treat all signed mail as failing DKIM. Re-publish the key from your email provider.",
      queried: `${foundOn}._domainkey.${domain}`,
      rawRecords: [foundRecord],
      selectorsTried: triedSelectors,
    };
  }

  return {
    check: "dkim",
    status: "pass",
    summary: `DKIM signed via "${foundOn}" selector`,
    detail:
      "Outbound mail signed with this DKIM key will pass authentication. If you send through multiple providers, make sure each one's selector is also published.",
    queried: `${foundOn}._domainkey.${domain}`,
    rawRecords: [foundRecord],
    selectorsTried: triedSelectors,
  };
}

async function checkDmarc(domain: string): Promise<DeliverabilityRecord> {
  const host = `_dmarc.${domain}`;
  const records = await resolveTxt(host);
  const dmarcRecords = records.filter((r) => /^v=DMARC1\b/i.test(r));

  if (dmarcRecords.length === 0) {
    return {
      check: "dmarc",
      status: "fail",
      summary: "No DMARC record found",
      detail:
        "DMARC tells mailbox providers what to do when SPF or DKIM fail and gives you visibility into who's sending mail as your domain. Without it, spoofers can impersonate your brand. Start with a monitor-only policy.",
      queried: host,
      rawRecords: [],
      suggestedRecord: {
        type: "TXT",
        host: "_dmarc",
        value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}; fo=1`,
      },
    };
  }

  if (dmarcRecords.length > 1) {
    return {
      check: "dmarc",
      status: "fail",
      summary: "Multiple DMARC records — invalid",
      detail:
        "Only one DMARC record is allowed per domain. Receivers will ignore your policy entirely. Consolidate into a single TXT record.",
      queried: host,
      rawRecords: dmarcRecords,
    };
  }

  const dmarc = dmarcRecords[0];
  const policyMatch = dmarc.match(/p\s*=\s*(none|quarantine|reject)/i);
  const policy = policyMatch?.[1]?.toLowerCase() ?? null;
  const hasRua = /rua\s*=\s*mailto:/i.test(dmarc);

  if (!policy) {
    return {
      check: "dmarc",
      status: "fail",
      summary: "DMARC record missing `p=` policy",
      detail:
        "Your DMARC record exists but doesn't declare a policy (`p=none`, `p=quarantine`, or `p=reject`). Receivers treat this as no policy at all.",
      queried: host,
      rawRecords: dmarcRecords,
    };
  }

  if (policy === "none" && !hasRua) {
    return {
      check: "dmarc",
      status: "warn",
      summary: "DMARC monitor-only with no reporting address",
      detail:
        "Your policy is `p=none` (monitor-only) but no `rua=` reporting mailbox is set. You're getting no visibility and no enforcement. Add `rua=mailto:dmarc@yourdomain.com` so you can see who's sending as you, then graduate to `p=quarantine`.",
      queried: host,
      rawRecords: dmarcRecords,
    };
  }

  if (policy === "none") {
    return {
      check: "dmarc",
      status: "warn",
      summary: "DMARC in monitor-only mode",
      detail:
        "Your policy is `p=none`, which is the right place to start but doesn't actually protect against spoofing. After a few weeks of clean reports, move to `p=quarantine` and eventually `p=reject`.",
      queried: host,
      rawRecords: dmarcRecords,
    };
  }

  return {
    check: "dmarc",
    status: "pass",
    summary: `DMARC enforced (p=${policy})`,
    detail:
      policy === "reject"
        ? "Strong DMARC policy in place — spoofed mail is rejected outright. This is the gold standard for brand protection."
        : "DMARC is enforcing quarantine on auth failures. Consider moving to `p=reject` once you're confident in your reports.",
    queried: host,
    rawRecords: dmarcRecords,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Domain resolution
// ───────────────────────────────────────────────────────────────────────────

function extractDomainFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at < 0) return null;
  const host = email
    .slice(at + 1)
    .trim()
    .toLowerCase();
  return host || null;
}

function rootDomain(host: string): string {
  // Naive root-domain extraction: keep last two labels for simple TLDs,
  // last three for known compound TLDs (.co.uk, .com.au, etc.). Good enough
  // for the deliverability check — the user can override by setting their
  // business email explicitly.
  const labels = host.split(".").filter(Boolean);
  if (labels.length <= 2) return labels.join(".");
  const last = labels[labels.length - 1];
  const second = labels[labels.length - 2];
  const compound = new Set(["co", "com", "org", "net", "ac", "gov"]);
  if (compound.has(second) && last.length === 2) {
    return labels.slice(-3).join(".");
  }
  return labels.slice(-2).join(".");
}

// ───────────────────────────────────────────────────────────────────────────
// Server function
// ───────────────────────────────────────────────────────────────────────────

export const checkEmailDeliverability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown): CheckEmailDeliverabilityInput => {
    if (
      !input ||
      typeof input !== "object" ||
      typeof (input as { organizationId?: unknown }).organizationId !== "string"
    ) {
      throw new Error("organizationId is required");
    }
    return {
      organizationId: (input as { organizationId: string }).organizationId,
    };
  })
  .handler(async ({ data, context }): Promise<CheckEmailDeliverabilityResponse> => {
    const admin = supabaseAdmin;
    const userId = context.userId;

    // Authorise: caller must belong to the org being inspected.
    const { data: profile } = await admin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile || profile.organization_id !== data.organizationId) {
      setResponseStatus(403);
      throw new Error("Forbidden");
    }

    // Pick the domain to inspect. Prefer the configured business email
    // because that's what recipients see in From/Reply-To.
    const { data: org } = await admin
      .from("organizations")
      .select("id, support_email")
      .eq("id", data.organizationId)
      .maybeSingle();

    let domain = extractDomainFromEmail(org?.support_email);
    let source: CheckEmailDeliverabilityResponse["source"] = domain ? "support_email" : "none";

    if (!domain) {
      // Fallback: the org's primary verified custom domain.
      const { data: customs } = await admin
        .from("org_custom_domains")
        .select("hostname, verified_at, is_primary")
        .eq("organization_id", data.organizationId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });
      const verified = (customs ?? []).find((c) => c.verified_at);
      if (verified) {
        domain = rootDomain(verified.hostname.toLowerCase());
        source = "custom_domain";
      }
    } else {
      domain = rootDomain(domain);
    }

    if (!domain) {
      return {
        ok: true,
        domain: null,
        source: "none",
        checkedAt: new Date().toISOString(),
        records: [],
        hasCriticalIssue: false,
      };
    }

    // Run all three checks in parallel — independent DoH lookups.
    const [spf, dkim, dmarc] = await Promise.all([
      checkSpf(domain),
      checkDkim(domain),
      checkDmarc(domain),
    ]);

    const records = [spf, dkim, dmarc];
    const hasCriticalIssue = records.some((r) => r.status === "fail");

    return {
      ok: true,
      domain,
      source,
      checkedAt: new Date().toISOString(),
      records,
      hasCriticalIssue,
    };
  });
