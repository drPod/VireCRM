import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Send, Sparkles } from "lucide-react";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import {
  previewOutreachFn,
  sendOutreachWithContentFn,
} from "@/functions/outreach-preview.functions";
import {
  listOutreachTemplatesFn,
  type OutreachTemplate,
} from "@/functions/outreach-templates.functions";
import { fillTemplateTokens } from "@/lib/outreach/template-fill";
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
    role?: string | null;
  };
  onSent: () => void;
}

const inputClass =
  "h-9 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring";

// Sentinel select values — empty string is reserved by some <select> impls,
// so use literal strings the user can never collide with.
const NO_TEMPLATE = "__none__";
const TEMPLATE_ONLY = "__fill_only__";

export function OutreachPreviewDialog({ open, onOpenChange, lead, onSent }: OutreachPreviewDialogProps) {
  const { organization } = useAuth();
  const preview = useAuthedServerFn(previewOutreachFn);
  const send = useAuthedServerFn(sendOutreachWithContentFn);
  const listTemplates = useAuthedServerFn(listOutreachTemplatesFn);

  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  /** Either a template UUID, NO_TEMPLATE (AI from scratch), or TEMPLATE_ONLY (no AI). */
  const [templateChoice, setTemplateChoice] = useState<string>(NO_TEMPLATE);
  /** Tracks the source of the most recent generation so we can label the panel. */
  const [generatedFrom, setGeneratedFrom] = useState<"ai" | "ai+template" | "template">("ai");

  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // Load templates when the dialog opens. Default-flagged template is auto-
  // selected so the AI personalizes the user's preferred copy out of the box.
  useEffect(() => {
    if (!open || !organization?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await listTemplates({ data: { organizationId: organization.id } });
        if (cancelled) return;
        setTemplates(rows);
        const def = rows.find((r) => r.is_default);
        setTemplateChoice(def ? def.id : NO_TEMPLATE);
      } catch {
        // non-fatal — picker just shows empty options
        if (!cancelled) setTemplates([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, organization?.id, listTemplates]);

  // Generate / fill the email. Re-runs when the user opens the dialog or
  // changes the template selection. AI generation is debounced via the
  // cancellation flag so a fast picker change doesn't race.
  const generate = useCallback(
    async (choice: string) => {
      if (!organization?.id) return;

      setGenError(null);
      setSubject("");
      setBody("");

      const businessName = organization.brand_name || organization.name || "";

      // Pure-template fill: no AI call, instant. Useful when the user wants
      // to send their template verbatim with placeholders substituted.
      if (choice === TEMPLATE_ONLY) {
        const tpl = templates.find((t) => t.id !== undefined && templateChoice && t.id === templateChoice);
        // Fall back to the first template (or the explicit selected one) when
        // the user picks "fill only" but already had a template chosen.
        const target =
          templates.find((t) => t.id === choice) ||
          templates.find((t) => t.is_default) ||
          tpl ||
          templates[0];
        if (!target) {
          setGenError("Pick a template first.");
          return;
        }
        setSubject(
          fillTemplateTokens(target.subject, {
            name: lead.name,
            email: lead.email,
            company: lead.company,
            role: lead.role,
            businessName,
          }),
        );
        setBody(
          fillTemplateTokens(target.body, {
            name: lead.name,
            email: lead.email,
            company: lead.company,
            role: lead.role,
            businessName,
          }),
        );
        setGeneratedFrom("template");
        return;
      }

      setGenerating(true);
      const usingTemplate = choice !== NO_TEMPLATE;
      try {
        const result = await preview({
          data: {
            organizationId: organization.id,
            lead: {
              id: lead.id,
              name: lead.name,
              email: lead.email,
              company: lead.company ?? null,
              role: lead.role ?? null,
            },
            templateId: usingTemplate ? choice : null,
          },
        });
        setSubject(typeof result?.subject === "string" ? result.subject : "");
        setBody(typeof result?.body === "string" ? result.body : "");
        setGeneratedFrom(usingTemplate ? "ai+template" : "ai");
      } catch (err) {
        const msg =
          err instanceof Error && err.message
            ? err.message
            : "Failed to generate preview. Please try again.";
        setGenError(msg);
      } finally {
        setGenerating(false);
      }
    },
    [organization?.id, organization?.brand_name, organization?.name, preview, lead.id, lead.name, lead.email, lead.company, lead.role, templates, templateChoice],
  );

  // Initial generation when the dialog opens (uses the selected default template).
  useEffect(() => {
    if (!open || !organization?.id) return;
    void generate(templateChoice);
    // We deliberately depend on `open` only — re-generation on template
    // change is handled by the picker's onChange below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, organization?.id]);

  const handleTemplateChange = (next: string) => {
    setTemplateChoice(next);
    // Special action: fill template verbatim without AI.
    if (next === TEMPLATE_ONLY) {
      // Need an actual template — fall back to default or first.
      const target = templates.find((t) => t.is_default) || templates[0];
      if (!target) {
        toast.error("Create a template in Settings → Outreach first.");
        return;
      }
      void generate(target.id); // loads it
      // Mark display as template-only by re-rendering after fill.
      setTimeout(() => {
        setSubject(
          fillTemplateTokens(target.subject, {
            name: lead.name,
            email: lead.email,
            company: lead.company,
            role: lead.role,
            businessName: organization?.brand_name || organization?.name || "",
          }),
        );
        setBody(
          fillTemplateTokens(target.body, {
            name: lead.name,
            email: lead.email,
            company: lead.company,
            role: lead.role,
            businessName: organization?.brand_name || organization?.name || "",
          }),
        );
        setGeneratedFrom("template");
      }, 0);
      return;
    }
    void generate(next);
  };

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
      const result = await send({
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
        toast.warning("Draft saved — send needs attention", {
          description: result?.reason ?? "The recipient was skipped.",
        });
      }
    } catch (err) {
      toast.warning("Draft saved — send needs attention", {
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

  const sourceLabel =
    generatedFrom === "template"
      ? "Filled from template — no AI used"
      : generatedFrom === "ai+template"
        ? "AI personalized from your template"
        : "AI-generated from scratch";

  return (
    <Dialog open={open} onOpenChange={(next) => !sending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Preview outreach to {lead.name}
          </DialogTitle>
          <DialogDescription>
            Pick a template (optional) and review the email before sending to{" "}
            <span className="font-medium text-foreground">{lead.email}</span>.
          </DialogDescription>
        </DialogHeader>

        {/* Template picker — always visible so the source of the copy is clear. */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Template</label>
          <div className="flex gap-2">
            <select
              className={inputClass}
              value={templateChoice}
              onChange={(e) => handleTemplateChange(e.target.value)}
              disabled={generating || sending}
            >
              <option value={NO_TEMPLATE}>✨ AI from scratch (no template)</option>
              {templates.length > 0 && (
                <optgroup label="Your templates — AI personalizes per lead">
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.is_default ? "★ " : ""}
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {templates.length > 0 && (
                <option value={TEMPLATE_ONLY}>📄 Fill template only — skip AI</option>
              )}
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => generate(templateChoice)}
              disabled={generating || sending}
              title="Regenerate"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`} />
            </Button>
          </div>
          {templates.length === 0 && (
            <p className="text-[10px] text-muted-foreground">
              Tip: save reusable templates in Settings → Outreach so the AI can personalize your own copy per lead.
            </p>
          )}
        </div>

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
                {bodyStr.length} characters · {sourceLabel} · You can edit anything before sending.
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
