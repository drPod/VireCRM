import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Button } from "@/components/ui/button";
import { Terminal, Loader2, Mail } from "lucide-react";
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import {
  PasswordStrengthMeter,
  type PasswordStrengthResult,
} from "@/components/auth/PasswordStrengthMeter";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { friendlyAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({
    meta: [
      { title: "Start Free Trial — Vireon" },
      { name: "description", content: "Create your Vireon account and start automating sales in minutes" },
    ],
  }),
});

async function tryAcceptInvite(token: string | undefined) {
  if (!token) return;
  try {
    const { data } = await supabase.rpc("accept_invitation", { p_token: token });
    const result = data as { success: boolean; error?: string } | null;
    if (result?.success) {
      toast.success("Joined the team!");
    } else if (result?.error) {
      toast.error(result.error);
    }
  } catch {
    // non-fatal
  }
}

function SignupPage() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const invite = params?.get("invite") ?? undefined;
  const plan = params?.get("plan") ?? undefined;
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [strength, setStrength] = useState<PasswordStrengthResult>({
    score: 0,
    feedback: "",
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const handleStrengthChange = useCallback(
    (r: PasswordStrengthResult) => setStrength(r),
    [],
  );

  const buildRedirectAfterSignup = () => {
    if (invite) return `${window.location.origin}/accept-invite?token=${invite}`;
    if (plan) return `${window.location.origin}/billing?plan=${encodeURIComponent(plan)}`;
    return `${window.location.origin}/dashboard`;
  };

  const goPostSignup = () => {
    if (invite) {
      window.location.href = `/accept-invite?token=${invite}`;
      return;
    }
    if (plan) {
      navigate({
        to: "/billing",
        search: { plan, required: undefined },
      });
      return;
    }
    navigate({ to: "/dashboard" });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail || !password) {
      toast.error("Please fill in all fields");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (strength.score < 2) {
      toast.error(
        strength.feedback ||
          "Password is too weak. Try a longer phrase or add numbers and symbols.",
      );
      return;
    }
    setLoading(true);
    try {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: { full_name: trimmedName },
          emailRedirectTo: buildRedirectAfterSignup(),
        },
      });
      if (error) throw error;
      if (signUpData.session) {
        await tryAcceptInvite(invite);
        toast.success(plan ? "Account created! Opening checkout..." : "Welcome aboard!");
        goPostSignup();
      } else {
        navigate({ to: "/confirm-email" });
      }
    } catch (err: unknown) {
      toast.error(friendlyAuthError(err, "Signup failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: buildRedirectAfterSignup(),
    });
    if (result.error) {
      toast.error(friendlyAuthError(result.error, "Google sign-in failed"));
      return;
    }
    if (result.redirected) return;
    await tryAcceptInvite(invite);
    goPostSignup();
  };

  return (
    <div className="min-h-screen">
      <MarketingHeader />
      <div className="flex min-h-screen items-center justify-center px-4 pt-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Terminal className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              {invite ? "Join your team" : "Start your free trial"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {invite
                ? "Create your account to accept the invitation"
                : "14 days free. No credit card required."}
            </p>
          </div>

          {invite && (
            <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3 flex gap-2">
              <Mail className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                You&apos;re joining via invitation. Use the email address the invitation was sent to.
              </p>
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <Button type="button" variant="outline" className="w-full gap-2" onClick={handleGoogleSignup}>
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign up with Google
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-xs text-muted-foreground">or</span>
              </div>
            </div>

            <div>
              <label htmlFor="signup-name" className="mb-1.5 block text-sm font-medium text-foreground">Full Name</label>
              <input
                id="signup-name"
                name="name"
                type="text"
                autoComplete="name"
                required
                placeholder="John Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="signup-email" className="mb-1.5 block text-sm font-medium text-foreground">Work Email</label>
              <input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="signup-password" className="mb-1.5 block text-sm font-medium text-foreground">Password</label>
              <PasswordInput
                id="signup-password"
                name="password"
                autoComplete="new-password"
                required
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <PasswordStrengthMeter
                password={password}
                userInputs={[email, fullName].filter(Boolean)}
                onChange={handleStrengthChange}
              />
            </div>

            <Button type="submit" variant="command" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
