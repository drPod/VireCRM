import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import {
  getIntegrationFn,
  saveIntegrationFn,
  deleteIntegrationFn,
  testIntegrationFn,
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
  Pencil,
  Activity,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ConnectorIntegrations } from "./ConnectorIntegrations";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Provider = "apollo" | "hunter" | "snov" | "sendgrid";

interface ProviderConfigField {
  key: string;
  label: string;
  placeholder?: string;
  helper?: string;
}

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
  /** Plain-English step-by-step setup guide. Shown as a numbered list. */
  setupSteps: string[];
  /** Two-field credentials? (e.g. Snov needs client_id + secret). */
  twoFieldCredentials?: {
    fieldOneLabel: string;
    fieldOnePlaceholder: string;
    fieldTwoLabel: string;
    fieldTwoPlaceholder: string;
    /** How the two are joined when sent to the server. */
    joiner: string;
  };
  /** Non-secret editable settings (stored in org_integrations.config). */
  settingsFields?: ProviderConfigField[];
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: "apollo",
    name: "Apollo.io",
    description:
      "Powers Auto-Find Leads with real, verified B2B contacts from Apollo's 275M+ database. Each lead consumes 1 Apollo email credit.",
    docsUrl: "https://app.apollo.io/#/settings/integrations/api",
    inputHint: "Paste your Apollo API key here",
    connectedDescription: "Auto-Find Leads will now pull real verified contacts.",
    removeConfirm:
      "Auto-Find Leads will fall back to platform credits, or stop working if you have none.",
    setupSteps: [
      'Click "Get API key" above — it opens Apollo in a new tab.',
      "Sign in to your Apollo account (or create one — the free plan works).",
      'On the API keys page, click "Create new key" and give it a name like "Genesis CRM".',
      'Copy the long key that starts with letters and numbers, then paste it below and click "Connect".',
    ],
  },
  {
    id: "hunter",
    name: "Hunter.io",
    description:
      "Cheaper domain-search alternative. Find every public email at a company domain — great for outreach to specific accounts.",
    docsUrl: "https://hunter.io/api-keys",
    inputHint: "Paste your Hunter API key here",
    connectedDescription: "Hunter.io is now selectable in Auto-Find Leads.",
    removeConfirm: "Domain searches via Hunter will stop working.",
    setupSteps: [
      'Click "Get API key" above — it opens Hunter in a new tab.',
      "Sign in (the free plan includes 25 searches per month).",
      "You'll see your API key listed at the top of the page — copy it.",
      'Paste it below and click "Connect".',
    ],
  },
  {
    id: "snov",
    name: "Snov.io",
    description:
      "Cheapest per-email provider. Find emails by company domain. Best value if you're sending lots of outreach.",
    docsUrl: "https://app.snov.io/account#/api",
    inputHint: "Paste your Client ID",
    connectedDescription: "Snov.io is now selectable in Auto-Find Leads.",
    removeConfirm: "Domain searches via Snov will stop working.",
    setupSteps: [
      'Click "Get API key" above — it opens Snov.io in a new tab.',
      "Sign in to your Snov account.",
      'On the API page you\'ll see two values: "User ID" and "Secret". Copy them both.',
      "Paste them in the two boxes below and click \"Connect\". We'll handle the rest.",
    ],
    twoFieldCredentials: {
      fieldOneLabel: "User ID (also called Client ID)",
      fieldOnePlaceholder: "e.g. 1a2b3c4d5e6f7g8h9i0j",
      fieldTwoLabel: "Secret",
      fieldTwoPlaceholder: "e.g. abc123def456ghi789",
      joiner: ":",
    },
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
  const testIntegration = useAuthedServerFn(testIntegrationFn);
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
  onTest: () => Promise<{ ok: boolean; reason?: string; verifiedAt?: string } | null>;
}

function ProviderCard({ config, status, loading, onSave, onRemove, onTest }: ProviderCardProps) {
  const isTwoField = !!config.twoFieldCredentials;
  const [apiKey, setApiKey] = useState("");
  const [fieldOne, setFieldOne] = useState("");
  const [fieldTwo, setFieldTwo] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showStepsForFirstSetup, setShowStepsForFirstSetup] = useState(true);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const verifiedLabel = status.lastVerifiedAt
    ? `Verified ${formatRelative(status.lastVerifiedAt)}`
    : null;

  // What the user actually submits — single field or joined two fields.
  const submitValue = (): string => {
    if (isTwoField) {
      return `${fieldOne.trim()}${config.twoFieldCredentials!.joiner}${fieldTwo.trim()}`;
    }
    return apiKey.trim();
  };

  const canSubmit = isTwoField
    ? fieldOne.trim().length >= 4 && fieldTwo.trim().length >= 4
    : apiKey.trim().length >= 10;

  const resetInputs = () => {
    setApiKey("");
    setFieldOne("");
    setFieldTwo("");
  };

  const handleSave = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await onSave(submitValue());
      toast.success(`${config.name} ${editing ? "updated" : "connected"}`, {
        description: editing
          ? "Your new key is verified and saved."
          : config.connectedDescription,
      });
      resetInputs();
      setEditing(false);
    } catch (err) {
      toast.error("Couldn't save", {
        description:
          err instanceof Error
            ? `${err.message} — Double-check you copied the whole key.`
            : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await onRemove();
      toast.success(`${config.name} disconnected`);
    } catch (err) {
      toast.error("Couldn't disconnect", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setRemoving(false);
      setConfirmDisconnect(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await onTest();
      if (res?.ok) {
        toast.success(`${config.name} is working`, {
          description: "Credentials verified successfully.",
        });
      } else {
        toast.error(`${config.name} test failed`, {
          description: res?.reason ?? "No response from provider.",
        });
      }
    } catch (err) {
      toast.error("Test failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setTesting(false);
    }
  };

  // Step-by-step "How to get your key" panel — the headline accessibility win
  // for non-technical users. Always visible on first setup; hidden by default
  // when editing an existing connection.
  const renderSetupSteps = () => (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div>
          <h4 className="text-sm font-semibold text-foreground">
            How to set up {config.name} (takes 2 minutes)
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Follow these steps in order. The link opens {config.name} in a new browser tab.
          </p>
        </div>
      </div>
      <ol className="space-y-2 ml-1">
        {config.setupSteps.map((step, i) => (
          <li key={i} className="flex gap-3 text-xs text-foreground">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {i + 1}
            </span>
            <span className="pt-0.5 leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );

  // The credential editor — single text field OR two side-by-side fields.
  const renderEditor = () => {
    const tf = config.twoFieldCredentials;
    return (
      <div className="space-y-3">
        {isTwoField && tf ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">
                {tf.fieldOneLabel}
              </label>
              <input
                type="text"
                value={fieldOne}
                onChange={(e) => setFieldOne(e.target.value)}
                placeholder={tf.fieldOnePlaceholder}
                className="h-9 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring font-mono"
                autoComplete="off"
                spellCheck={false}
                maxLength={250}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">
                {tf.fieldTwoLabel}
              </label>
              <input
                type="password"
                value={fieldTwo}
                onChange={(e) => setFieldTwo(e.target.value)}
                placeholder={tf.fieldTwoPlaceholder}
                className="h-9 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring font-mono"
                autoComplete="off"
                spellCheck={false}
                maxLength={250}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
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
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="command"
            size="sm"
            onClick={handleSave}
            disabled={saving || !canSubmit}
          >
            {saving ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Checking with {config.name}…
              </>
            ) : editing ? (
              "Save new key"
            ) : (
              `Connect ${config.name}`
            )}
          </Button>
          {editing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                resetInputs();
              }}
              disabled={saving}
            >
              Cancel
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <KeyRound className="h-3 w-3 mt-0.5 shrink-0" />
          <span>
            Your credentials are stored encrypted and only used by our servers. Your team and
            browser never see them.
          </span>
        </p>
      </div>
    );
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
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
            {verifiedLabel && (
              <span className="text-xs text-muted-foreground">{verifiedLabel}</span>
            )}
          </div>

          {editing ? (
            <>
              {renderSetupSteps()}
              {renderEditor()}
            </>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
                {testing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Activity className="h-3.5 w-3.5" />
                )}
                Test
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDisconnect(true)}
                disabled={removing}
              >
                {removing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Disconnect
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {showStepsForFirstSetup ? (
            renderSetupSteps()
          ) : (
            <button
              type="button"
              onClick={() => setShowStepsForFirstSetup(true)}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <HelpCircle className="h-3 w-3" />
              Show step-by-step setup guide
            </button>
          )}
          {renderEditor()}
        </div>
      )}

      <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {config.name}?</AlertDialogTitle>
            <AlertDialogDescription>{config.removeConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Keep connected</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} disabled={removing}>
              {removing ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Disconnecting…
                </>
              ) : (
                "Yes, disconnect"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// Tiny relative-time formatter — keeps the card label compact ("5m ago", "yesterday").
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "yesterday";
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}
