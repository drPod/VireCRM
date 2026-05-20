import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Button } from "@/components/ui/button";
import { Terminal, Loader2, ArrowLeft, Check, X } from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrengthMeter, type PasswordStrengthResult } from "@/components/auth/PasswordStrengthMeter";
import { friendlyAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "Reset Password — VireCRM" },
      { name: "description", content: "Set a new password for your account" },
    ],
  }),
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [score, setScore] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [loading, setLoading] = useState(false);

  const handleStrengthChange = useCallback((result: PasswordStrengthResult) => {
    setScore(result.score);
  }, []);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const navigate = useNavigate();

  const checks = useMemo(
    () => ({
      length: password.length >= 8,
      match: password.length > 0 && password === confirmPassword,
      strength: score >= 2,
    }),
    [password, confirmPassword, score],
  );
  const canSubmit = sessionReady && checks.length && checks.match && checks.strength && !loading;

  // Establish recovery session from URL (hash or query) on mount
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const { data: existing } = await supabase.auth.getSession();
        if (existing.session) {
          if (mounted) setSessionReady(true);
          return;
        }

        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (mounted) setSessionReady(true);
          return;
        }

        if (mounted) {
          setSessionError("This reset link is invalid or has expired. Please request a new one.");
        }
      } catch (err) {
        if (mounted) {
          setSessionError(friendlyAuthError(err, "Could not verify reset link"));
        }
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setSessionReady(true);
        setSessionError(null);
      }
    });

    init();
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionReady) {
      toast.error("Reset link not verified yet — please wait or request a new one");
      return;
    }
    if (!checks.length) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (!checks.match) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password, data: { must_change_password: null } });
      if (error) throw error;
      toast.success("Password updated — taking you in...");
      // Snappier redirect, no artificial delay
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      toast.error(friendlyAuthError(err, "Failed to reset password"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <MarketingHeader />
      <div className="flex flex-1 items-center justify-center px-4 pt-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Terminal className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Set new password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose something memorable but strong
            </p>
          </div>

          {sessionError && (
            <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {sessionError}{" "}
              <Link to="/login" className="font-medium underline">
                Request a new link
              </Link>
            </div>
          )}

          <form onSubmit={handleReset} className="space-y-4">
            {/* Hidden username field helps password managers associate the new credentials */}
            <input type="email" name="username" autoComplete="username" hidden readOnly value="" />

            <div>
              <label
                htmlFor="new-password"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                New Password
              </label>
              <PasswordInput
                id="new-password"
                name="new-password"
                autoComplete="new-password"
                required
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={!sessionReady}
                className="disabled:opacity-50"
              />
              <PasswordStrengthMeter password={password} onChange={handleStrengthChange} />
            </div>
            <div>
              <label
                htmlFor="confirm-password"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Confirm Password
              </label>
              <PasswordInput
                id="confirm-password"
                name="confirm-password"
                autoComplete="new-password"
                required
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={!sessionReady}
                className="disabled:opacity-50"
              />
            </div>

            {(password.length > 0 || confirmPassword.length > 0) && (
              <ul className="space-y-1 text-xs">
                <Requirement met={checks.length} label="At least 8 characters" />
                <Requirement met={checks.match} label="Passwords match" />
                <Requirement met={checks.strength} label="Password must be Fair or stronger" />
              </ul>
            )}

            <Button type="submit" variant="command" className="w-full" disabled={!canSubmit}>
              {(loading || (!sessionReady && !sessionError)) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {!sessionReady && !sessionError ? "Verifying link..." : "Update Password"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link
              to="/login"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <li
      className={`flex items-center gap-1.5 ${met ? "text-foreground" : "text-muted-foreground"}`}
    >
      {met ? <Check className="h-3 w-3 text-primary" /> : <X className="h-3 w-3" />}
      {label}
    </li>
  );
}
