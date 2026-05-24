import { useEffect } from "react";
import { useNavigate } from "react-router";
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
      } finally {
        // Always redirect, even if signOut errored — local session is the
        // only state we strictly own here, and the SDK clears it before
        // returning regardless of any remote-revocation outcome.
        if (!cancelled) navigate("/login", { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return null;
}
