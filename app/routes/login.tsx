import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { ApiError, apiFetch } from "~/lib/api";
import { classifySignInError, messageForTenantError } from "~/lib/auth-errors";
import { supabase } from "~/lib/supabase";
import { captureException } from "~/sentry.client";

export function meta() {
  return [{ title: "Sign in · VireCRM" }, { name: "robots", content: "noindex" }];
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Set after mount — the server doesn't know the hostname, and reading it
  // during render causes a hydration text mismatch.
  const [tenant, setTenant] = useState<string | null>(null);
  useEffect(() => {
    setTenant(window.location.hostname.split(".")[0] ?? null);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: signInError } = await supabase().auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        // Never echo the raw Supabase message — "Invalid login credentials"
        // vs "Email not confirmed" lets an attacker enumerate which emails
        // exist on this tenant. Collapse to generic copy; original → Sentry.
        const { userMessage, opsError } = classifySignInError(signInError);
        captureException(opsError, { tags: { layer: "auth-login" } });
        setError(userMessage);
        return;
      }

      // Supabase global email uniqueness lets a tenant-A user sign in on a
      // tenant-B subdomain. Probe the Worker (which cross-checks JWT claim vs
      // request host) so we clear the bogus session here instead of stranding
      // the user on an app shell where every call 403s.
      try {
        await apiFetch("/api/auth/whoami");
      } catch (probeErr) {
        const { error: signOutError } = await supabase().auth.signOut();
        if (signOutError) {
          captureException(signOutError, { tags: { layer: "auth-login" } });
        }
        if (probeErr instanceof ApiError) {
          setError(messageForTenantError(probeErr.code));
        } else {
          const { userMessage, opsError } = classifySignInError(probeErr);
          captureException(opsError, { tags: { layer: "auth-login" } });
          setError(userMessage);
        }
        return;
      }

      navigate("/", { replace: true });
    } catch (err) {
      const { userMessage, opsError } = classifySignInError(err);
      captureException(opsError, { tags: { layer: "auth-login" } });
      setError(userMessage);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">VireCRM</CardTitle>
          <CardDescription>
            {tenant ? `Sign in to ${tenant}` : "Sign in to your workspace"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit}>
            {/* fieldset (not per-control `disabled`) so a re-submit or edit
                mid-flight is impossible while the whoami probe runs */}
            <fieldset disabled={busy} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <Button type="submit">{busy ? "Signing in…" : "Sign in"}</Button>
            </fieldset>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
