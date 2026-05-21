import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useServerFn } from "@tanstack/react-start";
import {
  listSequencesFn,
  upsertSequenceFn,
  deleteSequenceFn,
  listStepsFn,
  upsertStepFn,
  deleteStepFn,
  listEnrollmentsFn,
  enrollLeadsFn,
  updateEnrollmentStatusFn,
  listSequenceLogFn,
  type OutreachSequence,
  type OutreachSequenceStep,
  type SequenceEnrollment,
  type StepLogRow,
} from "@/functions/outreach-sequences.functions";
import {
  listOutreachTemplatesFn,
  type OutreachTemplate,
} from "@/functions/outreach-templates.functions";
import { supabase } from "@/integrations/supabase/client";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Send,
  Plus,
  Loader2,
  Trash2,
  Play,
  Pause,
  Users,
  Clock,
  StopCircle,
  CheckCircle2,
  Mail,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/sequences")({
  component: SequencesPage,
  head: () => ({
    meta: [{ title: "Sequences — VireCRM" }],
  }),
});

interface LeadOption {
  id: string;
  name: string;
  email: string | null;
}

function SequencesPage() {
  const { organization } = useAuth();
  const orgId = organization?.id;

  const listSeq = useServerFn(listSequencesFn);
  const upsertSeq = useServerFn(upsertSequenceFn);
  const deleteSeq = useServerFn(deleteSequenceFn);
  const listSteps = useServerFn(listStepsFn);
  const upsertStep = useServerFn(upsertStepFn);
  const deleteStep = useServerFn(deleteStepFn);
  const listEnroll = useServerFn(listEnrollmentsFn);
  const enroll = useServerFn(enrollLeadsFn);
  const updateEnroll = useServerFn(updateEnrollmentStatusFn);
  const listLog = useServerFn(listSequenceLogFn);
  const listTemplates = useServerFn(listOutreachTemplatesFn);

  const [sequences, setSequences] = useState<OutreachSequence[]>([]);
  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [steps, setSteps] = useState<OutreachSequenceStep[]>([]);
  const [enrollments, setEnrollments] = useState<SequenceEnrollment[]>([]);
  const [log, setLog] = useState<StepLogRow[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [newSeqOpen, setNewSeqOpen] = useState(false);
  const [newSeqName, setNewSeqName] = useState("");
  const [newSeqDesc, setNewSeqDesc] = useState("");

  const [stepEditor, setStepEditor] = useState<{
    open: boolean;
    step: Partial<OutreachSequenceStep> | null;
  }>({ open: false, step: null });

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  const refreshSequences = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const rows = await listSeq({ data: { organizationId: orgId } });
      setSequences(rows);
      if (!selectedId && rows.length) setSelectedId(rows[0].id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load sequences");
    } finally {
      setLoading(false);
    }
  }, [orgId, listSeq, selectedId]);

  const refreshDetail = useCallback(async () => {
    if (!orgId || !selectedId) return;
    try {
      const [s, e, l] = await Promise.all([
        listSteps({ data: { organizationId: orgId, sequenceId: selectedId } }),
        listEnroll({ data: { organizationId: orgId, sequenceId: selectedId } }),
        listLog({ data: { organizationId: orgId, sequenceId: selectedId } }),
      ]);
      setSteps(s);
      setEnrollments(e);
      setLog(l);
    } catch (err) {
      console.warn("refreshDetail", err);
    }
  }, [orgId, selectedId, listSteps, listEnroll, listLog]);

  // Initial loads
  useEffect(() => {
    void refreshSequences();
  }, [refreshSequences]);

  useEffect(() => {
    void refreshDetail();
  }, [refreshDetail]);

  useEffect(() => {
    if (!orgId) return;
    listTemplates({ data: { organizationId: orgId } })
      .then(setTemplates)
      .catch(() => {});
    supabase
      .from("leads")
      .select("id, name, email")
      .eq("organization_id", orgId)
      .not("email", "is", null)
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => setLeads((data || []) as LeadOption[]));
  }, [orgId, listTemplates]);

  const selected = useMemo(
    () => sequences.find((s) => s.id === selectedId) || null,
    [sequences, selectedId],
  );

  const handleCreate = async () => {
    if (!orgId || !newSeqName.trim()) return;
    try {
      const created = await upsertSeq({
        data: {
          organizationId: orgId,
          name: newSeqName.trim(),
          description: newSeqDesc.trim() || null,
          status: "draft",
        },
      });
      toast.success("Sequence created");
      setNewSeqOpen(false);
      setNewSeqName("");
      setNewSeqDesc("");
      setSelectedId(created.id);
      void refreshSequences();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create");
    }
  };

  const toggleSequenceStatus = async (s: OutreachSequence) => {
    if (!orgId) return;
    const next = s.status === "active" ? "paused" : "active";
    try {
      await upsertSeq({ data: { organizationId: orgId, id: s.id, name: s.name, status: next } });
      void refreshSequences();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const handleDeleteSequence = async (s: OutreachSequence) => {
    if (!orgId) return;
    if (!confirm(`Delete "${s.name}"? This cancels all enrollments.`)) return;
    try {
      await deleteSeq({ data: { organizationId: orgId, id: s.id } });
      if (selectedId === s.id) setSelectedId(null);
      void refreshSequences();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const openNewStep = () => {
    const nextIndex = steps.length ? Math.max(...steps.map((s) => s.step_index)) + 1 : 0;
    setStepEditor({
      open: true,
      step: {
        step_index: nextIndex,
        delay_days: nextIndex === 0 ? 0 : 3,
        delay_hours: 0,
        is_active: true,
        template_id: null,
        subject_override: "",
        body_override: "",
      },
    });
  };

  const handleSaveStep = async () => {
    if (!orgId || !selectedId || !stepEditor.step) return;
    const s = stepEditor.step;
    if (!s.template_id && (!s.subject_override?.trim() || !s.body_override?.trim())) {
      toast.error("Pick a template or write subject + body");
      return;
    }
    try {
      await upsertStep({
        data: {
          organizationId: orgId,
          sequenceId: selectedId,
          id: s.id,
          step_index: s.step_index ?? 0,
          template_id: s.template_id || null,
          subject_override: s.subject_override || null,
          body_override: s.body_override || null,
          delay_days: s.delay_days ?? 0,
          delay_hours: s.delay_hours ?? 0,
          is_active: s.is_active ?? true,
        },
      });
      toast.success("Step saved");
      setStepEditor({ open: false, step: null });
      void refreshDetail();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const handleDeleteStep = async (id: string) => {
    if (!orgId) return;
    if (!confirm("Delete this step?")) return;
    try {
      await deleteStep({ data: { organizationId: orgId, id } });
      void refreshDetail();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const handleEnroll = async () => {
    if (!orgId || !selectedId || !selectedLeadIds.length) return;
    try {
      const res = await enroll({
        data: { organizationId: orgId, sequenceId: selectedId, leadIds: selectedLeadIds },
      });
      toast.success(`${res.enrolled} lead(s) enrolled`);
      setEnrollOpen(false);
      setSelectedLeadIds([]);
      void refreshDetail();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const enrolledLeadIds = useMemo(() => new Set(enrollments.map((e) => e.lead_id)), [enrollments]);

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 p-4">
      {/* Sequences list */}
      <Card className="w-72 flex flex-col p-3 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            Sequences
          </h2>
          <Button size="sm" variant="command" onClick={() => setNewSeqOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
            </div>
          ) : sequences.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8 px-2">
              No sequences yet. Create one to schedule multi-step outreach.
            </p>
          ) : (
            sequences.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`w-full text-left rounded-lg border p-2.5 transition-colors ${
                  selectedId === s.id
                    ? "border-primary/60 bg-primary/5"
                    : "border-border hover:bg-secondary/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{s.name}</span>
                  <Badge
                    variant={s.status === "active" ? "default" : "secondary"}
                    className="text-[10px] uppercase shrink-0"
                  >
                    {s.status}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {s._counts?.active ?? 0} active · {s._counts?.total ?? 0} total
                </p>
              </button>
            ))
          )}
        </div>
      </Card>

      {/* Detail */}
      <div className="flex-1 min-w-0 overflow-y-auto space-y-4">
        {!selected ? (
          <Card className="p-12 text-center">
            <Send className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-semibold">Pick or create a sequence</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Sequences send a series of timed emails to enrolled leads and stop automatically when
              they reply or book a meeting.
            </p>
          </Card>
        ) : (
          <>
            {/* Header */}
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-semibold truncate">{selected.name}</h1>
                    <Badge variant={selected.status === "active" ? "default" : "secondary"}>
                      {selected.status}
                    </Badge>
                  </div>
                  {selected.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{selected.description}</p>
                  )}
                  <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-muted-foreground">
                    {selected.stop_on_reply && <span>✓ Stop on reply</span>}
                    {selected.stop_on_meeting_booked && <span>✓ Stop on meeting</span>}
                    <span>
                      <Clock className="inline h-3 w-3 mr-0.5" />
                      Send {selected.send_window_start_hour}:00–{selected.send_window_end_hour}:00
                      UTC
                      {selected.send_on_weekends ? "" : " (weekdays)"}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleSequenceStatus(selected)}
                  >
                    {selected.status === "active" ? (
                      <>
                        <Pause className="h-3.5 w-3.5" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" /> Activate
                      </>
                    )}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteSequence(selected)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>

            {/* Steps */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  Steps ({steps.length})
                </h2>
                <Button size="sm" variant="command" onClick={openNewStep}>
                  <Plus className="h-3.5 w-3.5" /> Add step
                </Button>
              </div>
              {steps.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No steps yet. Add the first email to start the sequence.
                </p>
              ) : (
                <div className="space-y-2">
                  {steps.map((s, i) => {
                    const tpl = templates.find((t) => t.id === s.template_id);
                    return (
                      <div
                        key={s.id}
                        className="rounded-lg border border-border p-3 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">
                              Step {i + 1}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {i === 0
                                ? `Send ${s.delay_days}d ${s.delay_hours}h after enrollment`
                                : `Wait ${s.delay_days}d ${s.delay_hours}h after previous`}
                            </span>
                            {!s.is_active && (
                              <Badge variant="secondary" className="text-[10px]">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium mt-1 truncate">
                            {s.subject_override || tpl?.subject || "(no subject)"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {tpl ? `Template: ${tpl.name}` : "Inline body"}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setStepEditor({ open: true, step: s })}
                          >
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteStep(s.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Enrollments */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Enrolled leads ({enrollments.length})
                </h2>
                <Button
                  size="sm"
                  variant="command"
                  onClick={() => setEnrollOpen(true)}
                  disabled={steps.length === 0}
                >
                  <Plus className="h-3.5 w-3.5" /> Enroll leads
                </Button>
              </div>
              {enrollments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No leads enrolled yet.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {enrollments.slice(0, 50).map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded-lg border border-border p-2.5 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{e.lead?.name || "Unknown"}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {e.lead?.email} · Step {e.current_step_index + 1}
                          {e.next_send_at &&
                            e.status === "active" &&
                            ` · Next ${new Date(e.next_send_at).toLocaleString()}`}
                          {e.stop_reason && ` · ${e.stop_reason}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant={
                            e.status === "active"
                              ? "default"
                              : e.status === "completed"
                                ? "info"
                                : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {e.status === "completed" && (
                            <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                          )}
                          {e.status === "stopped" && <StopCircle className="h-2.5 w-2.5 mr-0.5" />}
                          {e.status}
                        </Badge>
                        {e.status === "active" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              updateEnroll({
                                data: { organizationId: orgId!, id: e.id, status: "stopped" },
                              }).then(refreshDetail)
                            }
                          >
                            <StopCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Recent activity */}
            {log.length > 0 && (
              <Card className="p-4 space-y-2">
                <h2 className="text-sm font-semibold">Recent sends</h2>
                <div className="space-y-1">
                  {log.slice(0, 20).map((l) => (
                    <div
                      key={l.id}
                      className="text-xs flex items-center justify-between border-b border-border/50 pb-1"
                    >
                      <span className="truncate">
                        <Badge variant="outline" className="mr-2 text-[10px]">
                          Step {l.step_index + 1}
                        </Badge>
                        {l.lead?.email || l.enrollment_id.slice(0, 8)} —{" "}
                        <span className="text-muted-foreground">
                          {l.subject || l.error_message}
                        </span>
                      </span>
                      <span
                        className={`text-[10px] uppercase ${
                          l.status === "sent"
                            ? "text-emerald-500"
                            : l.status === "failed"
                              ? "text-destructive"
                              : "text-muted-foreground"
                        }`}
                      >
                        {l.status} · {new Date(l.sent_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      {/* New sequence dialog */}
      <Dialog open={newSeqOpen} onOpenChange={setNewSeqOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New outreach sequence</DialogTitle>
            <DialogDescription>
              Multi-step sequences run on a schedule and stop automatically when leads reply.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input
                value={newSeqName}
                onChange={(e) => setNewSeqName(e.target.value)}
                placeholder="Q1 outreach push"
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                value={newSeqDesc}
                onChange={(e) => setNewSeqDesc(e.target.value)}
                rows={3}
                placeholder="What this sequence is for"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSeqOpen(false)}>
              Cancel
            </Button>
            <Button variant="command" onClick={handleCreate}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step editor */}
      <Dialog
        open={stepEditor.open}
        onOpenChange={(v) => !v && setStepEditor({ open: false, step: null })}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{stepEditor.step?.id ? "Edit step" : "Add step"}</DialogTitle>
            <DialogDescription>
              Choose an outreach template or write the email inline. Tokens like{" "}
              <code>{"{{first_name}}"}</code> are personalized per lead.
            </DialogDescription>
          </DialogHeader>
          {stepEditor.step && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Wait (days)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={stepEditor.step.delay_days ?? 0}
                    onChange={(e) =>
                      setStepEditor({
                        ...stepEditor,
                        step: { ...stepEditor.step!, delay_days: Number(e.target.value) },
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Wait (hours)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={stepEditor.step.delay_hours ?? 0}
                    onChange={(e) =>
                      setStepEditor({
                        ...stepEditor,
                        step: { ...stepEditor.step!, delay_hours: Number(e.target.value) },
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Template (optional)</Label>
                <Select
                  value={stepEditor.step.template_id || "__inline__"}
                  onValueChange={(v) =>
                    setStepEditor({
                      ...stepEditor,
                      step: {
                        ...stepEditor.step!,
                        template_id: v === "__inline__" ? null : v,
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__inline__">Write inline</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subject {stepEditor.step.template_id ? "(override)" : ""}</Label>
                <Input
                  value={stepEditor.step.subject_override || ""}
                  onChange={(e) =>
                    setStepEditor({
                      ...stepEditor,
                      step: { ...stepEditor.step!, subject_override: e.target.value },
                    })
                  }
                  placeholder="Quick question, {{first_name}}"
                />
              </div>
              <div>
                <Label>Body {stepEditor.step.template_id ? "(override)" : ""}</Label>
                <Textarea
                  rows={8}
                  value={stepEditor.step.body_override || ""}
                  onChange={(e) =>
                    setStepEditor({
                      ...stepEditor,
                      step: { ...stepEditor.step!, body_override: e.target.value },
                    })
                  }
                  placeholder={"Hey {{first_name}},\n\n…"}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStepEditor({ open: false, step: null })}>
              Cancel
            </Button>
            <Button variant="command" onClick={handleSaveStep}>
              Save step
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enroll dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enroll leads</DialogTitle>
            <DialogDescription>
              Pick leads to start in this sequence. Already-enrolled leads are skipped.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {leads.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No leads with email addresses yet.
              </p>
            ) : (
              leads.map((l) => {
                const isEnrolled = enrolledLeadIds.has(l.id);
                const checked = selectedLeadIds.includes(l.id);
                return (
                  <label
                    key={l.id}
                    className={`flex items-center gap-2 rounded-md p-2 text-sm cursor-pointer ${
                      isEnrolled ? "opacity-50 cursor-not-allowed" : "hover:bg-secondary/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={isEnrolled}
                      checked={checked}
                      onChange={(e) =>
                        setSelectedLeadIds((prev) =>
                          e.target.checked ? [...prev, l.id] : prev.filter((x) => x !== l.id),
                        )
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{l.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{l.email}</p>
                    </div>
                    {isEnrolled && (
                      <Badge variant="secondary" className="text-[10px]">
                        Enrolled
                      </Badge>
                    )}
                  </label>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollOpen(false)}>
              Cancel
            </Button>
            <Button variant="command" onClick={handleEnroll} disabled={!selectedLeadIds.length}>
              Enroll {selectedLeadIds.length || ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
