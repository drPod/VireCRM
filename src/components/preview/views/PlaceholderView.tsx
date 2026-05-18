import { Link } from "@tanstack/react-router";
import { ArrowRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function PlaceholderView({ label }: { label: string }) {
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
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {label} is a full feature in the real CRM — billing, plan management, and account settings
          live behind authenticated workspaces. Start a free trial to unlock it.
        </p>
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
