import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientEnv } from "./env";

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    const env = clientEnv();
    client = createClient(env.supabaseUrl, env.supabasePublishableKey);
  }
  return client;
}

export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase().auth.getSession();
  return data.session?.access_token ?? null;
}
