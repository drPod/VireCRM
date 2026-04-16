import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/confirm-email")({
  component: ConfirmEmailPage,
  head: () => ({
    meta: [
      { title: "Check Your Email — Vireon" },
      { name: "description", content: "Confirm your email address to activate your Vireon account" },
    ],
  }),
});

function ConfirmEmailPage() {
  return (
    <div className="min-h-screen">
      <MarketingHeader />
      <div className="flex min-h-screen items-center justify-center px-4 pt-16">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Check your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a confirmation link to your inbox. Click the link to activate your account and start your free trial.
          </p>
          <div className="mt-8 space-y-3">
            <Button variant="outline" className="w-full" asChild>
              <Link to="/login">Back to Sign In</Link>
            </Button>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Didn't receive the email? Check your spam folder or{" "}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              try again
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
