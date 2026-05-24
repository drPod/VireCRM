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
        // Supabase v2 reports sign-out failures via `{ error }` on the resolved
        // value rather than throwing in the normal path; the catch below stays
        // for the AuthSessionMissingError edge case that still throws.
        const { error } = await getSupabaseBrowserClient().auth.signOut();
        if (error) {
          captureException(error, { tags: { layer: "auth-logout" } });
        }
      } catch (err) {
        // Remote revocation can also fail in ways that throw (network down,
        // session missing). The SDK has already cleared the local session
        // before throwing, so the user is effectively logged out — surface
        // to Sentry for visibility, then proceed with the redirect.
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
