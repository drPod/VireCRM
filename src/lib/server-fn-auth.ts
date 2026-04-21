import { supabase } from "@/integrations/supabase/client";

/**
 * Helper used by every UI caller that invokes a server function guarded by
 * `requireSupabaseAuth`. TanStack Start's `useServerFn` does NOT auto-attach
 * the Supabase session JWT, so each invocation must read the current session
 * and forward `Authorization: Bearer <token>` explicitly. Without this, the
 * server middleware rejects the request with a 401 that surfaces in the UI
 * as a generic "Something went wrong".
 */
export async function getServerFnAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("Your session expired. Please sign in again.");
  }
  return { Authorization: `Bearer ${token}` };
}
