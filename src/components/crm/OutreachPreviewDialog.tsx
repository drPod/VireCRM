import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Sparkles } from "lucide-react";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import {
  previewOutreachFn,
  sendOutreachWithContentFn,
} from "@/functions/outreach-preview.functions";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";

interface OutreachPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: {
    id: string;
    name: string;
    email: string;
    company?: string | null;
  };
  onSent: () => void;
}

const inputClass =
  "h-9 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring";

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("You're not signed in. Please log in again.");
  return { Authorization: `Bearer ${token}` };
}

export function OutreachPreviewDialog({ open, onOpenChange, lead, onSent }: OutreachPreviewDialogProps) {
  const { organization } = useAuth();
  const preview = useServerFn(previewOutreachFn);
  const send = useServerFn(sendOutreachWithContentFn);

  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // Generate the email when the dialog opens. Reset state on close so reopening
  // always produces a fresh draft (avoids the "stale email" footgun).
  useEffect(() => {
    if (!open || !organization?.id) return;

    let cancelled = false;
    setGenerating(true);
    setGenError(null);
    setSubject("");
    setBody("");

    (async () => {
      try {
        const headers = await getAuthHeader();
        const result = await preview({
          headers,
          data: {
            organizationId: organization.id,
            lead: {
              id: lead.id,
              name: lead.name,
              email: lead.email,
              company: lead.company ?? null,
            },
          },
        });
        if (cancelled) return;
        setSubject(typeof result?.subject === "string" ? result.subject : "");
        setBody(typeof result?.body === "string" ? result.body : "");
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error && err.message
            ? err.message
            : "Failed to generate preview. Please try again.";
        setGenError(msg);
      } finally {
        if (!cancelled) setGenerating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, organization?.id, lead.id, lead.name, lead.email, lead.company, preview]);

  const handleSend = async () => {
    if (!organization?.id) return;
    const safeSubject = (subject ?? "").trim();
    const safeBody = (body ?? "").trim();
    if (!safeSubject || !safeBody) {
      toast.error("Subject and body cannot be empty");
      return;
    }
    setSending(true);
    try {
      const headers = await getAuthHeader();
      const result = await send({
        headers,
        data: {
          organizationId: organization.id,
          leadId: lead.id,
          recipientEmail: lead.email,
          subject: safeSubject,
          body: safeBody,
        },
      });

      if (result?.success) {
        toast.success("Outreach sent!", {
          description: `Email dispatched to ${lead.email}`,
        });
        onSent();
        onOpenChange(false);
      } else {
        toast.error("Email not sent", {
          description: result?.reason ?? "The recipient was skipped.",
        });
      }
    } catch (err) {
      toast.error("Failed to send outreach", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSending(false);
    }
  };

  const subjectStr = subject ?? "";
  const bodyStr = body ?? "";
  const canSend =
    !generating && !sending && !genError && subjectStr.trim().length > 0 && bodyStr.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !sending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Preview outreach to {lead.name}
          </DialogTitle>
          <DialogDescription>
            Review and edit the AI-generated email before sending to{" "}
            <span className="font-medium text-foreground">{lead.email}</span>.
          </DialogDescription>
        </DialogHeader>

        {generating ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Generating personalized email…
          </div>
        ) : genError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {genError}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Subject</label>
              <input
                className={inputClass}
                value={subjectStr}
                onChange={(e) => setSubject(e.target.value)}
                disabled={sending}
                maxLength={200}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Body</label>
              <textarea
                className="w-full rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring resize-none font-mono leading-relaxed"
                rows={10}
                value={bodyStr}
                onChange={(e) => setBody(e.target.value)}
                disabled={sending}
                maxLength={10000}
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                {bodyStr.length} characters · You can edit anything before sending.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            variant="command"
            size="sm"
            onClick={handleSend}
            disabled={!canSend}
          >
            {sending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-3.5 w-3.5" />
            )}
            Send email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
