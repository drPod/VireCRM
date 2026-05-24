import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import type { Route } from "./+types/home";

export function meta() {
  return [{ title: "genesisxsx" }];
}

export function loader({ context }: Route.LoaderArgs) {
  return { supabaseUrl: context.cloudflare.env.SUPABASE_URL };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>genesisxsx</CardTitle>
          <CardDescription>CRM-as-a-service for TX commercial electricity brokers.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Worker up. Supabase:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{loaderData.supabaseUrl}</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
