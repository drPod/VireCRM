import { useEffect } from "react";
import { useNavigate } from "react-router";
import { captureException } from "~/sentry.client";
import { getSupabaseBrowserClient } from "~/lib/supabase.client";

export function meta() {
  return [{ title: "Signing out — genesisxsx" }];
}

export default function Logout() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await getSupabaseBrowserClient().auth.signOut();
      } catch (err) {
        // Remote revocation can fail (network down, token already revoked,
        // upstream Supabase error). The SDK has already cleared the local
        // session before throwing, so the user is effectively logged out —
        // surface to Sentry for visibility, then proceed with the redirect.
        captureException(err, { tags: { layer: "auth-logout" } });
      } finally {
        if (!cancelled) navigate("/login", { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return null;
}
