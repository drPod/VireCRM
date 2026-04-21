import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import {
  getIntegrationFn,
  saveIntegrationFn,
  deleteIntegrationFn,
} from "@/functions/integrations.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

export function IntegrationsSettings() {
  const { organization, role } = useAuth();
  const isOwner = role?.role === "owner";

  const getIntegration = useAuthedServerFn(getIntegrationFn);
  const saveIntegration = useAuthedServerFn(saveIntegrationFn);
  const deleteIntegration = useAuthedServerFn(deleteIntegrationFn);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<{
    configured: boolean;
    maskedKey?: string;
    lastVerifiedAt?: string | null;
  }>({ configured: false });

  const refresh = useCallback(async () => {
    if (!organization?.id || !isOwner) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await getIntegration({
        data: { organizationId: organization.id, provider: "apollo" },
      });
      if (result.configured) {
        setStatus({
          configured: true,
          maskedKey: result.maskedKey,
          lastVerifiedAt: result.lastVerifiedAt,
        });
      } else {
        setStatus({ configured: false });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [organization?.id, isOwner, getIntegration]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSave = async () => {
    if (!organization?.id || !apiKey.trim()) return;
    setSaving(true);
    try {
      await saveIntegration({
        data: {
          organizationId: organization.id,
          provider: "apollo",
          apiKey: apiKey.trim(),
        },
      });
      toast.success("Apollo connected", {
        description: "Auto-Find Leads will now pull real verified contacts.",
      });
      setApiKey("");
      void refresh();
    } catch (err) {
      toast.error("Couldn't save key", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!organization?.id) return;
    if (!confirm("Remove the Apollo API key? Auto-Find Leads will stop working until you add a new one.")) {
      return;
    }
    setRemoving(true);
    try {
      await deleteIntegration({
        data: { organizationId: organization.id, provider: "apollo" },
      });
      toast.success("Apollo disconnected");
      void refresh();
    } catch (err) {
      toast.error("Couldn't remove", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setRemoving(false);
    }
  };

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
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">Apollo.io</h3>
              {status.configured ? (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline">Not connected</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Powers Auto-Find Leads with real, verified B2B contacts from Apollo's 275M+
              database. Each lead consumes 1 Apollo email credit.
            </p>
          </div>
          <a
            href="https://app.apollo.io/#/settings/integrations/api"
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemove}
                disabled={removing}
              >
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
              Apollo API key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your Apollo master API key"
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
                  Verifying with Apollo…
                </>
              ) : (
                "Connect Apollo"
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Your key is stored encrypted at rest and only ever used server-side. It is
              never exposed to your team members or the browser.
            </p>
          </div>
        )}
      </Card>

      <Card className="p-4 border-warning/30 bg-warning/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Compliance reminder</p>
            <p>
              You and your clients are responsible for following Apollo's Terms of Service
              and any local data-protection laws (GDPR, CAN-SPAM, CASL). Apollo provides
              opted-out lists — respect them. Avoid bulk-importing emails into channels you
              haven't gotten consent for in restricted regions.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
