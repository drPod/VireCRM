import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Terminal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import type { DomainBranding } from "@/components/auth/DomainBrandingProvider";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { friendlyAuthError } from "@/lib/auth-errors";

async function provisionUnderReseller(slug: string, companyName: string) {
  const { data, error } = await supabase.rpc("signup_under_reseller", {
    p_reseller_slug: slug,
    p_company_name: companyName,
  });
  if (error) throw error;
  const result = data as { success: boolean; error?: string } | null;
  if (!result?.success) {
    throw new Error(result?.error || "Failed to create your workspace");
  }
}

/**
 * Branded signup form rendered when a visitor lands on a verified
 * reseller custom domain. Creates an isolated child org under the
 * reseller, applying their branding throughout.
 */
export function BrandedSignup({ branding }: { branding: DomainBranding }) {
  const navigate = useNavigate();
  const brandName = branding.brand_name || "CRM";
  const accentColor = branding.primary_color || undefined;

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const redirectTarget =
    typeof window !== "undefined" ? `${window.location.origin}/?provision=1` : "";

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = fullName.trim();
    const trimmedCompany = companyName.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedCompany || !trimmedEmail || !password) {
      toast.error("Please fill in all fields");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSubmitting(true);
    try {
      sessionStorage.setItem("reseller_pending_company", trimmedCompany);
      sessionStorage.setItem("reseller_pending_slug", branding.slug);
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: { full_name: trimmedName },
          emailRedirectTo: redirectTarget,
        },
      });
      if (error) throw error;
      if (data.session) {
        await provisionUnderReseller(branding.slug, trimmedCompany);
        sessionStorage.removeItem("reseller_pending_company");
        sessionStorage.removeItem("reseller_pending_slug");
        toast.success("Workspace ready!");
        navigate({ to: "/dashboard" });
      } else {
        navigate({ to: "/confirm-email" });
      }
    } catch (err) {
      toast.error(friendlyAuthError(err, "Signup failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignup = async () => {
    const trimmedCompany = companyName.trim();
    if (!trimmedCompany) {
      toast.error("Please enter your company name first");
      return;
    }
    sessionStorage.setItem("reseller_pending_company", trimmedCompany);
    sessionStorage.setItem("reseller_pending_slug", branding.slug);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: redirectTarget,
    });
    if (result.error) {
      toast.error(friendlyAuthError(result.error, "Google sign-in failed"));
      return;
    }
    if (result.redirected) return;
    try {
      await provisionUnderReseller(branding.slug, trimmedCompany);
      sessionStorage.removeItem("reseller_pending_company");
      sessionStorage.removeItem("reseller_pending_slug");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(friendlyAuthError(err, "Setup failed"));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          {branding.logo_url ? (
            <img
              src={branding.logo_url}
              alt={brandName}
              className="mx-auto mb-4 h-12 w-12 rounded-xl object-contain"
            />
          ) : (
            <div
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: accentColor || "hsl(var(--primary))" }}
            >
              <Terminal className="h-6 w-6 text-white" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-foreground">Get started with {brandName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create your workspace in seconds</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={handleGoogleSignup}
          >
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
            <label
              htmlFor="brand-name"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Your Name
            </label>
            <input
              id="brand-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              placeholder="Jane Smith"
            />
          </div>
          <div>
            <label
              htmlFor="brand-company"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Company Name
            </label>
            <input
              id="brand-company"
              name="organization"
              type="text"
              autoComplete="organization"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              placeholder="Acme Inc"
            />
          </div>
          <div>
            <label
              htmlFor="brand-email"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Email
            </label>
            <input
              id="brand-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label
              htmlFor="brand-password"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Password
            </label>
            <PasswordInput
              id="brand-password"
              name="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>

          <Button
            type="submit"
            variant="command"
            className="w-full"
            disabled={submitting}
            style={accentColor ? { backgroundColor: accentColor } : undefined}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Workspace
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
  );
}
