# Cloudflare for SaaS — customer custom-domain runbook

This is the operator runbook for getting customer-facing custom hostnames
(e.g. `crm.acmecorp.com`) to resolve through this Worker. The app-side
code in `src/lib/dns-check.ts` + `src/components/crm/CustomerDomainOnboardingDialog.tsx`
already assumes the CF for SaaS topology described here.

## Topology

```
Customer DNS:  crm.acmecorp.com  CNAME  customers.majix.ai
                                         │
                                         ▼
Cloudflare for SaaS (zone: majix.ai)
  • Custom hostname registered via API:
      POST /zones/{zone_id}/custom_hostnames
      body: { "hostname": "crm.acmecorp.com", "ssl": { "method": "txt", "type": "dv" } }
  • Returns ownership_verification TXT + ssl.validation_records TXT,
    surfaced to the customer in the onboarding dialog.
                                         │
                                         ▼
Worker route: customers.majix.ai/*  → this worker
```

The Worker receives the request with `Host: crm.acmecorp.com`. App-side
hostname → org lookup happens server-side; the request is otherwise
identical to a request hitting `genesisxsx.darsh-pod.workers.dev`.

## One-time CF dashboard setup

Required before any custom hostname will resolve:

1. **Pick a fallback hostname.** Default in code: `customers.majix.ai`.
   To use a different name, set `VITE_CF_FALLBACK_HOSTNAME` in `.env`
   (build-time, baked into the Onboarding Dialog).
2. **Create the DNS record** for the fallback hostname in the `majix.ai`
   zone. Any proxied (orange-cloud) `A`/`AAAA`/`CNAME` record works —
   the value is irrelevant since the worker route below intercepts the
   request before the record is fetched. Suggested: `CNAME customers
   majix.ai` (self-loop), proxied.
3. **Enable Cloudflare for SaaS** on the `majix.ai` zone (SSL/TLS →
   Custom Hostnames). Plans:
   - Free/Pro/Biz: pay-as-you-go per custom hostname.
   - Enterprise: included up to a contractual cap.
4. **Designate the fallback origin.** SSL/TLS → Custom Hostnames →
   "Fallback Origin" → set to the hostname created in step 2. Status
   must read **Active**.
5. **Create an API token** (My Profile → API Tokens → Create Token →
   "Custom Token"):
   - Permissions: **Zone → SSL and Certificates → Edit**
   - Zone resources: include `majix.ai` (only this zone)
   - Note the token value — used as `CLOUDFLARE_API_TOKEN`.
6. **Find the zone ID** for `majix.ai` (zone overview page, right
   sidebar). This becomes `CLOUDFLARE_ZONE_ID`.

## Worker config

After steps 1–6, push the worker secrets and uncomment the routes block:

```bash
wrangler secret put CLOUDFLARE_API_TOKEN
wrangler secret put CLOUDFLARE_ZONE_ID
```

Then in `wrangler.jsonc`, uncomment:

```jsonc
"routes": [
  { "pattern": "customers.majix.ai/*", "zone_name": "majix.ai" }
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

The customer-side flow (CNAME + `_majix.<hostname>` TXT in their
registrar) is unchanged from what the Onboarding Dialog already
documents.

## References

- [Cloudflare for SaaS — get started, per-hostname](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/getting-started/per-hostname-setup/)
- [Custom hostname API — POST](https://developers.cloudflare.com/api/operations/custom-hostname-for-a-zone-create-custom-hostname)
- [TXT-based DCV](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/security/certificate-management/issue-and-validate/validate-certificates/txt/)
