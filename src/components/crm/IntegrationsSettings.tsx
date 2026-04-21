import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import {
  getIntegrationFn,
  saveIntegrationFn,
  deleteIntegrationFn,
} from "@/functions/integrations.functions";
import { getLeadUsageFn, type LeadUsage } from "@/functions/find-leads.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Trash2,
  Zap,
  Infinity as InfinityIcon,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

type Provider = "apollo" | "hunter" | "snov";

interface ProviderConfig {
  id: Provider;
  name: string;
  /** Short pitch shown under the name. */
  description: string;
  /** Where to grab a key. */
  docsUrl: string;
  /** Helper shown above the input. */
  inputHint: string;
  /** Toast description after a successful connect. */
  connectedDescription: string;
  /** Confirmation prompt before removal. */
  removeConfirm: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: "apollo",
    name: "Apollo.io",
    description:
      "Powers Auto-Find Leads with real, verified B2B contacts from Apollo's 275M+ database. Each lead consumes 1 Apollo email credit.",
    docsUrl: "https://app.apollo.io/#/settings/integrations/api",
    inputHint: "Paste your Apollo master API key",
    connectedDescription: "Auto-Find Leads will now pull real verified contacts.",
    removeConfirm:
      "Remove the Apollo API key? Auto-Find Leads will fall back to platform credits (or stop working if you have none).",
  },
  {
    id: "hunter",
    name: "Hunter.io",
    description:
      "Cheaper domain-search alternative. Find every public email at a company domain — great for outreach to specific accounts.",
    docsUrl: "https://hunter.io/api-keys",
    inputHint: "Paste your Hunter API key",
    connectedDescription: "Hunter.io is now selectable in Auto-Find Leads.",
    removeConfirm: "Remove the Hunter.io API key? Domain searches via Hunter will stop working.",
  },
  {
    id: "snov",
    name: "Snov.io",
    description:
      "Cheapest per-email provider. Domain search by company. Snov uses OAuth — paste your credentials joined with a colon (client_id:client_secret).",
    docsUrl: "https://app.snov.io/account#/api",
    inputHint: "Paste your Snov credentials as client_id:client_secret",
    connectedDescription: "Snov.io is now selectable in Auto-Find Leads.",
    removeConfirm: "Remove the Snov.io API key? Domain searches via Snov will stop working.",
  },
];

interface ProviderStatus {
  configured: boolean;
  maskedKey?: string;
  lastVerifiedAt?: string | null;
}

export function IntegrationsSettings() {
  const { organization, role } = useAuth();
  const isOwner = role?.role === "owner";

  const getIntegration = useAuthedServerFn(getIntegrationFn);
  const saveIntegration = useAuthedServerFn(saveIntegrationFn);
  const deleteIntegration = useAuthedServerFn(deleteIntegrationFn);
  const getLeadUsage = useAuthedServerFn(getLeadUsageFn);

  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Record<Provider, ProviderStatus>>({
    apollo: { configured: false },
    hunter: { configured: false },
    snov: { configured: false },
  });
  const [usage, setUsage] = useState<LeadUsage | null>(null);

  const refresh = useCallback(async () => {
    if (!organization?.id || !isOwner) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [apollo, hunter, snov, u] = await Promise.all([
        getIntegration({ data: { organizationId: organization.id, provider: "apollo" } }),
        getIntegration({ data: { organizationId: organization.id, provider: "hunter" } }),
        getIntegration({ data: { organizationId: organization.id, provider: "snov" } }),
        getLeadUsage({ data: { organizationId: organization.id } }).catch(() => null),
      ]);

      const toStatus = (r: typeof apollo): ProviderStatus =>
        r.configured
          ? {
              configured: true,
              maskedKey: r.maskedKey,
              lastVerifiedAt: r.lastVerifiedAt,
            }
          : { configured: false };

      setStatuses({
        apollo: toStatus(apollo),
        hunter: toStatus(hunter),
        snov: toStatus(snov),
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
    <div className="space-y-6">
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
                You've used all your credits this month. They reset on the 1st — or upgrade your plan, or add your own Apollo key below for unlimited.
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

      {/* One card per provider */}
      {PROVIDERS.map((cfg) => (
        <ProviderCard
          key={cfg.id}
          config={cfg}
          status={statuses[cfg.id]}
          loading={loading}
          onSave={(key) => handleSave(cfg.id, key)}
          onRemove={() => handleRemove(cfg.id)}
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
    </div>
  );
}

// ===== Provider card =====

interface ProviderCardProps {
  config: ProviderConfig;
  status: ProviderStatus;
  loading: boolean;
  onSave: (apiKey: string) => Promise<void>;
  onRemove: () => Promise<void>;
}

function ProviderCard({ config, status, loading, onSave, onRemove }: ProviderCardProps) {
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const handleSave = async () => {
    if (apiKey.trim().length < 10) return;
    setSaving(true);
    try {
      await onSave(apiKey);
      toast.success(`${config.name} connected`, { description: config.connectedDescription });
      setApiKey("");
    } catch (err) {
      toast.error("Couldn't save key", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm(config.removeConfirm)) return;
    setRemoving(true);
    try {
      await onRemove();
      toast.success(`${config.name} disconnected`);
    } catch (err) {
      toast.error("Couldn't remove", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">{config.name}</h3>
            {status.configured ? (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-success" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline">Not connected</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
        </div>
        <a
          href={config.docsUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
        >
          Get API key <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : status.configured ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <code className="font-mono text-foreground">{status.maskedKey}</code>
            </div>
            {status.lastVerifiedAt && (
              <span className="text-xs text-muted-foreground">
                Verified {new Date(status.lastVerifiedAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRemove} disabled={removing}>
              {removing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block text-xs font-medium text-foreground">
            {config.name} API key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={config.inputHint}
            className="h-9 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring font-mono"
            autoComplete="off"
            spellCheck={false}
            maxLength={500}
          />
          <Button
            variant="command"
            size="sm"
            onClick={handleSave}
            disabled={saving || apiKey.trim().length < 10}
            className="w-full sm:w-auto"
          >
            {saving ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Verifying with {config.name}…
              </>
            ) : (
              `Connect ${config.name}`
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            Your key is stored encrypted at rest and only ever used server-side. It is never
            exposed to your team members or the browser.
          </p>
        </div>
      )}
    </Card>
  );
}
