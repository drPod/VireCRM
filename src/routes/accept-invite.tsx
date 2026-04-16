import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";

export const Route = createFileRoute("/accept-invite")({
  component: AcceptInvitePage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({
    meta: [
      { title: "Accept Invitation — Vireon" },
      { name: "description", content: "Join your team on Vireon" },
    ],
  }),
});

function AcceptInvitePage() {
  const { token } = Route.useSearch();
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "accepting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      setStatus("error");
      setErrorMsg("No invitation token provided");
      return;
    }
    if (!user) {
      // Not signed in — send them to signup with the token
      window.location.href = `/signup?invite=${encodeURIComponent(token)}`;
    }
  }, [authLoading, user, token, navigate]);

  const handleAccept = async () => {
    setStatus("accepting");
    try {
      const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result?.success) {
        setErrorMsg(result?.error ?? "Failed to accept invitation");
        setStatus("error");
        return;
      }
      await refreshProfile();
      setStatus("success");
      toast.success("Welcome to the team!");
      setTimeout(() => navigate({ to: "/dashboard" }), 1200);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to accept invitation");
      setStatus("error");
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen">
        <MarketingHeader />
        <div className="flex min-h-screen items-center justify-center pt-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <MarketingHeader />
      <div className="flex min-h-screen items-center justify-center px-4 pt-16">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8">
          {status === "success" ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
              <h1 className="mt-4 text-xl font-bold text-foreground">You&apos;re in!</h1>
              <p className="mt-1 text-sm text-muted-foreground">Redirecting to your dashboard…</p>
            </div>
          ) : status === "error" ? (
            <div className="text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
              <h1 className="mt-4 text-xl font-bold text-foreground">Invitation problem</h1>
              <p className="mt-1 text-sm text-muted-foreground">{errorMsg}</p>
              <Link to="/dashboard" className="mt-4 inline-block">
                <Button variant="outline" size="sm">
                  Go to dashboard
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-foreground">Join your team</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                You&apos;ve been invited to join an organization on Vireon. Accepting will move
                your account into the new team.
              </p>
              <div className="mt-4 rounded-lg bg-secondary/40 p-3 text-xs text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{user.email}</span>
              </div>
              <Button
                variant="command"
                className="mt-6 w-full"
                onClick={handleAccept}
                disabled={status === "accepting"}
              >
                {status === "accepting" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Accept invitation
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
