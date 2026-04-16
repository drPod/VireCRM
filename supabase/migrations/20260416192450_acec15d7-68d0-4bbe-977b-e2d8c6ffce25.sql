CREATE OR REPLACE FUNCTION public.reset_domain_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.custom_domain IS DISTINCT FROM OLD.custom_domain THEN
    NEW.domain_verified_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;