/**
 * Per-lead "Suggest follow-up" button.
 *
 * Calls the suggest-followup edge function for a single lead and opens
 * a dialog with the AI-drafted subject + message + reasoning. The owner
 * can either:
 *   - Send now: copies content to clipboard so they can paste into their
 *     mail client (we intentionally don't auto-send to keep humans in the
 *     loop and avoid surprises with deliverability rules).
 *   - Save to inbox: marks the suggestion as pending in the followup inbox
 *     so a teammate can review/approve later.
 */
import { useState } from "react";
import { Bot, Loader2, Copy, Inbox } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface Suggestion {
  id?: string;
  subject: string;
  message: string;
  reasoning?: string;
}

export function LeadFollowupButton({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Suggestion | null>(null);

  const generate = async () => {
    setLoading(true);
    setOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-followup", {
        body: { mode: "lead", lead_id: leadId },
      });
      if (error) throw error;
      const sug = (data as { suggestion?: Suggestion })?.suggestion ?? null;
      if (!sug) throw new Error("No suggestion returned");
      // Function already saves to inbox (status: pending). The button gives
      // the user a chance to copy/edit immediately so they're not forced
      // to switch contexts.
      setDraft({ subject: sug.subject ?? "", message: sug.message ?? "", reasoning: sug.reasoning });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate";
      toast.error(msg);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!draft) return;
    await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.message}`);
    toast.success("Copied draft — paste into your mail client.");
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={generate} disabled={loading}>
        {loading ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Bot className="mr-1.5 h-3.5 w-3.5" />
        )}
        AI follow-up
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>AI-drafted follow-up</DialogTitle>
            <DialogDescription>
              Edit before sending. Copy to your mail client, or queue in the follow-up inbox for review.
            </DialogDescription>
          </DialogHeader>

          {loading || !draft ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Drafting…
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Subject</label>
                <Input
                  value={draft.subject}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Message</label>
                <Textarea
                  rows={8}
                  value={draft.message}
                  onChange={(e) => setDraft({ ...draft, message: e.target.value })}
                />
              </div>
              {draft.reasoning && (
                <p className="rounded border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
                  <strong>Why:</strong> {draft.reasoning}
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button onClick={copyToClipboard} disabled={!draft}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copy draft
            </Button>
          </DialogFooter>
          {draft && (
            <p className="text-[11px] text-muted-foreground">
              <Inbox className="mr-1 inline h-3 w-3" />
              Also queued in the follow-up inbox for your team to review.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
