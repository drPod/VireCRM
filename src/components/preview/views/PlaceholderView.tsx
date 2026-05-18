import { Link } from "@tanstack/react-router";
import { ArrowRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const PLACEHOLDER_BODY: Record<string, string> = {
  Payouts:
    "Payouts is a full feature in the real CRM — track pending balances, initiate transfers, and manage recipients. It lives behind authenticated workspaces with verified banking. Start a free trial to unlock it.",
  Expenses:
    "Expenses is a full feature in the real CRM — log spend, categorize entries, and reconcile against revenue. It lives behind authenticated workspaces with audit history. Start a free trial to unlock it.",
  Billing:
    "Billing is a full feature in the real CRM — plan management, invoice history, and payment methods. It lives behind authenticated workspaces. Start a free trial to unlock it.",
};

export function PlaceholderView({ label }: { label: string }) {
  const body =
    PLACEHOLDER_BODY[label] ??
    `${label} is a full feature in the real CRM. It lives behind authenticated workspaces. Start a free trial to unlock it.`;
  return (
    <Card
      data-tour="placeholder"
      className="flex flex-col items-center justify-center gap-4 p-12 text-center scroll-mt-24"
    >
      <div className="rounded-full bg-primary/10 p-4 text-primary">
        <Lock className="h-6 w-6" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">Sign up to access {label}</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
      </div>
      <div className="flex gap-2">
        <Button asChild variant="outline" data-preview-allow="true">
          <Link to="/pricing" data-preview-allow="true">
            See pricing
          </Link>
        </Button>
        <Button asChild variant="command" className="gap-2" data-preview-allow="true">
          <Link to="/signup" data-preview-allow="true">
            Start free trial
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
