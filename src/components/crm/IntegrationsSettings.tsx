import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import {
  getIntegrationFn,
  saveIntegrationFn,
  deleteIntegrationFn,
  testIntegrationFn,
  updateIntegrationConfigFn,
} from "@/functions/integrations.functions";
import { getLeadUsageFn, type LeadUsage } from "@/functions/find-leads.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  KeyRound,
  Loader2,
  AlertTriangle,
  Zap,
  Infinity as InfinityIcon,
  Activity,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ConnectorIntegrations } from "./ConnectorIntegrations";
import { BusinessEmailCard } from "./BusinessEmailCard";
import { EmailDeliverabilityPanel } from "./EmailDeliverabilityPanel";
import { ResendSettingsCard } from "./ResendSettingsCard";
import { IntegrationActivityLog } from "./IntegrationActivityLog";
import { ProviderCard } from "./ProviderCard";
import { PROVIDERS } from "@/lib/provider-configs";
import type { Provider, ProviderStatus } from "@/types/integrations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

export function IntegrationsSettings() {
  const { organization, role } = useAuth();
  const isOwner = role?.role === "owner";

  const getIntegration = useAuthedServerFn(getIntegrationFn);
  const saveIntegration = useAuthedServerFn(saveIntegrationFn);
  const deleteIntegration = useAuthedServerFn(deleteIntegrationFn);
  const testIntegration = useAuthedServerFn(testIntegrationFn);
  const updateIntegrationConfig = useAuthedServerFn(updateIntegrationConfigFn);
  const getLeadUsage = useAuthedServerFn(getLeadUsageFn);

  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Record<Provider, ProviderStatus>>({
    apollo: { configured: false },
    hunter: { configured: false },
    snov: { configured: false },
    sendgrid: { configured: false },
  });
  const [usage, setUsage] = useState<LeadUsage | null>(null);

  const refresh = useCallback(async () => {
    if (!organization?.id || !isOwner) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [apollo, hunter, snov, sendgrid, u] = await Promise.all([
        getIntegration({ data: { organizationId: organization.id, provider: "apollo" } }),
        getIntegration({ data: { organizationId: organization.id, provider: "hunter" } }),
        getIntegration({ data: { organizationId: organization.id, provider: "snov" } }),
        getIntegration({ data: { organizationId: organization.id, provider: "sendgrid" } }),
        getLeadUsage({ data: { organizationId: organization.id } }).catch(() => null),
      ]);

      type IntegrationResult = Awaited<ReturnType<typeof getIntegration>>;
      const toStatus = (r: IntegrationResult): ProviderStatus =>
        r.configured
          ? {
              configured: true,
              maskedKey: r.maskedKey,
              lastVerifiedAt: r.lastVerifiedAt,
              config: r.config,
            }
          : { configured: false };

      setStatuses({
        apollo: toStatus(apollo),
        hunter: toStatus(hunter),
        snov: toStatus(snov),
        sendgrid: toStatus(sendgrid),
      });
      setUsage(u);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [organization?.id, isOwner, getIntegration, getLeadUsage]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Apollo BYO drives the "unlimited" badge — Hunter/Snov are billed directly to the org's vendor account
  // and don't affect platform quota.
  const apolloConfigured = statuses.apollo.configured;
  const isUnlimited = !!usage && usage.quota >= 999999;
  const quotaPct =
    usage && usage.quota > 0 && !isUnlimited
      ? Math.min(100, Math.round((usage.used / usage.quota) * 100))
      : 0;
  const lowCredits = !!usage && !isUnlimited && usage.remaining > 0 && usage.remaining < 10;
  const outOfCredits = !!usage && !isUnlimited && usage.remaining <= 0;

  const handleSave = useCallback(
    async (provider: Provider, apiKey: string) => {
      if (!organization?.id) return;
      await saveIntegration({
        data: {
          organizationId: organization.id,
          provider,
          apiKey: apiKey.trim(),
        },
      });
      void refresh();
    },
    [organization?.id, saveIntegration, refresh],
  );

  const handleRemove = useCallback(
    async (provider: Provider) => {
      if (!organization?.id) return;
      await deleteIntegration({
        data: { organizationId: organization.id, provider },
      });
      void refresh();
    },
    [organization?.id, deleteIntegration, refresh],
  );

  const handleTest = useCallback(
    async (provider: Provider) => {
      if (!organization?.id) return null;
      const res = await testIntegration({
        data: { organizationId: organization.id, provider },
      });
      void refresh();
      return res;
    },
    [organization?.id, testIntegration, refresh],
  );

  const handleSaveConfig = useCallback(
    async (provider: Provider, config: Record<string, string | number | boolean | null>) => {
      if (!organization?.id) return;
      await updateIntegrationConfig({
        data: { organizationId: organization.id, provider, config },
      });
      void refresh();
    },
    [organization?.id, updateIntegrationConfig, refresh],
  );

  if (!isOwner) {
    return (
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Owners only</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Only the organization owner can manage integration credentials.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="manage" className="w-full">
      <TabsList className="mb-6">
        <TabsTrigger value="manage" className="gap-2">
          <KeyRound className="h-3.5 w-3.5" />
          Manage
        </TabsTrigger>
        <TabsTrigger value="activity" className="gap-2">
          <Activity className="h-3.5 w-3.5" />
          Activity
        </TabsTrigger>
      </TabsList>

      <TabsContent value="manage" className="space-y-6">
        {/* Monthly lead credits */}
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <h3 className="text-base font-semibold text-foreground">Monthly Lead Credits</h3>
              {apolloConfigured ? (
                <Badge variant="secondary" className="gap-1">
                  <KeyRound className="h-3 w-3 text-success" />
                  Your Apollo key — unlimited
                </Badge>
              ) : isUnlimited ? (
                <Badge variant="secondary" className="gap-1">
                  <InfinityIcon className="h-3 w-3" />
                  Unlimited
                </Badge>
              ) : null}
            </div>
            {!apolloConfigured && !isUnlimited && usage && (
              <Link to="/pricing" className="text-xs text-primary hover:underline shrink-0">
                Upgrade plan
              </Link>
            )}
          </div>

          {!usage ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : apolloConfigured ? (
            <p className="text-sm text-muted-foreground">
              You're using your own Apollo API key, so platform credits don't apply when searching
              with Apollo. Hunter and Snov searches are always billed directly by their vendors.
            </p>
          ) : isUnlimited ? (
            <p className="text-sm text-muted-foreground">
              Your plan includes unlimited lead credits this month.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-2xl font-semibold text-foreground tabular-nums">
                    {usage.used}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Used</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-foreground tabular-nums">
                    {usage.remaining}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Remaining</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-muted-foreground tabular-nums">
                    {usage.quota}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Monthly quota</div>
                </div>
              </div>
              <Progress value={quotaPct} className="h-2" />
              {outOfCredits ? (
                <p className="text-xs text-destructive">
                  You've used all your credits this month. They reset on the 1st — or upgrade your
                  plan, or add your own Apollo key below for unlimited.
                </p>
              ) : lowCredits ? (
                <p className="text-xs text-warning">
                  Only {usage.remaining} credits left this month. Resets on the 1st.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Credits reset on the 1st of every month.
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Sender identity (Reply-To) — applies on every plan */}
        <BusinessEmailCard sendgridConnected={statuses.sendgrid.configured} />

        {/* SPF / DKIM / DMARC verification for the sender domain */}
        <EmailDeliverabilityPanel organizationId={organization?.id} />

        {/* Resend — workspace-level connector + per-org from address */}
        <ResendSettingsCard />

        {/* One-click connector integrations (Slack, Gmail, HubSpot, ...) */}
        <ConnectorIntegrations />

        <Separator />

        <div>
          <h3 className="text-base font-semibold text-foreground">Lead-source API keys</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Use your own account with these lead-finding providers. You'll be billed directly by
            them, and these searches don't count against your monthly quota above. Don't worry —
            each one has step-by-step instructions to walk you through it.
          </p>
        </div>

        {/* One card per BYO provider */}
        {PROVIDERS.map((cfg) => (
          <ProviderCard
            key={cfg.id}
            config={cfg}
            status={statuses[cfg.id]}
            loading={loading}
            onSave={(key) => handleSave(cfg.id, key)}
            onRemove={() => handleRemove(cfg.id)}
            onTest={() => handleTest(cfg.id)}
            onSaveConfig={(c) => handleSaveConfig(cfg.id, c)}
          />
        ))}

        <Card className="p-4 border-warning/30 bg-warning/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Compliance reminder</p>
              <p>
                You and your clients are responsible for following each provider's Terms of Service
                and any local data-protection laws (GDPR, CAN-SPAM, CASL). Apollo, Hunter, and Snov
                all provide opted-out lists — respect them. Avoid bulk-importing emails into
                channels you haven't gotten consent for in restricted regions.
              </p>
            </div>
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="activity">
        <IntegrationActivityLog />
      </TabsContent>
    </Tabs>
  );
}
