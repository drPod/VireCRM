/**
 * Browser-side DNS-over-HTTPS lookups via Cloudflare. Same provider used by
 * the white-label verification flow in EditClientWhiteLabelDialog.
 *
 * Domain onboarding flow uses Cloudflare for SaaS: customers CNAME their
 * hostname (e.g. `crm.acmecorp.com`) at our SaaS fallback hostname
 * (`customers.virecrm.com`). Cloudflare provisions the TLS cert + routes
 * traffic through to our Worker. The checks below verify:
 *
 *   1. The customer's hostname CNAMEs at our fallback origin.
 *   2. The customer added the `_virecrm.<domain>` TXT we issue (app-level
 *      org binding — separate from CF's `_cf-custom-hostname` ownership
 *      TXT which CF validates on its side).
 *
 * Email-related records (MX/SPF/DKIM/DMARC) are advisory — the customer's
 * mail flow shouldn't change just because they pointed a subdomain at us.
 */

// Stable across customers — change here if the SaaS fallback hostname moves.
// `customers.virecrm.com` is the CF for SaaS fallback hostname.
// `VITE_CF_FALLBACK_HOSTNAME` overrides the default below so the runtime
// target can be flipped without a code change.
export const REQUIRED_CNAME_TARGET =
  (import.meta.env.VITE_CF_FALLBACK_HOSTNAME as string | undefined) ??
  "customers.virecrm.com";

// Prefix for the app-level ownership TXT record tenants must publish.
// e.g. _virecrm.crm.acmecorp.com = virecrm-verify-<token>
export const TXT_VERIFICATION_PREFIX = "_virecrm";
export const TOKEN_PREFIX = "virecrm-verify-";

export type DnsType = "A" | "AAAA" | "TXT" | "MX" | "CNAME";

interface DnsAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

interface DnsResponse {
  Status: number;
  Answer?: DnsAnswer[];
}

export async function lookupDns(name: string, type: DnsType): Promise<string[]> {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
  const res = await fetch(url, { headers: { Accept: "application/dns-json" } });
  if (!res.ok) return [];
  const json = (await res.json()) as DnsResponse;
  return (json.Answer || []).map((a) => a.data.replace(/^"|"$/g, "").replace(/" "/g, ""));
}

export type CheckStatus = "pass" | "fail" | "warn" | "info";

export interface CheckResult {
  id: string;
  label: string;
  expected: string;
  actual: string[];
  status: CheckStatus;
  hint?: string;
}

export interface ChecklistResult {
  required: CheckResult[];
  email: CheckResult[];
  verdict: "ready" | "not-ready" | "email-risk";
}

function normalizeCnameAnswer(value: string): string {
  // DNS-over-HTTPS returns CNAME data with a trailing dot, e.g.
  // "customers.virecrm.com.". Strip so comparisons against the configured
  // target succeed.
  return value.replace(/\.$/, "").toLowerCase();
}

export async function runDomainChecklist(
  domain: string,
  token: string | null,
): Promise<ChecklistResult> {
  const d = domain.trim().toLowerCase();
  const target = REQUIRED_CNAME_TARGET.toLowerCase();
  const [cnameRoot, aRoot, txtVirecrm, mx, txtRoot, dmarc, dkim1, dkim2] = await Promise.all([
    lookupDns(d, "CNAME"),
    lookupDns(d, "A"),
    lookupDns(`${TXT_VERIFICATION_PREFIX}.${d}`, "TXT"),
    lookupDns(d, "MX"),
    lookupDns(d, "TXT"),
    lookupDns(`_dmarc.${d}`, "TXT"),
    lookupDns(`s1-ionos._domainkey.${d}`, "CNAME"),
    lookupDns(`s2-ionos._domainkey.${d}`, "CNAME"),
  ]);

  const cnameMatches = cnameRoot.map(normalizeCnameAnswer).includes(target);
  // Apex/root domains can't legally hold CNAMEs at most registrars; if the
  // customer used the apex they'd need an ALIAS/ANAME or a flattening
  // registrar. Surface that as a hint rather than a bare fail.
  const looksLikeApex = d.split(".").length === 2;
  const tokenMatch = token ? txtVirecrm.some((r) => r.includes(token)) : txtVirecrm.length > 0;

  const required: CheckResult[] = [
    {
      id: "cname",
      label: `CNAME → ${target}`,
      expected: target,
      actual: cnameRoot,
      status: cnameMatches ? "pass" : "fail",
      hint: !cnameMatches
        ? looksLikeApex
          ? `Apex domains can't hold CNAMEs at most registrars. Use a subdomain like crm.${d} or enable ALIAS/ANAME / CNAME flattening.`
          : aRoot.length > 0
            ? "Found an A record at this hostname — replace it with a CNAME pointing at the SaaS host."
            : "No CNAME yet — add one pointing at the SaaS host."
        : undefined,
    },
    {
      id: "txt-virecrm",
      label: `TXT ${TXT_VERIFICATION_PREFIX}.${d}`,
      expected: token ?? "(verification token from CRM)",
      actual: txtVirecrm,
      status: tokenMatch ? "pass" : "fail",
      hint: !token ? "Open the org's white-label settings to grab the token" : undefined,
    },
  ];

  const spf = txtRoot.find((r) => r.toLowerCase().startsWith("v=spf1"));
  const dkimPresent = dkim1.length > 0 || dkim2.length > 0;

  const email: CheckResult[] = [
    {
      id: "mx",
      label: "MX records (mail delivery)",
      expected: "untouched",
      actual: mx,
      status: mx.length > 0 ? "pass" : "warn",
      hint: mx.length === 0 ? "No MX records — incoming email will fail" : undefined,
    },
    {
      id: "spf",
      label: "SPF (TXT v=spf1…)",
      expected: "untouched",
      actual: spf ? [spf] : [],
      status: spf ? "pass" : "warn",
      hint: !spf ? "No SPF record — outgoing email may be marked as spam" : undefined,
    },
    {
      id: "dkim",
      label: "DKIM (s1/s2-ionos._domainkey)",
      expected: "untouched",
      actual: [...dkim1, ...dkim2],
      status: dkimPresent ? "pass" : "info",
      hint: !dkimPresent
        ? "No IONOS DKIM CNAMEs found — only relevant if she sends mail from IONOS"
        : undefined,
    },
    {
      id: "dmarc",
      label: `DMARC (_dmarc.${d})`,
      expected: "untouched",
      actual: dmarc,
      status: dmarc.length > 0 ? "pass" : "warn",
      hint: dmarc.length === 0 ? "No DMARC policy — recommended but not required" : undefined,
    },
  ];

  const allRequiredPass = required.every((r) => r.status === "pass");
  const emailHasFailure = email.some((r) => r.status === "warn");

  let verdict: ChecklistResult["verdict"] = "not-ready";
  if (allRequiredPass && !emailHasFailure) verdict = "ready";
  else if (allRequiredPass && emailHasFailure) verdict = "email-risk";

  return { required, email, verdict };
}
