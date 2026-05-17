/**
 * Browser-side DNS-over-HTTPS lookups via Cloudflare. Same provider used by
 * the white-label verification flow in EditClientWhiteLabelDialog.
 */

export const REQUIRED_A_VALUE = "185.158.133.1";

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

export async function runDomainChecklist(
  domain: string,
  token: string | null,
): Promise<ChecklistResult> {
  const d = domain.trim().toLowerCase();
  const [
    aRoot,
    aWww,
    aaaaRoot,
    txtMajix,
    mx,
    txtRoot,
    dmarc,
    dkim1,
    dkim2,
  ] = await Promise.all([
    lookupDns(d, "A"),
    lookupDns(`www.${d}`, "A"),
    lookupDns(d, "AAAA"),
    lookupDns(`_majix.${d}`, "TXT"),
    lookupDns(d, "MX"),
    lookupDns(d, "TXT"),
    lookupDns(`_dmarc.${d}`, "TXT"),
    lookupDns(`s1-ionos._domainkey.${d}`, "CNAME"),
    lookupDns(`s2-ionos._domainkey.${d}`, "CNAME"),
  ]);

  const tokenMatch = token ? txtMajix.some((r) => r.includes(token)) : txtMajix.length > 0;

  const required: CheckResult[] = [
    {
      id: "a-root",
      label: "A record (root)",
      expected: REQUIRED_A_VALUE,
      actual: aRoot,
      status: aRoot.includes(REQUIRED_A_VALUE) ? "pass" : "fail",
      hint: aRoot.length === 0 ? "No A record found at @" : undefined,
    },
    {
      id: "a-www",
      label: "A record (www)",
      expected: REQUIRED_A_VALUE,
      actual: aWww,
      status: aWww.includes(REQUIRED_A_VALUE) ? "pass" : "fail",
      hint: aWww.length === 0 ? "Missing — www subdomain won't load" : undefined,
    },
    {
      id: "txt-majix",
      label: `TXT _majix.${d}`,
      expected: token ?? "(verification token from CRM)",
      actual: txtMajix,
      status: tokenMatch ? "pass" : "fail",
      hint: !token ? "Open the org's white-label settings to grab the token" : undefined,
    },
    {
      id: "aaaa-root",
      label: "AAAA record (root)",
      expected: "(none — should be removed)",
      actual: aaaaRoot,
      status: aaaaRoot.length === 0 ? "pass" : "warn",
      hint: aaaaRoot.length > 0 ? "Delete the IPv6 record — we don't serve over IPv6" : undefined,
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
