// Browser-only fetch helper that attaches the Supabase JWT from the active
// session before calling the Worker API. Returns the raw `Response` — callers
// decide whether to JSON-parse, read text, or surface status codes.
//
// Same-origin only (relative paths). For cross-origin calls add an explicit
// URL string — there is no allowlist here because the SPA only ever talks to
// its own Worker.
import { getSupabaseBrowserClient } from "./supabase.client";

export async function authedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init.headers);
  if (token && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${token}`);
  }

  return fetch(path, { ...init, headers });
}
