import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Workflow, ExternalLink, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import {
  getN8nConfigFn,
  saveN8nConfigFn,
  type N8nActionType,
  type N8nWebhookConfig,
} from "@/functions/n8n-config.functions";

const ACTION_LABELS: Record<N8nActionType, { label: string; help: string }> = {
  create_task: {
    label: "Create task",
    help: "AI says 'remind me to call X'. Payload: { action_type, payload: { title, description, priority, due_in_days, lead_match }, organization_id, user_id }.",
  },
  draft_message: {
    label: "Draft email",
    help: "AI writes an outreach draft. Payload includes subject, body, and the matched lead string.",
  },
  score_leads: {
    label: "Score leads",
    help: "AI bulk-adjusts lead scores. Payload includes criteria, score_delta, status_filter, max_leads.",
  },
  create_campaign: {
    label: "Create campaign",
    help: "AI starts a campaign shell. Payload includes name and objective.",
  },
  pipeline_summary: {
    label: "Pipeline summary",
    help: "AI requests a pipeline health summary. Useful for piping into Slack / a digest.",
  },
};

const ALL_TYPES: N8nActionType[] = [
  "create_task",
  "draft_message",
  "score_leads",
  "create_campaign",
  "pipeline_summary",
];

export function N8nWebhookSettings() {
  const getConfig = useAuthedServerFn(getN8nConfigFn);
  const saveConfig = useAuthedServerFn(saveN8nConfigFn);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg: N8nWebhookConfig = await getConfig({});
        if (cancelled) return;
        setEnabled(cfg.enabled);
        setUrls((cfg.webhooks ?? {}) as Record<string, string>);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load n8n config");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const cleaned: Record<string, string> = {};
      for (const t of ALL_TYPES) {
        const v = (urls[t] ?? "").trim();
        if (v) cleaned[t] = v;
      }
      const cfg = await saveConfig({
        data: { webhooks: cleaned, enabled },
      });
      setEnabled(cfg.enabled);
      setUrls((cfg.webhooks ?? {}) as Record<string, string>);
      toast.success("n8n routing saved", {
        description: `${Object.keys(cleaned).length} webhook${
          Object.keys(cleaned).length === 1 ? "" : "s"
        } registered`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading n8n routing…</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Workflow className="h-4 w-4 text-primary" />
            n8n workflow routing
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-xl">
            For each AI Advisor action type, paste an n8n webhook URL to
            handle it externally. If left blank, the CRM runs the action
            in-app. n8n receives a JSON payload with the AI's structured
            arguments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Enabled</span>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>

      <div className="space-y-3">
        {ALL_TYPES.map((t) => {
          const meta = ACTION_LABELS[t];
          return (
            <div key={t} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  {meta.label}
                </label>
                {urls[t] && (
                  <span className="text-[10px] uppercase tracking-wide text-success font-semibold">
                    routed
                  </span>
                )}
              </div>
              <Input
                placeholder="https://your.n8n.cloud/webhook/..."
                value={urls[t] ?? ""}
                onChange={(e) =>
                  setUrls((prev) => ({ ...prev, [t]: e.target.value }))
                }
                disabled={!enabled}
              />
              <p className="text-[11px] text-muted-foreground">{meta.help}</p>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <a
          href="https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/"
          target="_blank"
          rel="noreferrer noopener"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          n8n Webhook node docs
          <ExternalLink className="h-3 w-3" />
        </a>
        <Button onClick={handleSave} disabled={saving} variant="command" size="sm" className="gap-1.5">
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
              Save routing
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
