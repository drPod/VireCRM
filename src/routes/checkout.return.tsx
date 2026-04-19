import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/checkout/return")({
  component: CheckoutReturnPage,
  validateSearch: (search: Record<string, unknown>) => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({
    meta: [{ title: "Payment complete — Vireon" }],
  }),
});

function CheckoutReturnPage() {
  const { session_id } = Route.useSearch();

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center rounded-2xl border border-border bg-card p-8">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-6 w-6 text-success" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Payment complete</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Thanks — your subscription is being activated. You'll see access in a
          few seconds.
        </p>
        {session_id && (
          <p className="mt-3 text-[10px] font-mono text-muted-foreground/60 break-all">
            Session: {session_id}
          </p>
        )}
        <Link to="/dashboard">
          <Button variant="command" className="mt-6 gap-2">
            Go to dashboard
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
