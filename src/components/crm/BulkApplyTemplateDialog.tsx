import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth/AuthProvider";
import { useServerFn } from "@tanstack/react-start";
import {
  listOutreachTemplatesFn,
  type OutreachTemplate,
} from "@/functions/outreach-templates.functions";
import { autoOutreachFn } from "@/functions/auto-outreach.functions";

/**
 * Bulk apply an outreach template to a multi-selection of recipients.
 *
 * Each recipient is a lead-shaped record (id + name + email). The autoOutreach
 * server function takes the chosen template, runs AI personalization per lead,
 * and sends through the org's configured delivery channels.
 *
 * Used from the Follow-up Inbox and Contact Submissions inboxes so owners can
 * fire one personalized template across many follow-ups at once.
 */

export interface BulkRecipient {
  /** Lead UUID — required by autoOutreachFn. Items without a lead_id are filtered upstream. */
  id: string;
  name: string;
  email?: string | null;
  company?: string | null;
  role?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipients: BulkRecipient[];
  /** Called after a successful send — typically to refresh the list. */
  onSent?: () => void;
}

export function BulkApplyTemplateDialog({ open, onOpenChange, recipients, onSent }: Props) {
  const { organization } = useAuth();
  const listTemplates = useServerFn(listOutreachTemplatesFn);
  const runOutreach = useServerFn(autoOutreachFn);

  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [templateId, setTemplateId] = useState<string>("");
  const [businessContext, setBusinessContext] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !organization?.id) return;
    setLoading(true);
    listTemplates({ data: { organizationId: organization.id } })
      .then((rows) => {
        setTemplates(rows);
        const def = rows.find((r) => r.is_default) ?? rows[0];
        if (def) setTemplateId(def.id);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Couldn't load templates"))
      .finally(() => setLoading(false));
  }, [open, organization?.id, listTemplates]);

  const eligible = recipients.filter((r) => r.email && r.id);
  const skipped = recipients.length - eligible.length;

  const handleSend = async () => {
    if (!organization?.id) return;
    if (!templateId) {
      toast.error("Pick a template first");
      return;
    }
    if (eligible.length === 0) {
      toast.error("None of the selected items have an email + matched lead");
      return;
    }
    setSending(true);
    try {
      const result = await runOutreach({
        data: {
          organizationId: organization.id,
          templateId,
          businessContext: businessContext.trim() || undefined,
          leads: eligible.slice(0, 50).map((r) => ({
            id: r.id,
            name: r.name || "there",
            email: r.email!,
            company: r.company ?? undefined,
            role: r.role ?? undefined,
          })),
        },
      });
      const sent = result?.sent ?? 0;
      const skippedCount = (result?.skipped ?? 0) + skipped;
      if (sent > 0)
        toast.success(
          `Sent ${sent} personalized emails${skippedCount ? ` · ${skippedCount} skipped` : ""}`,
        );
      else toast.error(`No emails sent${result?.errors?.[0] ? ` — ${result.errors[0]}` : ""}`);
      onOpenChange(false);
      onSent?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !sending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Apply template to {recipients.length} selected
          </DialogTitle>
          <DialogDescription>
            Pick a saved outreach template — the AI personalizes it per recipient before sending.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Template</label>
            {loading ? (
              <div className="flex items-center text-xs text-muted-foreground">
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : templates.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                No templates yet. Create one in Settings → Outreach.
              </div>
            ) : (
              <Select value={templateId} onValueChange={setTemplateId} disabled={sending}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} {t.is_default && "· default"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Extra context <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              rows={3}
              value={businessContext}
              onChange={(e) => setBusinessContext(e.target.value)}
              placeholder="Anything the AI should mention — campaign, offer, recent news…"
              disabled={sending}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{eligible.length} ready</Badge>
            {skipped > 0 && <Badge variant="outline">{skipped} skipped (no email/lead)</Badge>}
            {eligible.length > 50 && (
              <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                only first 50 will be processed
              </Badge>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || loading || !templateId || eligible.length === 0}
          >
            {sending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Personalize & send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
