import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { friendlyAuthError } from "@/lib/auth-errors";

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
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Enter the email you signed up with");
      return;
    }
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: trimmed,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
      toast.success(`New confirmation link sent to ${trimmed}`);
    } catch (err) {
      toast.error(friendlyAuthError(err, "Couldn't resend confirmation email"));
    } finally {
      setResending(false);
    }
  };

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
            We sent a confirmation link to your inbox. Click it to activate your account and start your free trial.
          </p>

          <form onSubmit={handleResend} className="mt-8 space-y-3 text-left">
            <label htmlFor="resend-email" className="block text-xs font-medium text-muted-foreground">
              Didn't get it? Resend the link:
            </label>
            <input
              id="resend-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
            />
            <Button type="submit" variant="outline" className="w-full" disabled={resending}>
              {resending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Resend confirmation email
            </Button>
            <Button variant="ghost" className="w-full" asChild>
              <Link to="/login">Back to Sign In</Link>
            </Button>
          </form>

          <p className="mt-6 text-xs text-muted-foreground">
            Wrong email?{" "}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              Sign up again
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
