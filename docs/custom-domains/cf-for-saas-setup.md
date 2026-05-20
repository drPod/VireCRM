# Cloudflare for SaaS — customer custom-domain runbook

This is the operator runbook for getting customer-facing custom hostnames
(e.g. `crm.acmecorp.com`) to resolve through this Worker. The app-side
code in `src/lib/dns-check.ts` + `src/components/crm/CustomerDomainOnboardingDialog.tsx`
already assumes the CF for SaaS topology described here.

## Topology

```
Customer DNS:  crm.acmecorp.com  CNAME  customers.virecrm.com
                                         │
                                         ▼
Cloudflare for SaaS (zone: virecrm.com)
  • Custom hostname registered via API:
      POST /zones/{zone_id}/custom_hostnames
      body: { "hostname": "crm.acmecorp.com", "ssl": { "method": "txt", "type": "dv" } }
  • Returns ownership_verification TXT + ssl.validation_records TXT,
    surfaced to the customer in the onboarding dialog.
                                         │
                                         ▼
Worker route: customers.virecrm.com/*  → this worker
```

The Worker receives the request with `Host: crm.acmecorp.com`. App-side
hostname → org lookup happens server-side; the request is otherwise
identical to a request hitting `genesisxsx.darsh-pod.workers.dev`.

## One-time CF dashboard setup

Required before any custom hostname will resolve.

1. **Pick a fallback hostname.** Default in code: `customers.virecrm.com`.
   To override, set `VITE_CF_FALLBACK_HOSTNAME` in `.env` (build-time,
   baked into the Onboarding Dialog).
2. **Create the DNS record** for the fallback hostname in the `virecrm.com`
   zone (`customers` A/CNAME record, proxied). Any proxied (orange-cloud)
   `A`/`AAAA`/`CNAME` record works — the value is irrelevant since the
   Worker route intercepts before the record is fetched. Suggested:
   `CNAME customers virecrm.com`, proxied.
3. **Enable Cloudflare for SaaS** on the `virecrm.com` zone
   (SSL/TLS → Custom Hostnames). Plans:
   - Free/Pro/Biz: pay-as-you-go per custom hostname.
   - Enterprise: included up to a contractual cap.
4. **Designate the fallback origin.** SSL/TLS → Custom Hostnames →
   "Fallback Origin" → set to `customers.virecrm.com`. Status must
   read **Active**.
5. **Create an API token** (My Profile → API Tokens → Create Token →
   "Custom Token"):
   - Permissions: **Zone → SSL and Certificates → Edit**
   - Zone resources: include `virecrm.com`.
   - Note the token value — used as `CLOUDFLARE_API_TOKEN`.
6. **Find the zone ID** for `virecrm.com`. This becomes `CLOUDFLARE_ZONE_ID`.

## Worker config

After steps 1–6, push the worker secrets and uncomment the routes block:

```bash
wrangler secret put CLOUDFLARE_API_TOKEN
wrangler secret put CLOUDFLARE_ZONE_ID          # virecrm.com
```

Then in `wrangler.jsonc`, ensure the fallback route is present:

```jsonc
"routes": [
  { "pattern": "customers.virecrm.com/*", "zone_name": "virecrm.com" }
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

The customer-side flow (CNAME + `_virecrm.<hostname>` TXT in their
registrar) is documented in the Onboarding Dialog. The `_virecrm` TXT
prefix is the universal org-agnostic verification token — set by
migration `20260517170000_rebrand_verification_token_prefix.sql`.

## References

- [Cloudflare for SaaS — get started, per-hostname](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/getting-started/per-hostname-setup/)
- [Custom hostname API — POST](https://developers.cloudflare.com/api/operations/custom-hostname-for-a-zone-create-custom-hostname)
- [TXT-based DCV](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/security/certificate-management/issue-and-validate/validate-certificates/txt/)
