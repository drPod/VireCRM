-- Track Cloudflare for SaaS custom-hostname IDs so we can poll status /
-- tear them down without re-fetching by hostname (CF requires the id for
-- GET /zones/{zone_id}/custom_hostnames/{id} and DELETE).
--
-- Two storage locations because the app has two custom-domain paths:
--   1. org_custom_domains — multi-hostname per org, used by CustomDomainsPanel.
--   2. organizations.custom_domain — legacy single-string field, used by
--      the reseller-driven EditClientWhiteLabelDialog flow.
--
-- Provisioning state (ownership_verification TXT, ssl validation_records)
-- is deliberately NOT mirrored — CF is source of truth and we re-fetch on
-- demand via pollCustomHostnameStatus.
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS is idempotent.

ALTER TABLE public.org_custom_domains
  ADD COLUMN IF NOT EXISTS cf_hostname_id text;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS cf_hostname_id text;

-- Speeds up "find me by CF hostname id" lookups (webhooks / cron sweeps).
CREATE INDEX IF NOT EXISTS org_custom_domains_cf_hostname_id_idx
  ON public.org_custom_domains (cf_hostname_id)
  WHERE cf_hostname_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS organizations_cf_hostname_id_idx
  ON public.organizations (cf_hostname_id)
  WHERE cf_hostname_id IS NOT NULL;
