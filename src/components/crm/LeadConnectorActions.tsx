/**
 * Lead drawer "More actions" menu — auto-populates with the org's enabled
 * connector actions (Slack, Teams, SMS, Linear, ...).
 *
 * Each action opens a tiny prompt dialog tailored to the provider, then
 * fires the corresponding server fn. Failures surface as toasts and are
 * recorded in `connector_activity_log` server-side.
 */
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import { listEnabledConnectorsFn } from "@/functions/connectors.functions";
import {
  sendSlackMessageFn,
  sendTwilioSmsFn,
  sendOutlookEmailFn,
  createLinearIssueFn,
  sendTeamsMessageFn,
} from "@/functions/connector-actions.functions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoreHorizontal, MessageSquare, Send, Smartphone, Mail, ListPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface LeadConnectorActionsProps {
  leadId: string;
  leadName: string;
  leadEmail: string | null;
  leadPhone: string | null;
}

interface DialogState {
  provider: string;
  fields: Array<{ key: string; label: string; placeholder?: string; defaultValue?: string; multiline?: boolean }>;
  title: string;
  description: string;
  submitLabel: string;
  onSubmit: (values: Record<string, string>) => Promise<void>;
}

export function LeadConnectorActions({ leadId, leadName, leadEmail, leadPhone }: LeadConnectorActionsProps) {
  const { organization } = useAuth();
  const listEnabled = useAuthedServerFn(listEnabledConnectorsFn);
  const sendSlack = useAuthedServerFn(sendSlackMessageFn);
  const sendSms = useAuthedServerFn(sendTwilioSmsFn);
  const sendEmail = useAuthedServerFn(sendOutlookEmailFn);
  const createIssue = useAuthedServerFn(createLinearIssueFn);
  const sendTeams = useAuthedServerFn(sendTeamsMessageFn);

  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!organization?.id) return;
    listEnabled({ data: { organizationId: organization.id } })
      .then((res) => setEnabled(new Set(res.enabled.map((e) => e.provider))))
      .catch(() => setEnabled(new Set()));
  }, [organization?.id, listEnabled]);

  const openDialog = (state: DialogState) => {
    const init: Record<string, string> = {};
    for (const f of state.fields) init[f.key] = f.defaultValue ?? "";
    setValues(init);
    setDialog(state);
  };

  const handleSubmit = useCallback(async () => {
    if (!dialog) return;
    setBusy(true);
    try {
      await dialog.onSubmit(values);
      toast.success("Done");
      setDialog(null);
    } catch (err) {
      toast.error("Action failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setBusy(false);
    }
  }, [dialog, values]);

  if (!organization?.id || enabled.size === 0) return null;

  const actions: Array<{ key: string; label: string; icon: React.ReactNode; onClick: () => void }> = [];

  if (enabled.has("slack")) {
    actions.push({
      key: "slack",
      label: "Notify Slack channel",
      icon: <MessageSquare className="h-3.5 w-3.5" />,
      onClick: () =>
        openDialog({
          provider: "slack",
          title: "Notify a Slack channel",
          description: `Post a message about ${leadName} to one of your Slack channels.`,
          submitLabel: "Send to Slack",
          fields: [
            { key: "channel", label: "Channel", placeholder: "#sales or channel ID" },
            {
              key: "text",
              label: "Message",
              defaultValue: `New activity on lead "${leadName}"${leadEmail ? ` (${leadEmail})` : ""}`,
              multiline: true,
            },
          ],
          onSubmit: async (v) => {
            await sendSlack({
              data: {
                organizationId: organization.id,
                leadId,
                channel: v.channel,
                text: v.text,
              },
            });
          },
        }),
    });
  }

  if (enabled.has("microsoft_teams")) {
    actions.push({
      key: "teams",
      label: "Post to Teams",
      icon: <Send className="h-3.5 w-3.5" />,
      onClick: () =>
        openDialog({
          provider: "microsoft_teams",
          title: "Post to a Teams channel",
          description: `You'll need the Team and Channel IDs from Microsoft Teams.`,
          submitLabel: "Post",
          fields: [
            { key: "teamId", label: "Team ID" },
            { key: "channelId", label: "Channel ID" },
            {
              key: "text",
              label: "Message",
              defaultValue: `New activity on lead "${leadName}"`,
              multiline: true,
            },
          ],
          onSubmit: async (v) => {
            await sendTeams({
              data: {
                organizationId: organization.id,
                leadId,
                teamId: v.teamId,
                channelId: v.channelId,
                text: v.text,
              },
            });
          },
        }),
    });
  }

  if (enabled.has("twilio") && leadPhone) {
    actions.push({
      key: "twilio",
      label: "Send SMS",
      icon: <Smartphone className="h-3.5 w-3.5" />,
      onClick: () =>
        openDialog({
          provider: "twilio",
          title: "Send an SMS",
          description: `Send a text message to ${leadPhone}.`,
          submitLabel: "Send SMS",
          fields: [
            { key: "fromNumber", label: "From (your Twilio number)", placeholder: "+15551234567" },
            { key: "toNumber", label: "To", defaultValue: leadPhone ?? "" },
            { key: "body", label: "Message", multiline: true },
          ],
          onSubmit: async (v) => {
            await sendSms({
              data: {
                organizationId: organization.id,
                leadId,
                fromNumber: v.fromNumber,
                toNumber: v.toNumber,
                body: v.body,
              },
            });
          },
        }),
    });
  }

  if (enabled.has("microsoft_outlook") && leadEmail) {
    actions.push({
      key: "outlook",
      label: "Send via Outlook",
      icon: <Mail className="h-3.5 w-3.5" />,
      onClick: () =>
        openDialog({
          provider: "microsoft_outlook",
          title: "Send email via Outlook",
          description: `Send a quick email to ${leadEmail}.`,
          submitLabel: "Send",
          fields: [
            { key: "to", label: "To", defaultValue: leadEmail ?? "" },
            { key: "subject", label: "Subject" },
            { key: "body", label: "Body", multiline: true },
          ],
          onSubmit: async (v) => {
            await sendEmail({
              data: {
                organizationId: organization.id,
                leadId,
                to: v.to,
                subject: v.subject,
                body: v.body,
              },
            });
          },
        }),
    });
  }

  if (enabled.has("linear")) {
    actions.push({
      key: "linear",
      label: "Create Linear issue",
      icon: <ListPlus className="h-3.5 w-3.5" />,
      onClick: () =>
        openDialog({
          provider: "linear",
          title: "Create a Linear issue",
          description: "File an issue for follow-up engineering work tied to this lead.",
          submitLabel: "Create issue",
          fields: [
            { key: "teamId", label: "Linear Team ID" },
            { key: "title", label: "Title", defaultValue: `Follow-up: ${leadName}` },
            { key: "description", label: "Description", multiline: true },
          ],
          onSubmit: async (v) => {
            await createIssue({
              data: {
                organizationId: organization.id,
                leadId,
                teamId: v.teamId,
                title: v.title,
                description: v.description || undefined,
              },
            });
          },
        }),
    });
  }

  if (actions.length === 0) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" title="More integrations">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-[11px]">Connected integrations</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {actions.map((a) => (
            <DropdownMenuItem key={a.key} onClick={a.onClick} className="gap-2 text-xs">
              {a.icon}
              {a.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          {dialog && (
            <>
              <DialogHeader>
                <DialogTitle>{dialog.title}</DialogTitle>
                <DialogDescription>{dialog.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                {dialog.fields.map((f) => (
                  <div key={f.key}>
                    <label className="mb-1 block text-xs font-medium text-foreground">{f.label}</label>
                    {f.multiline ? (
                      <textarea
                        className="w-full rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring resize-none"
                        rows={4}
                        placeholder={f.placeholder}
                        value={values[f.key] ?? ""}
                        onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                      />
                    ) : (
                      <input
                        className="h-9 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
                        placeholder={f.placeholder}
                        value={values[f.key] ?? ""}
                        onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
              </div>

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setDialog(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button variant="command" size="sm" onClick={handleSubmit} disabled={busy}>
                  {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  {dialog.submitLabel}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
