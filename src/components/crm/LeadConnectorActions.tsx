/**
 * Lead drawer actions — auto-populates with the org's enabled connector
 * actions (Send email via Gmail / Outlook / SendGrid, Slack, Teams, SMS, Linear).
 *
 * Each action opens a tiny prompt dialog tailored to the provider, then fires
 * the corresponding server fn. Failures surface as toasts and are recorded in
 * `connector_activity_log` server-side. Successful email sends also write to
 * the `messages` table so they appear in the lead's Activity feed.
 */
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useServerFn } from "@tanstack/react-start";
import { listEnabledConnectorsFn } from "@/functions/connectors.functions";
import {
  sendSlackMessageFn,
  sendTwilioSmsFn,
  sendOutlookEmailFn,
  sendGmailFn,
  sendSendgridLeadEmailFn,
  createLinearIssueFn,
  sendTeamsMessageFn,
  listLeadEmailProvidersFn,
  type LeadEmailProvider,
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
import {
  MoreHorizontal,
  MessageSquare,
  Send,
  Smartphone,
  Mail,
  ListPlus,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

interface LeadConnectorActionsProps {
  leadId: string;
  leadName: string;
  leadEmail: string | null;
  leadPhone: string | null;
  /** Called after a successful action so the parent can refresh activity. */
  onActed?: () => void;
}

interface DialogField {
  key: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  multiline?: boolean;
}

interface DialogState {
  provider: string;
  fields: DialogField[];
  title: string;
  description: string;
  submitLabel: string;
  onSubmit: (values: Record<string, string>) => Promise<void>;
}

const PROVIDER_LABELS: Record<string, string> = {
  gmail: "Gmail",
  microsoft_outlook: "Outlook",
  sendgrid: "SendGrid",
};

export function LeadConnectorActions({
  leadId,
  leadName,
  leadEmail,
  leadPhone,
  onActed,
}: LeadConnectorActionsProps) {
  const { organization } = useAuth();
  const listEnabled = useServerFn(listEnabledConnectorsFn);
  const listEmailProviders = useServerFn(listLeadEmailProvidersFn);
  const sendSlack = useServerFn(sendSlackMessageFn);
  const sendSms = useServerFn(sendTwilioSmsFn);
  const sendOutlook = useServerFn(sendOutlookEmailFn);
  const sendGmail = useServerFn(sendGmailFn);
  const sendSendgrid = useServerFn(sendSendgridLeadEmailFn);
  const createIssue = useServerFn(createLinearIssueFn);
  const sendTeams = useServerFn(sendTeamsMessageFn);

  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [emailProviders, setEmailProviders] = useState<LeadEmailProvider[]>([]);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!organization?.id) return;
    listEnabled({ data: { organizationId: organization.id } })
      .then((res) => setEnabled(new Set(res.enabled.map((e) => e.provider))))
      .catch(() => setEnabled(new Set()));
    listEmailProviders({ data: { organizationId: organization.id } })
      .then((res) => setEmailProviders(res.providers ?? []))
      .catch(() => setEmailProviders([]));
  }, [organization?.id, listEnabled, listEmailProviders]);

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
      onActed?.();
    } catch (err) {
      toast.error("Action failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setBusy(false);
    }
  }, [dialog, values, onActed]);

  // Open the email-compose dialog for a chosen provider.
  const openEmailDialog = useCallback(
    (p: LeadEmailProvider) => {
      if (!organization?.id || !leadEmail) return;

      const providerLabel = PROVIDER_LABELS[p.provider] ?? p.label;
      const fields: DialogField[] = [
        { key: "to", label: "To", defaultValue: leadEmail },
        {
          key: "fromAddress",
          label: "From",
          defaultValue: p.defaultFromAddress ?? "",
          placeholder:
            p.provider === "sendgrid"
              ? "you@yourdomain.com (must be a verified sender)"
              : "you@example.com (optional)",
        },
        { key: "subject", label: "Subject" },
        { key: "body", label: "Body", multiline: true },
      ];

      openDialog({
        provider: p.provider,
        title: `Send email via ${providerLabel}`,
        description: `Send a quick email to ${leadEmail}.`,
        submitLabel: `Send via ${providerLabel}`,
        fields,
        onSubmit: async (v) => {
          const payload = {
            organizationId: organization.id,
            leadId,
            to: v.to.trim(),
            subject: v.subject.trim(),
            body: v.body,
            ...(v.fromAddress?.trim() ? { fromAddress: v.fromAddress.trim() } : {}),
          };
          if (p.provider === "gmail") {
            await sendGmail({ data: payload });
          } else if (p.provider === "microsoft_outlook") {
            // Outlook fn doesn't accept fromAddress — strip it before sending.
            const { fromAddress: _drop, ...rest } = payload as typeof payload & {
              fromAddress?: string;
            };
            void _drop;
            await sendOutlook({ data: rest });
          } else if (p.provider === "sendgrid") {
            await sendSendgrid({ data: payload });
          } else {
            throw new Error(`Unknown email provider: ${p.provider}`);
          }
        },
      });
    },
    [organization?.id, leadId, leadEmail, sendGmail, sendOutlook, sendSendgrid],
  );

  if (!organization?.id) return null;

  // ===== Build the "More actions" list (chat / SMS / tasks) =====
  const moreActions: Array<{
    key: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
  }> = [];

  if (enabled.has("slack")) {
    moreActions.push({
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
    moreActions.push({
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
    moreActions.push({
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

  if (enabled.has("linear")) {
    moreActions.push({
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

  // Email picker is rendered as its own button so it's discoverable. Only show
  // when we have at least one email provider AND the lead has an address.
  const showEmailPicker = emailProviders.length > 0 && !!leadEmail;

  if (moreActions.length === 0 && !showEmailPicker) return null;

  return (
    <>
      {/* Send email — single-button shortcut OR provider picker dropdown */}
      {showEmailPicker && emailProviders.length === 1 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => openEmailDialog(emailProviders[0])}
          title={`Send email via ${PROVIDER_LABELS[emailProviders[0].provider] ?? emailProviders[0].label}`}
        >
          <Mail className="mr-1.5 h-3.5 w-3.5" />
          Email
        </Button>
      )}

      {showEmailPicker && emailProviders.length > 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" title="Send email via…">
              <Mail className="mr-1 h-3.5 w-3.5" />
              Email
              <ChevronDown className="ml-0.5 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-[11px]">Send email via</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {emailProviders.map((p) => (
              <DropdownMenuItem
                key={p.provider}
                onClick={() => openEmailDialog(p)}
                className="gap-2 text-xs"
              >
                <Mail className="h-3.5 w-3.5" />
                <span className="flex-1">{PROVIDER_LABELS[p.provider] ?? p.label}</span>
                {p.defaultFromAddress && (
                  <span className="text-[10px] text-muted-foreground truncate max-w-[110px]">
                    {p.defaultFromAddress}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Other actions menu (chat, SMS, tasks) */}
      {moreActions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" title="More integrations">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-[11px]">Connected integrations</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {moreActions.map((a) => (
              <DropdownMenuItem key={a.key} onClick={a.onClick} className="gap-2 text-xs">
                {a.icon}
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={!!dialog} onOpenChange={(o) => !o && !busy && setDialog(null)}>
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
                    <label className="mb-1 block text-xs font-medium text-foreground">
                      {f.label}
                    </label>
                    {f.multiline ? (
                      <textarea
                        className="w-full rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring resize-none"
                        rows={6}
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
