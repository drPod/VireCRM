// Browser-only fetch helper that attaches the Supabase JWT from the active
// session before calling the Worker API. Returns the raw `Response` — callers
// decide whether to JSON-parse, read text, or surface status codes.
//
// Same-origin only. Path must start with `/` — absolute URLs would leak the
// Supabase JWT to a third-party origin, so we hard-fail at the call site.
import { getSupabaseBrowserClient } from "./supabase.client";

export async function authedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!path.startsWith("/")) {
    throw new Error(
      `authedFetch requires a same-origin path beginning with "/"; got "${path}"`,
    );
  }

  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init.headers);
  if (token && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${token}`);
  }

  return fetch(path, { ...init, headers });
}
