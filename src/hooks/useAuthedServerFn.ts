import { useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getServerFnAuthHeaders, handleAuthError } from "@/lib/server-fn-auth";

/**
 * Drop-in replacement for `useServerFn` that auto-attaches the Supabase
 * `Authorization: Bearer <token>` header on every call. Use this for any
 * server function guarded by `requireSupabaseAuth` so call sites can't
 * forget the header.
 *
 * Behavior:
 * - Reads the current Supabase session before every call.
 * - If no session → shows a "Please sign in again" toast, redirects to
 *   `/login`, and throws `SessionExpiredError` (caller doesn't need to
 *   handle it — the redirect already happens).
 * - On 401/403 from the server, re-runs `handleAuthError` so the same
 *   toast/redirect pattern fires uniformly.
 * - Caller-supplied `headers` are merged on top of the auth header so
 *   you can still pass extra headers when needed.
 *
 * Usage:
 *   const findLeads = useAuthedServerFn(findLeadsFn);
 *   const result = await findLeads({ data: { organizationId } });
 */
// We intentionally type the wrapper loosely — TanStack's server-fn types are
// generic over the validator/handler signatures, and re-deriving them here
// adds noise without runtime benefit. The returned function preserves the
// original call signature at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServerFn = (...args: any[]) => Promise<any>;

export function useAuthedServerFn<TFn extends ServerFn>(fn: TFn): TFn {
  const invoke = useServerFn(fn);

  return useCallback(
    async (opts?: Parameters<TFn>[0]) => {
      const authHeaders = await getServerFnAuthHeaders();
      const merged = {
        ...(opts ?? {}),
        headers: {
          ...authHeaders,
          ...((opts as { headers?: Record<string, string> } | undefined)?.headers ?? {}),
        },
      };
      try {
        return await (invoke as ServerFn)(merged);
      } catch (error) {
        // Surface uniform "Please sign in again" UX for 401/403, then rethrow
        // so the caller's own try/catch still runs (e.g. to reset loading state).
        handleAuthError(error);
        throw error;
      }
    },
    [invoke],
  ) as TFn;
}
