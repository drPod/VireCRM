import type { Route } from "./+types/home";

export function meta() {
  return [{ title: "genesisxsx" }];
}

export function loader({ context }: Route.LoaderArgs) {
  return { supabaseUrl: context.cloudflare.env.SUPABASE_URL };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <main style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>genesisxsx</h1>
      <p>Worker up. Supabase: {loaderData.supabaseUrl}</p>
    </main>
  );
}
