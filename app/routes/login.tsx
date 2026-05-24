import { useState } from "react";
import { useNavigate } from "react-router";
import { authedFetch } from "~/lib/api-client";
import {
  classifySignInError,
  messageForTenantError,
} from "~/lib/auth-errors";
import { captureException } from "~/sentry.client";
import { getSupabaseBrowserClient } from "~/lib/supabase.client";

export function meta() {
  return [
    { title: "Sign in — genesisxsx" },
    { name: "robots", content: "noindex" },
  ];
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        const { userMessage, opsError } = classifySignInError(signInError);
        captureException(opsError, { tags: { layer: "auth-login" } });
        setError(userMessage);
        return;
      }

      // Supabase global email uniqueness lets a tenant-A user sign in on a
      // tenant-B subdomain. Probe the Worker (which cross-checks JWT claim vs
      // request host) so we can clear the bogus session before the user lands
      // on an auth-gated page that would just 403 in a loop.
      const probe = await authedFetch("/api/auth/whoami");
      if (!probe.ok) {
        const body = (await probe.json().catch(() => null)) as
          | { error?: { code?: string } }
          | null;
        const code = body?.error?.code;
        await supabase.auth.signOut();
        setError(messageForTenantError(code));
        return;
      }

      navigate("/");
    } catch (err) {
      const { userMessage, opsError } = classifySignInError(err);
      captureException(opsError, { tags: { layer: "auth-login" } });
      setError(userMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-lg shadow p-6 flex flex-col gap-4"
        aria-label="Sign in"
      >
        <h1 className="text-2xl font-semibold text-slate-900">Sign in</h1>
        <p className="text-sm text-slate-600">
          Use the email you signed up with.
        </p>

        <fieldset disabled={submitting} className="flex flex-col gap-4 border-0 p-0 m-0">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </label>

          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="bg-slate-900 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </fieldset>
      </form>
    </main>
  );
}
