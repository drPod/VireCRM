import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Terminal, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useDomainBranding } from "@/components/auth/DomainBrandingProvider";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { friendlyAuthError } from "@/lib/auth-errors";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type LoginSearch = { redirect?: string };

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: (search: Record<string, unknown>): LoginSearch => {
    const out: LoginSearch = {};
    // Only accept in-app paths — reject absolute URLs / protocol-relative URLs
    // so a crafted ?redirect=https://evil.example can't hijack the post-login
    // navigation.
    if (
      typeof search.redirect === "string" &&
      search.redirect.startsWith("/") &&
      !search.redirect.startsWith("//")
    ) {
      out.redirect = search.redirect;
    }
    return out;
  },
  head: () => ({
    meta: [
      { title: "Sign In — Majix" },
      {
        name: "description",
        content:
          "Sign in to your Majix CRM workspace to manage leads, track pipeline, and run AI-powered outreach campaigns.",
      },
      { property: "og:title", content: "Sign In — Majix" },
      {
        property: "og:description",
        content:
          "Sign in to your Majix CRM workspace to manage leads, pipeline, and AI outreach.",
      },
      { property: "og:url", content: "https://majix.ai/login" },
    ],
    links: [{ rel: "canonical", href: "https://majix.ai/login" }],
  }),
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const { branding, isCustomDomain } = useDomainBranding();

  const returnTo = redirect ?? "/dashboard";

  // When the OAuth provider sends the user back to /login (e.g. because the
  // app's login URL was registered as the OAuth redirect_uri), the user lands
  // here with an active session and no feedback — making it feel like login
  // failed. Detect that case, show a clear success toast, and forward them on
  // to their intended destination.
  const oauthHandledRef = useRef(false);
  useEffect(() => {
    if (oauthHandledRef.current) return;
    const url = new URL(window.location.href);
    const looksLikeOAuthReturn =
      url.hash.includes("access_token") ||
      url.searchParams.has("code") ||
      url.searchParams.has("provider_token");

    const handle = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      oauthHandledRef.current = true;
      if (looksLikeOAuthReturn) {
        toast.success("Signed in with Google. Redirecting…");
      } else {
        toast.success("Already signed in. Redirecting…");
      }
      // Small delay so the toast is visible before the hard navigation.
      setTimeout(() => {
        window.location.href = returnTo;
      }, 600);
    };
    void handle();
  }, [returnTo]);

  const brandName = branding?.brand_name || "Majix";
  const accentColor = branding?.primary_color;

  const validate = () => {
    const next: typeof errors = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) next.email = "Please enter your email";
    else if (!EMAIL_RE.test(trimmedEmail)) next.email = "That email looks invalid";
    if (!password) next.password = "Please enter your password";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      if (!data.session) {
        // Defensive: should never happen on success, but guard so we never
        // navigate to /dashboard without an active session (which would
        // immediately bounce the user back here).
        throw new Error("Sign-in did not return a session. Please try again.");
      }
      // CRITICAL: wait one tick so AuthProvider's onAuthStateChange listener
      // can fire and fetch profile/role/org BEFORE _app.tsx mounts. Without
      // this, _app.tsx mounts with user=null, the entitlement gate races, and
      // the user is bounced to /billing?required=1 even though sign-in worked.
      await new Promise((r) => setTimeout(r, 50));
      toast.success("Welcome back!");
      // Honor the ?redirect= param set by /_app's auth gate so the user lands
      // back on the page they originally tried to visit. Use window.location
      // instead of navigate() because returnTo may include search params that
      // the typed router won't accept positionally.
      window.location.href = returnTo;
    } catch (err: unknown) {
      toast.error(friendlyAuthError(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (resetSending) return;
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error("Enter your email above first, then tap 'Forgot password?'");
      return;
    }
    setResetSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success(`Reset link sent to ${trimmedEmail}. Check your inbox (and spam folder).`);
    } catch (err: unknown) {
      toast.error(friendlyAuthError(err, "Failed to send reset email"));
    } finally {
      setResetSending(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    // Give the user immediate feedback before the OAuth redirect takes over —
    // otherwise the page just blanks out and it feels like nothing happened.
    toast.loading("Redirecting to Google…", { id: "google-oauth" });
    try {
      // redirectTo must point inside the app. Honor ?redirect= so deep links
      // survive the OAuth round trip; default to /dashboard. Supabase handles
      // the browser redirect — control returns here only on error.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}${returnTo}` },
      });
      if (error) {
        toast.dismiss("google-oauth");
        toast.error(friendlyAuthError(error, "Google sign-in failed"));
        setGoogleLoading(false);
      }
    } catch (err) {
      toast.dismiss("google-oauth");
      toast.error(friendlyAuthError(err, "Google sign-in failed"));
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            {branding?.logo_url ? (
              <img
                src={branding.logo_url}
                alt={brandName}
                className="mx-auto mb-4 h-12 w-12 rounded-xl object-contain"
              />
            ) : (
              <div
                className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-[0_0_24px_-6px_var(--color-primary)]"
                style={accentColor ? { backgroundColor: accentColor } : undefined}
              >
                <Terminal className="h-6 w-6 text-primary-foreground" />
              </div>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sign in to your {brandName} account
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={handleGoogleLogin}
              disabled={googleLoading || loading}
            >
              {googleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              Continue with Google
            </Button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-xs text-muted-foreground">or</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                inputMode="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors({ ...errors, email: undefined });
                }}
                aria-invalid={!!errors.email}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password">Password</Label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetSending}
                  className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                >
                  {resetSending ? "Sending…" : "Forgot password?"}
                </button>
              </div>
              <PasswordInput
                id="login-password"
                name="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors({ ...errors, password: undefined });
                }}
                aria-invalid={!!errors.password}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

            <Button
              type="submit"
              variant="command"
              size="lg"
              className="w-full"
              disabled={loading || googleLoading}
              style={accentColor ? { backgroundColor: accentColor } : undefined}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Don't have an account?{" "}
            {isCustomDomain ? (
              <Link to="/" className="font-medium text-primary hover:underline">
                Sign up
              </Link>
            ) : (
              <Link to="/signup" className="font-medium text-primary hover:underline">
                Start free trial
              </Link>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
