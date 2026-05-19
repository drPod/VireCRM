# Cloudflare for SaaS — customer custom-domain runbook

> **DOMAIN RENAME 2026-05-19:** brand renamed `Majix` → `VireCRM`, primary apex `majix.ai` → `virecrm.com`. **Parallel cutover state:** both `customers.virecrm.com` (primary, default for all new onboarding) AND `customers.majix.ai` (legacy parallel — existing customers continue resolving) are live as CF for SaaS fallback origins. New customer onboarding MUST default to `customers.virecrm.com` per the dialog defaults; only point a customer at `customers.majix.ai` if they already CNAMEd there before the rename. Both fallbacks resolve to the same Worker, which routes by `Host` header.

This is the operator runbook for getting customer-facing custom hostnames
(e.g. `crm.acmecorp.com`) to resolve through this Worker. The app-side
code in `src/lib/dns-check.ts` + `src/components/crm/CustomerDomainOnboardingDialog.tsx`
already assumes the CF for SaaS topology described here.

## Topology

```
Customer DNS:  crm.acmecorp.com  CNAME  customers.virecrm.com  (primary)
                                  CNAME  customers.majix.ai    (legacy parallel)
                                         │
                                         ▼
Cloudflare for SaaS (zones: virecrm.com primary, majix.ai legacy parallel)
  • Custom hostname registered via API on the zone matching the CNAME target:
      POST /zones/{zone_id}/custom_hostnames
      body: { "hostname": "crm.acmecorp.com", "ssl": { "method": "txt", "type": "dv" } }
  • Returns ownership_verification TXT + ssl.validation_records TXT,
    surfaced to the customer in the onboarding dialog.
                                         │
                                         ▼
Worker routes: customers.virecrm.com/*  → this worker  (primary)
               customers.majix.ai/*     → this worker  (legacy parallel)
```

The Worker receives the request with `Host: crm.acmecorp.com`. App-side
hostname → org lookup happens server-side; the request is otherwise
identical to a request hitting `genesisxsx.darsh-pod.workers.dev`.

## One-time CF dashboard setup

Required before any custom hostname will resolve. Steps 1-6 must be done
**twice** — once for the primary `virecrm.com` zone, once for the legacy
`majix.ai` zone — until the legacy parallel is retired. All new customer
onboarding defaults to the `virecrm.com` zone; the `majix.ai` zone is kept
live only to keep pre-rename customer CNAMEs resolving.

1. **Pick a fallback hostname.** Default in code (primary): `customers.virecrm.com`.
   Legacy parallel: `customers.majix.ai`. To override either, set
   `VITE_CF_FALLBACK_HOSTNAME` in `.env` (build-time, baked into the
   Onboarding Dialog — the dialog should default to the primary).
2. **Create the DNS record** for each fallback hostname in its zone
   (`customers` in `virecrm.com`, `customers` in `majix.ai`). Any proxied
   (orange-cloud) `A`/`AAAA`/`CNAME` record works — the value is irrelevant
   since the worker route below intercepts the request before the record is
   fetched. Suggested: `CNAME customers <zone-apex>` (self-loop), proxied.
3. **Enable Cloudflare for SaaS** on each zone (SSL/TLS → Custom Hostnames).
   Plans:
   - Free/Pro/Biz: pay-as-you-go per custom hostname.
   - Enterprise: included up to a contractual cap.
4. **Designate the fallback origin.** SSL/TLS → Custom Hostnames →
   "Fallback Origin" → set to the hostname created in step 2 for that zone.
   Status must read **Active** on both zones.
5. **Create an API token** (My Profile → API Tokens → Create Token →
   "Custom Token"):
   - Permissions: **Zone → SSL and Certificates → Edit**
   - Zone resources: include BOTH `virecrm.com` and `majix.ai` (so the
     server function can manage custom hostnames on whichever zone the
     customer CNAMEd at). A single token scoped to both zones keeps the
     Worker secret count down.
   - Note the token value — used as `CLOUDFLARE_API_TOKEN`.
6. **Find the zone IDs** for both `virecrm.com` (primary) and `majix.ai`
   (legacy parallel). These become `CLOUDFLARE_ZONE_ID` (primary) and
   `CLOUDFLARE_LEGACY_ZONE_ID` (legacy parallel). The server function
   picks the zone based on which fallback hostname the customer's CNAME
   targets.

## Worker config

After steps 1–6, push the worker secrets and uncomment the routes block:

```bash
wrangler secret put CLOUDFLARE_API_TOKEN
wrangler secret put CLOUDFLARE_ZONE_ID          # primary: virecrm.com
wrangler secret put CLOUDFLARE_LEGACY_ZONE_ID   # legacy parallel: majix.ai
```

Then in `wrangler.jsonc`, uncomment both fallback routes (additive — the
legacy row stays until pre-rename customer CNAMEs are migrated):

```jsonc
"routes": [
  { "pattern": "customers.virecrm.com/*", "zone_name": "virecrm.com" },
  { "pattern": "customers.majix.ai/*",    "zone_name": "majix.ai" }
]
```

Deploy via `bun run deploy` (or your normal CI path).

## Per-customer provisioning

Not yet wired into the org admin UI — `EditClientWhiteLabelDialog.tsx`
currently only persists the `custom_domain` string to the org row. The
next chunk of work is:

1. Server function `src/functions/custom-hostnames.functions.ts` that
   calls `POST /zones/{zone_id}/custom_hostnames` on the CF API and
   stores the returned `id`, `ownership_verification`, and SSL
   `validation_records` against the org row.
2. Poll server function that hits `GET /zones/{zone_id}/custom_hostnames/{id}`
   and writes `status` + `ssl.status` back to the org row, used by
   `DomainHealthPanel` to render Verifying / Setting up SSL / Active
   badges.
3. Tear-down server function for when the org clears their custom
   domain.

The customer-side flow (CNAME + `_vire.<hostname>` TXT in their
registrar — `_majix.<hostname>` TXT for the legacy parallel zone) is
unchanged from what the Onboarding Dialog already documents. New
customers default to the `virecrm.com` flow; the `majix.ai` flow is
only used for customers who already pointed their CNAME at
`customers.majix.ai` before the rename.

## References

- [Cloudflare for SaaS — get started, per-hostname](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/getting-started/per-hostname-setup/)
- [Custom hostname API — POST](https://developers.cloudflare.com/api/operations/custom-hostname-for-a-zone-create-custom-hostname)
- [TXT-based DCV](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/security/certificate-management/issue-and-validate/validate-certificates/txt/)
