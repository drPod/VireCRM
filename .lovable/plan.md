## DNS Checklist

A single-page UI that takes a domain, queries DNS over HTTPS in the browser, and shows a clear pass/fail checklist for the records we require — plus a safety panel that warns if the org's email DNS (MX/SPF/DKIM/DMARC) looks broken or missing.

### Route

`src/routes/_app.settings.dns-check.tsx` — accessible from Platform Admin and from the White-Label dialog (new "Run DNS check" link).

### UI sections

**1. Domain input bar**
- Text input + "Check" button
- Optional dropdown: pre-populates from `organizations.custom_domain` for orgs the platform admin manages
- Shows the org's `domain_verification_token` when an org is selected

**2. Required records (must all pass to verify)**

| Check | Expected | Status |
|---|---|---|
| A `@` | `185.158.133.1` | ✅ / ❌ shows actual value |
| A `www` | `185.158.133.1` | ✅ / ❌ |
| TXT `_vireon.<domain>` | matches `vireon-verify-…` token | ✅ / ❌ |
| AAAA `@` | should be **absent** (we don't serve IPv6) | ⚠️ if present |

Each row: label, expected value, actual value(s) found, status pill, copy-to-clipboard for the expected value.

**3. Email safety panel (don't break this)**

Read-only; warns if any look broken so the operator knows IONOS email may be impacted:

- MX records present (warn if zero)
- SPF TXT at `@` present (warn if missing or doesn't include any `include:` mechanism)
- DKIM CNAMEs at `s1-ionos._domainkey` / `s2-ionos._domainkey` resolve (informational — IONOS-specific; we just check if at least one DKIM-style record exists at the common selectors)
- DMARC at `_dmarc.<domain>` present
- Each row says "untouched ✅" / "missing ⚠️" with the actual record values for transparency

**4. Verdict banner**
- All required pass + email panel clean → green "Safe to verify" with a button that calls the existing `mark_domain_verified` RPC
- Required missing → amber "Not ready — fix the items above"
- Email panel has warnings → red "Email DNS may be broken — review before continuing"

### Technical details

- DNS lookups use `https://cloudflare-dns.com/dns-query?name=…&type=…` with `Accept: application/dns-json` (same pattern as `EditClientWhiteLabelDialog.verifyDomain`)
- All checks run client-side in parallel via `Promise.all`
- A small helper `src/lib/dns-check.ts` exports `lookupDns(name, type)` and `runDomainChecklist(domain, token)` returning a typed result the page renders
- Page gated by `usePlatformAdmin` (same gate as other admin tools)
- Add a "Run DNS check" link in `EditClientWhiteLabelDialog` next to the Verify button that opens this route with `?domain=…&token=…` query params pre-filled
- No backend changes; no migration needed

### Files

- `src/lib/dns-check.ts` — lookup helper + checklist runner (pure, testable)
- `src/routes/_app.settings.dns-check.tsx` — the page
- `src/components/crm/EditClientWhiteLabelDialog.tsx` — add the deep link
- Sidebar entry under Settings → DNS check (platform admin only)

### Out of scope

- No server-side DNS resolver (browser-side DoH is sufficient and matches existing behavior)
- No automatic remediation — this is read-only diagnostics
- No persistence of check results
