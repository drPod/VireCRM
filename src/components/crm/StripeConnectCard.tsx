import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { getStripeEnvironment } from "@/lib/stripe";

interface AccountRow {
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  country: string | null;
  default_currency: string | null;
}

export function StripeConnectCard() {
  const { organization, role } = useAuth();
  const [account, setAccount] = useState<AccountRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);

  const refresh = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("client_stripe_accounts")
      .select(
        "stripe_account_id, charges_enabled, payouts_enabled, details_submitted, country, default_currency",
      )
      .eq("organization_id", organization.id)
      .maybeSingle();
    setAccount(data);
    setLoading(false);
  }, [organization?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openOnboarding = async () => {
    setOpening(true);
    const { data, error } = await supabase.functions.invoke("connect-stripe-account", {
      body: {
        environment: getStripeEnvironment(),
        returnUrl: `${window.location.origin}/settings?stripe=connected`,
        refreshUrl: `${window.location.origin}/settings?stripe=refresh`,
      },
    });
    setOpening(false);
    const payload = data as
      | { url?: string; error?: string; code?: string; actionUrl?: string }
      | null;
    if (error || payload?.error) {
      // Special case: the platform Stripe account hasn't enabled Connect yet.
      // Give the owner a one-click path to fix it instead of a dead-end toast.
      if (payload?.code === "stripe_connect_not_enabled" && payload.actionUrl) {
        toast.error("Enable Stripe Connect first", {
          description: payload.error,
          duration: 12000,
          action: {
            label: "Open Stripe Connect",
            onClick: () => window.open(payload.actionUrl!, "_blank", "noopener"),
          },
        });
        return;
      }
      toast.error(payload?.error || error?.message || "Failed to open Stripe");
      return;
    }
    if (!payload?.url) {
      toast.error("Stripe didn't return an onboarding link. Please try again.");
      return;
    }
    window.open(payload.url, "_blank", "noopener");
    toast.message("Stripe onboarding opened in a new tab");
  };

  if (role?.role !== "owner") return null;

  const isReady = !!account?.charges_enabled;
  const needsMore = account && !isReady;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Get paid by your leads
            </CardTitle>
            <CardDescription className="mt-1">
              Connect your Stripe account so you can send custom invoices and recurring charges to
              leads. Funds go directly to your bank.
            </CardDescription>
          </div>
          {isReady && (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> Ready
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : !account ? (
          <Button onClick={openOnboarding} disabled={opening} variant="command">
            {opening && <Loader2 className="h-4 w-4 animate-spin" />}
            Connect Stripe
            <ExternalLink className="h-4 w-4" />
          </Button>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <Stat label="Charges" ok={account.charges_enabled} />
              <Stat label="Payouts" ok={account.payouts_enabled} />
              <Stat label="Details" ok={account.details_submitted} />
            </div>
            {account.country && (
              <p className="text-xs text-muted-foreground">
                Account country: {account.country.toUpperCase()} · default currency{" "}
                {(account.default_currency || "usd").toUpperCase()}
              </p>
            )}
            {needsMore && (
              <p className="text-xs text-warning">
                Stripe needs a bit more info before you can charge leads.
              </p>
            )}
            <div className="flex gap-2">
              <Button onClick={openOnboarding} disabled={opening} variant="outline" size="sm">
                {opening && <Loader2 className="h-3 w-3 animate-spin" />}
                {isReady ? "Manage Stripe" : "Continue onboarding"}
                <ExternalLink className="h-3 w-3" />
              </Button>
              <Button onClick={refresh} variant="ghost" size="sm">
                Refresh status
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div
      className={`rounded-md border px-2 py-1.5 text-center ${
        ok
          ? "border-success/40 bg-success/10 text-success"
          : "border-border bg-muted text-muted-foreground"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide">{label}</div>
      <div className="text-xs font-semibold">{ok ? "Active" : "Pending"}</div>
    </div>
  );
}
