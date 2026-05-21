import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useServerFn } from "@tanstack/react-start";
import {
  listOutreachTemplatesFn,
  upsertOutreachTemplateFn,
  deleteOutreachTemplateFn,
  type OutreachTemplate,
} from "@/functions/outreach-templates.functions";
import { TEMPLATE_TOKENS } from "@/lib/outreach/template-fill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { FileText, Loader2, Pencil, Plus, Sparkles, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Outreach template manager. Lives in Settings → Outreach.
 *
 * Templates are reusable email skeletons (subject + body) the AI
 * personalizes per lead. Placeholders like {{first_name}} and {{company}}
 * get filled with each lead's data before AI rewriting.
 *
 * Owners + managers can edit; everyone else sees them read-only.
 */

const inputClass =
  "h-9 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring";

const textareaClass =
  "w-full rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed";

interface DraftState {
  id?: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  isDefault: boolean;
}

const EMPTY_DRAFT: DraftState = {
  name: "",
  description: "",
  subject: "",
  body: "",
  isDefault: false,
};

export function OutreachTemplatesManager() {
  const { organization, role } = useAuth();
  const canEdit = role?.role === "owner" || role?.role === "manager";

  const list = useServerFn(listOutreachTemplatesFn);
  const upsert = useServerFn(upsertOutreachTemplateFn);
  const remove = useServerFn(deleteOutreachTemplateFn);

  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OutreachTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    try {
      const rows = await list({ data: { organizationId: organization.id } });
      setTemplates(rows);
    } catch (err) {
      console.warn("Failed to load templates", err);
      toast.error("Couldn't load templates");
    } finally {
      setLoading(false);
    }
  }, [organization?.id, list]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openCreate = () => {
    setDraft(EMPTY_DRAFT);
    setEditorOpen(true);
  };

  const openEdit = (tpl: OutreachTemplate) => {
    setDraft({
      id: tpl.id,
      name: tpl.name,
      description: tpl.description ?? "",
      subject: tpl.subject,
      body: tpl.body,
      isDefault: tpl.is_default,
    });
    setEditorOpen(true);
  };

  const handleInsertToken = (token: string) => {
    setDraft((d) => ({
      ...d,
      body: `${d.body}${d.body && !d.body.endsWith(" ") ? " " : ""}${token}`,
    }));
  };

  const handleSave = async () => {
    if (!organization?.id) return;
    if (!draft.name.trim() || !draft.subject.trim() || !draft.body.trim()) {
      toast.error("Name, subject, and body are required");
      return;
    }
    setSaving(true);
    try {
      await upsert({
        data: {
          organizationId: organization.id,
          id: draft.id,
          name: draft.name,
          description: draft.description || null,
          subject: draft.subject,
          body: draft.body,
          isDefault: draft.isDefault,
        },
      });
      toast.success(draft.id ? "Template updated" : "Template created");
      setEditorOpen(false);
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!organization?.id || !deleteTarget) return;
    setDeleting(true);
    try {
      await remove({
        data: { organizationId: organization.id, id: deleteTarget.id },
      });
      toast.success("Template deleted");
      setDeleteTarget(null);
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete template");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Outreach templates
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Reusable email skeletons your AI uses as the base for personalized outreach to each
            lead.
          </p>
        </div>
        {canEdit && (
          <Button variant="command" size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New template
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Loading templates…
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center space-y-2">
          <Sparkles className="h-6 w-6 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium text-foreground">No templates yet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Create your first template — write the email how you'd send it manually, and the AI will
            personalize it for each lead before sending.
          </p>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={openCreate} className="mt-2">
              <Plus className="h-4 w-4" />
              Create template
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((tpl) => (
            <div key={tpl.id} className="rounded-lg border border-border bg-card p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{tpl.name}</span>
                    {tpl.is_default && (
                      <Badge variant="info" className="text-[10px]">
                        <Star className="h-2.5 w-2.5 mr-0.5" />
                        Default
                      </Badge>
                    )}
                  </div>
                  {tpl.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {tpl.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground/80 mt-1 truncate">
                    <span className="font-medium text-foreground">Subject:</span> {tpl.subject}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(tpl)}
                      title="Edit template"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(tpl)}
                      title="Delete template"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor dialog */}
      <Dialog open={editorOpen} onOpenChange={(v) => !saving && setEditorOpen(v)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Edit template" : "New outreach template"}</DialogTitle>
            <DialogDescription>
              Use placeholders like <code className="text-foreground">{"{{first_name}}"}</code> and{" "}
              <code className="text-foreground">{"{{company}}"}</code> — the AI fills them with each
              lead's data and personalizes the rest.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                Name <span className="text-destructive">*</span>
              </label>
              <input
                className={inputClass}
                placeholder="e.g. SaaS founder intro"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                disabled={saving}
                maxLength={120}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                className={inputClass}
                placeholder="When to use this template"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                disabled={saving}
                maxLength={500}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                Subject line <span className="text-destructive">*</span>
              </label>
              <input
                className={inputClass}
                placeholder="Quick question, {{first_name}}"
                value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                disabled={saving}
                maxLength={200}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                Body <span className="text-destructive">*</span>
              </label>
              <textarea
                className={textareaClass}
                rows={10}
                placeholder={
                  "Hey {{first_name}},\n\nI saw {{company}} is doing great work in your space — wanted to reach out because…"
                }
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                disabled={saving}
                maxLength={10000}
              />
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground mr-1">Insert:</span>
                {TEMPLATE_TOKENS.map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => handleInsertToken(token)}
                    disabled={saving}
                    className="rounded-md border border-border bg-secondary/40 px-1.5 py-0.5 text-[10px] font-mono text-foreground hover:bg-secondary disabled:opacity-50"
                  >
                    {token}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                {draft.body.length} characters · The AI keeps your structure and tone, only
                personalizing per lead.
              </p>
            </div>

            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={draft.isDefault}
                onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })}
                disabled={saving}
                className="h-4 w-4 rounded border-input"
              />
              <span>
                <span className="font-medium">Use as default template</span>{" "}
                <span className="text-muted-foreground">— auto-selected when sending outreach</span>
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditorOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button variant="command" size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {draft.id ? "Save changes" : "Create template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && !deleting && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" will be removed permanently. Outreach in flight using it isn't
              affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Delete template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
