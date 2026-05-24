import { useState } from "react";
import { useNavigate } from "react-router";
import { getSupabaseBrowserClient } from "~/lib/supabase.client";

export function meta() {
  return [{ title: "Sign in — genesisxsx" }];
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
        setError(signInError.message);
        return;
      }
      // Supabase persists the session in `localStorage`; future requests can
      // attach the JWT via `getSession()`. Send the user to the app root.
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
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
          Use your virecrm.com email and password.
        </p>

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
          disabled={submitting}
          className="bg-slate-900 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
