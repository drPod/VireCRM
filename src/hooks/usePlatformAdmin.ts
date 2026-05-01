import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

/**
 * Returns whether the signed-in user is a platform super-admin (host).
 *
 * Source of truth is the `platform_admins` table via the
 * `is_platform_admin(uuid)` RPC. The hook is safe for use in route gates,
 * sidebar visibility, and conditional UI — RLS still enforces the same check
 * server-side, so flipping the boolean in DevTools cannot grant access.
 */
export function usePlatformAdmin(): { loading: boolean; isAdmin: boolean } {
  const { user } = useAuth();
  const [state, setState] = useState<{ loading: boolean; isAdmin: boolean }>({
    loading: true,
    isAdmin: false,
  });

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setState({ loading: false, isAdmin: false });
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc("is_platform_admin", {
        p_user_id: user.id,
      });
      if (cancelled) return;
      if (error) {
        // Fail closed — no admin if we can't verify.
        setState({ loading: false, isAdmin: false });
        return;
      }
      setState({ loading: false, isAdmin: Boolean(data) });
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return state;
}
