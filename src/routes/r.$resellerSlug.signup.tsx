import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Terminal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { TermsCheckbox } from "@/components/auth/TermsCheckbox";
import { toast } from "sonner";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Route = createFileRoute("/r/$resellerSlug/signup")({
  component: ResellerSignupPage,
  head: () => ({
    meta: [{ title: "Sign up" }, { name: "description", content: "Create your account" }],
  }),
});

interface ResellerBranding {
  id: string;
  slug: string;
  brand_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  is_reseller: boolean;
}

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

function ResellerSignupPage() {
  const { resellerSlug } = Route.useParams();
  const navigate = useNavigate();
  const [branding, setBranding] = useState<ResellerBranding | null>(null);
  const [brandingLoading, setBrandingLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<{
    fullName?: string;
    companyName?: string;
    email?: string;
    password?: string;
  }>({});

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.rpc("get_reseller_branding", {
        p_slug: resellerSlug,
      });
      const b = data as ResellerBranding | null;
      if (!b || !b.is_reseller) {
        setNotFound(true);
      } else {
        setBranding(b);
      }
      setBrandingLoading(false);
    })();
  }, [resellerSlug]);

  const brandName = branding?.brand_name || "CRM";
  const accentColor = branding?.primary_color || undefined;

  const redirectTarget =
    typeof window !== "undefined"
      ? `${window.location.origin}/r/${resellerSlug}/signup?provision=1`
      : "";

  // After email-confirm or OAuth callback, finish provisioning
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("provision") !== "1") return;
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const pendingCompany =
        sessionStorage.getItem("reseller_pending_company") ||
        session.user.email?.split("@")[0] ||
        "My Company";
      try {
        await provisionUnderReseller(resellerSlug, pendingCompany);
        sessionStorage.removeItem("reseller_pending_company");
        toast.success("Workspace ready!");
        navigate({ to: "/dashboard" });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Setup failed");
      }
    })();
  }, [resellerSlug, navigate]);

  const validate = () => {
    const next: typeof errors = {};
    if (!fullName.trim()) next.fullName = "Please enter your name";
    if (!companyName.trim()) next.companyName = "Please enter your company name";
    if (!email.trim()) next.email = "Please enter your email";
    else if (!EMAIL_RE.test(email.trim())) next.email = "That email looks invalid";
    if (!password) next.password = "Please choose a password";
    else if (password.length < 6) next.password = "Use at least 6 characters";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!acceptedTerms) {
      toast.error("Please accept the Terms & Conditions to continue.");
      return;
    }
    setSubmitting(true);
    try {
      sessionStorage.setItem("reseller_pending_company", companyName);
      if (branding?.id) sessionStorage.setItem("attributed_reseller_id", branding.id);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: redirectTarget,
        },
      });
      if (error) throw error;
      if (data.session) {
        await provisionUnderReseller(resellerSlug, companyName);
        sessionStorage.removeItem("reseller_pending_company");
        toast.success("Workspace ready!");
        navigate({ to: "/dashboard" });
      } else {
        navigate({ to: "/confirm-email" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (!companyName.trim()) {
      setErrors((p) => ({ ...p, companyName: "Please enter your company name first" }));
      return;
    }
    if (!acceptedTerms) {
      toast.error("Please accept the Terms & Conditions to continue.");
      return;
    }
    setGoogleLoading(true);
    try {
      sessionStorage.setItem("reseller_pending_company", companyName);
      if (branding?.id) sessionStorage.setItem("attributed_reseller_id", branding.id);
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: redirectTarget,
      });
      if (result.error) {
        toast.error(result.error instanceof Error ? result.error.message : "Google sign-in failed");
        return;
      }
      if (result.redirected) return;
      await provisionUnderReseller(resellerSlug, companyName);
      sessionStorage.removeItem("reseller_pending_company");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  if (brandingLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Reseller not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The signup link you used is invalid or no longer active.
          </p>
          <Link to="/" className="mt-4 inline-block text-sm text-primary hover:underline">
            Go to homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
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
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: accentColor || "hsl(var(--primary))" }}
            >
              <Terminal className="h-6 w-6 text-primary-foreground" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Get started with {brandName}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Create your workspace in seconds</p>
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
            Sign up with Google
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
            <Label htmlFor="rs-name">Your Name</Label>
            <Input
              id="rs-name"
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (errors.fullName) setErrors({ ...errors, fullName: undefined });
              }}
              placeholder="Jane Smith"
              aria-invalid={!!errors.fullName}
              autoComplete="name"
            />
            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rs-company">Company Name</Label>
            <Input
              id="rs-company"
              type="text"
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                if (errors.companyName) setErrors({ ...errors, companyName: undefined });
              }}
              placeholder="Acme Inc"
              aria-invalid={!!errors.companyName}
              autoComplete="organization"
            />
            {errors.companyName && <p className="text-xs text-destructive">{errors.companyName}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rs-email">Email</Label>
            <Input
              id="rs-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors({ ...errors, email: undefined });
              }}
              placeholder="you@company.com"
              aria-invalid={!!errors.email}
              autoComplete="email"
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rs-password">Password</Label>
            <Input
              id="rs-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors({ ...errors, password: undefined });
              }}
              placeholder="At least 6 characters"
              aria-invalid={!!errors.password}
              autoComplete="new-password"
            />
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>

          <TermsCheckbox checked={acceptedTerms} onCheckedChange={setAcceptedTerms} />

          <Button
            type="submit"
            variant="command"
            className="w-full"
            size="lg"
            disabled={submitting || googleLoading || !acceptedTerms}
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
