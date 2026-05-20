import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { supabase } from "@/integrations/supabase/client";

const changePasswordSearchSchema = z.object({
  forced: z.enum(["1"]).optional(),
});

export const Route = createFileRoute("/change-password")({
  validateSearch: changePasswordSearchSchema,
  component: ChangePasswordPage,
  head: () => ({
    meta: [
      { title: "Change Password — VireCRM" },
      { name: "description", content: "Update your account password" },
    ],
  }),
});

function ChangePasswordPage() {
  const { forced } = Route.useSearch();
  const navigate = useNavigate();
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!data.session) {
        navigate({
          to: "/login",
          search: { redirect: forced === "1" ? "/change-password?forced=1" : "/change-password" } as never,
        });
        return;
      }
      setSessionChecked(true);
    })();
    return () => {
      mounted = false;
    };
  }, [navigate, forced]);

  if (!sessionChecked) return null;

  const isForced = forced === "1";

  return (
    <div className="min-h-screen flex flex-col">
      <MarketingHeader />
      <div className="flex flex-1 items-center justify-center px-4 pt-16">
        <div className="w-full max-w-sm">
          {!isForced && (
            <div className="mb-6">
              <Link
                to="/settings"
                search={{ tab: "security" } as never}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to settings
              </Link>
            </div>
          )}

          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-foreground">
              {isForced ? "Set your permanent password" : "Change your password"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isForced
                ? "Your account was set up with a temporary password. Set a new one to continue."
                : "Choose a new password for your account."}
            </p>
          </div>

          {isForced && (
            <Alert className="mb-6 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                For security, you must set a permanent password before accessing your workspace.
              </AlertDescription>
            </Alert>
          )}

          <ChangePasswordForm onSuccess={() => navigate({ to: "/dashboard" })} />
        </div>
      </div>
    </div>
  );
}
