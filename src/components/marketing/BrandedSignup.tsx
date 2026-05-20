import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Terminal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DomainBranding } from "@/components/auth/DomainBrandingProvider";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { GoogleIcon } from "@/components/auth/GoogleIcon";
import { friendlyAuthError } from "@/lib/auth-errors";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<{
    fullName?: string;
    companyName?: string;
    email?: string;
    password?: string;
  }>({});

  const redirectTarget =
    typeof window !== "undefined" ? `${window.location.origin}/?provision=1` : "";

  const validate = () => {
    const next: typeof errors = {};
    const trimmedName = fullName.trim();
    const trimmedCompany = companyName.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) next.fullName = "Please enter your name";
    if (!trimmedCompany) next.companyName = "Please enter your company name";
    if (!trimmedEmail) next.email = "Please enter your email";
    else if (!EMAIL_RE.test(trimmedEmail)) next.email = "That email looks invalid";
    if (!password) next.password = "Please choose a password";
    else if (password.length < 8) next.password = "Use at least 8 characters";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const trimmedName = fullName.trim();
    const trimmedCompany = companyName.trim();
    const trimmedEmail = email.trim();
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
      setErrors((p) => ({ ...p, companyName: "Please enter your company name first" }));
      return;
    }
    setGoogleLoading(true);
    sessionStorage.setItem("reseller_pending_company", trimmedCompany);
    sessionStorage.setItem("reseller_pending_slug", branding.slug);
    try {
      // Supabase handles the browser redirect; control returns here only on
      // error. Reseller provisioning runs post-redirect using the pending
      // company/slug from sessionStorage (see r.$resellerSlug.signup.tsx
      // provision effect).
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectTarget },
      });
      if (error) {
        toast.error(friendlyAuthError(error, "Google sign-in failed"));
        setGoogleLoading(false);
      }
    } catch (err) {
      toast.error(friendlyAuthError(err, "Google sign-in failed"));
      setGoogleLoading(false);
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
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-[0_0_24px_-6px_var(--color-primary)]"
              style={accentColor ? { backgroundColor: accentColor } : undefined}
            >
              <Terminal className="h-6 w-6 text-primary-foreground" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-foreground">Get started with {brandName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create your workspace in seconds</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4" noValidate>
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={handleGoogleSignup}
            disabled={googleLoading || submitting}
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GoogleIcon className="h-4 w-4" />
            )}
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

          <div className="space-y-1.5">
            <Label htmlFor="brand-name">Your Name</Label>
            <Input
              id="brand-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (errors.fullName) setErrors({ ...errors, fullName: undefined });
              }}
              placeholder="Jane Smith"
              aria-invalid={!!errors.fullName}
            />
            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand-company">Company Name</Label>
            <Input
              id="brand-company"
              name="organization"
              type="text"
              autoComplete="organization"
              required
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                if (errors.companyName) setErrors({ ...errors, companyName: undefined });
              }}
              placeholder="Acme Inc"
              aria-invalid={!!errors.companyName}
            />
            {errors.companyName && (
              <p className="text-xs text-destructive">{errors.companyName}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand-email">Email</Label>
            <Input
              id="brand-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors({ ...errors, email: undefined });
              }}
              placeholder="you@company.com"
              aria-invalid={!!errors.email}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand-password">Password</Label>
            <PasswordInput
              id="brand-password"
              name="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors({ ...errors, password: undefined });
              }}
              placeholder="At least 8 characters"
              aria-invalid={!!errors.password}
            />
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>

          <Button
            type="submit"
            variant="default"
            className="w-full"
            disabled={submitting || googleLoading}
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
