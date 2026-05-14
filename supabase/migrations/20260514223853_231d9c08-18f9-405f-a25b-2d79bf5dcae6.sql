-- Enable custom_domain feature flag for Crystal Cameron's Org and set domain to majix.ai
INSERT INTO public.org_features (organization_id, feature_key, enabled)
VALUES ('188c4869-8bc4-438e-b746-c8f28e2932d2', 'custom_domain', true)
ON CONFLICT (organization_id, feature_key) DO UPDATE SET enabled = true;

UPDATE public.organizations
SET custom_domain = 'majix.ai',
    domain_verified_at = NULL
WHERE id = '188c4869-8bc4-438e-b746-c8f28e2932d2';