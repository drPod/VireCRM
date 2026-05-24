import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

/**
 * Placeholder for routes whose Wave-2 wiring (loaders, mutations, real UI)
 * hasn't landed yet. Keeps the sidebar links non-404 during Wave 1 shell work.
 */
export function WaveTwoStub({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description ?? `TODO: Wave 2 — ${title}`}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This view is scaffolded but not yet wired to the Worker API. Loader + table + filters
            land in Wave 2.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
