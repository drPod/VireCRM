import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Trash2, Mail, MessageSquare, Clock, Send, Inbox, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAutoOutreach } from "@/hooks/useAutoOutreach";
import { listLeadEmailLogsFn, type EmailLogEntry } from "@/functions/email-log.functions";
import type { Lead } from "./LeadCard";

const STATUS_OPTIONS: Lead["status"][] = ["new", "contacted", "qualified", "negotiation", "won", "lost"];

interface ActivityItem {
  id: string;
  type: "email" | "reply" | "task";
  title: string;
  content: string;
  date: string;
  status?: string;
  sentiment?: string | null;
}

interface LeadDetailDrawerProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function LeadDetailDrawer({ lead, open, onOpenChange, onUpdated }: LeadDetailDrawerProps) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    status: "new" as string,
    score: 50,
    next_action: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resending, setResending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { triggerOutreach } = useAutoOutreach();
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [emailLogs, setEmailLogs] = useState<EmailLogEntry[]>([]);
  const [loadingEmailLogs, setLoadingEmailLogs] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "activity" | "emails">("details");

  useEffect(() => {
    if (!lead) return;
    setConfirmDelete(false);
    setActiveTab("details");

    setForm({
      name: lead.name,
      email: lead.email || "",
      phone: lead.phone || "",
      company: lead.company || "",
      status: lead.status,
      score: lead.score,
      next_action: lead.nextAction || "",
      notes: "",
    });

    setLoadingNotes(true);
    supabase
      .from("leads")
      .select("notes")
      .eq("id", lead.id)
      .single()
      .then(({ data }) => {
        if (data?.notes) setForm((prev) => ({ ...prev, notes: data.notes ?? "" }));
        setLoadingNotes(false);
      });

    // Fetch activity history
    setLoadingActivity(true);
    Promise.all([
      supabase
        .from("messages")
        .select("id, subject, content, created_at, status, type, sentiment")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("replies")
        .select("id, content, created_at, channel, sentiment")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("tasks")
        .select("id, title, description, created_at, status, priority")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]).then(([messagesRes, repliesRes, tasksRes]) => {
      const items: ActivityItem[] = [];

      messagesRes.data?.forEach((m) =>
        items.push({
          id: m.id,
          type: "email",
          title: m.subject || "Outreach email",
          content: m.content,
          date: m.created_at,
          status: m.status,
          sentiment: m.sentiment,
        })
      );

      repliesRes.data?.forEach((r) =>
        items.push({
          id: r.id,
          type: "reply",
          title: `Reply via ${r.channel}`,
          content: r.content,
          date: r.created_at,
          sentiment: r.sentiment,
        })
      );

      tasksRes.data?.forEach((t) =>
        items.push({
          id: t.id,
          type: "task",
          title: t.title,
          content: t.description || "",
          date: t.created_at,
          status: t.status,
        })
      );

      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setActivities(items);
      setLoadingActivity(false);
    });
  }, [lead]);

  // Fetch email send log when the Emails tab is opened (refetch on email change too)
  const refreshEmailLogs = useCallback(async () => {
    if (!lead) return;
    const email = (form.email || lead.email || "").trim();
    if (!email) {
      setEmailLogs([]);
      return;
    }
    setLoadingEmailLogs(true);
    try {
      const rows = await listLeadEmailLogsFn({ data: { email } });
      setEmailLogs(rows ?? []);
    } catch {
      setEmailLogs([]);
    } finally {
      setLoadingEmailLogs(false);
    }
  }, [lead, form.email]);

  useEffect(() => {
    if (!lead || activeTab !== "emails") return;
    void refreshEmailLogs();
  }, [lead, activeTab, refreshEmailLogs]);

  const update = (field: string, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!lead || !form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("leads")
      .update({
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        company: form.company.trim() || null,
        status: form.status,
        score: form.score,
        next_action: form.next_action.trim() || null,
        notes: form.notes.trim() || null,
      })
      .eq("id", lead.id);

    setSaving(false);
    if (error) {
      toast.error("Failed to update lead");
    } else {
      toast.success("Lead updated");
      onUpdated();
      onOpenChange(false);
    }
  };

  const handleDelete = async () => {
    if (!lead) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    const { error } = await supabase.from("leads").delete().eq("id", lead.id);
    setDeleting(false);
    if (error) {
      toast.error("Failed to delete lead");
    } else {
      toast.success("Lead deleted");
      onUpdated();
      onOpenChange(false);
    }
  };

  const handleResendOutreach = async () => {
    if (!lead) return;
    const email = form.email.trim() || lead.email;
    if (!email) {
      toast.error("Add an email address first");
      return;
    }
    setResending(true);
    try {
      await triggerOutreach([
        {
          id: lead.id,
          name: form.name.trim() || lead.name,
          email,
          company: form.company.trim() || lead.company || null,
        },
      ]);
      // triggerOutreach surfaces its own toast; refresh activity on close/reopen.
      onUpdated();
    } finally {
      setResending(false);
    }
  };

  const inputClass =
    "h-9 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring";

  if (!lead) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Lead Details</SheetTitle>
          <SheetDescription>Edit lead information and view activity history.</SheetDescription>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border mt-3">
          <button
            onClick={() => setActiveTab("details")}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "details"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "activity"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Activity
            {activities.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {activities.length}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setActiveTab("emails")}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "emails"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Emails
            {emailLogs.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {emailLogs.length}
              </Badge>
            )}
          </button>
        </div>

        {activeTab === "details" ? (
          <div className="space-y-4 pt-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Name *</label>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Lead name"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Email</label>
              <input
                type="email"
                className={inputClass}
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="email@example.com"
              />
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Phone</label>
                <input
                  className={inputClass}
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="+1 555-0123"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Company</label>
                <input
                  className={inputClass}
                  value={form.company}
                  onChange={(e) => update("company", e.target.value)}
                  placeholder="Acme Corp"
                />
              </div>
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Status</label>
                <select
                  className={inputClass}
                  value={form.status}
                  onChange={(e) => update("status", e.target.value)}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Score (0–100)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={inputClass}
                  value={form.score}
                  onChange={(e) => update("score", Number(e.target.value))}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Next Action</label>
              <input
                className={inputClass}
                value={form.next_action}
                onChange={(e) => update("next_action", e.target.value)}
                placeholder="e.g. Send follow-up email"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Notes</label>
              {loadingNotes ? (
                <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                </div>
              ) : (
                <textarea
                  className="w-full rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring resize-none"
                  rows={4}
                  value={form.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  placeholder="Notes about this lead…"
                />
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border gap-2 flex-wrap">
              <Button
                variant={confirmDelete ? "destructive" : "outline"}
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                )}
                {confirmDelete ? "Confirm Delete" : "Delete"}
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResendOutreach}
                  disabled={resending || !(form.email.trim() || lead.email)}
                  title={
                    form.email.trim() || lead.email
                      ? "Generate and send a fresh AI outreach email to this lead"
                      : "Add an email address to enable resend"
                  }
                >
                  {resending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Resend outreach
                </Button>
                <Button variant="command" size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Save Changes
                </Button>
              </div>
            </div>

            {confirmDelete && (
              <p className="text-xs text-destructive text-center">
                Click again to permanently delete this lead.{" "}
                <button
                  className="underline hover:no-underline"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </button>
              </p>
            )}
          </div>
        ) : activeTab === "activity" ? (
          <div className="pt-4">
            {loadingActivity ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : activities.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No activity yet for this lead.
              </div>
            ) : (
              <div className="relative space-y-0">
                {/* Timeline line */}
                <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

                {activities.map((item) => (
                  <ActivityEntry key={`${item.type}-${item.id}`} item={item} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="pt-4 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">
                Send history for {(form.email || lead.email || "").trim() || "this lead"}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void refreshEmailLogs()}
                disabled={loadingEmailLogs || !(form.email.trim() || lead.email)}
                className="h-7 px-2 text-xs"
                title="Refresh email send log"
              >
                <RefreshCw className={`h-3 w-3 ${loadingEmailLogs ? "animate-spin" : ""}`} />
                <span className="ml-1.5">Refresh</span>
              </Button>
            </div>
            {!(form.email.trim() || lead.email) ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Add an email address to see send history.
              </div>
            ) : loadingEmailLogs && emailLogs.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : emailLogs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No emails sent to this lead yet.
              </div>
            ) : (
              emailLogs.map((log) => <EmailLogEntryRow key={log.id} log={log} />)
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ActivityEntry({ item }: { item: ActivityItem }) {
  const iconMap = {
    email: <Mail className="h-3.5 w-3.5" />,
    reply: <MessageSquare className="h-3.5 w-3.5" />,
    task: <Clock className="h-3.5 w-3.5" />,
  };

  const colorMap = {
    email: "bg-primary/15 text-primary border-primary/20",
    reply: "bg-accent text-accent-foreground border-accent",
    task: "bg-secondary text-secondary-foreground border-secondary",
  };

  const sentimentBadge = item.sentiment ? (
    <Badge
      variant="outline"
      className={`text-[10px] px-1.5 py-0 h-4 ${
        item.sentiment === "positive"
          ? "border-green-500/30 text-green-400"
          : item.sentiment === "negative"
            ? "border-red-500/30 text-red-400"
            : "border-muted text-muted-foreground"
      }`}
    >
      {item.sentiment}
    </Badge>
  ) : null;

  const timeAgo = formatRelativeTime(item.date);

  return (
    <div className="relative pl-9 pb-4 group">
      {/* Icon dot */}
      <div
        className={`absolute left-1.5 top-1 flex h-[22px] w-[22px] items-center justify-center rounded-full border ${colorMap[item.type]}`}
      >
        {iconMap[item.type]}
      </div>

      <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-foreground truncate">{item.title}</span>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo}</span>
        </div>

        {item.content && (
          <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
            {item.content}
          </p>
        )}

        <div className="flex items-center gap-1.5">
          {item.status && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 capitalize">
              {item.status}
            </Badge>
          )}
          {sentimentBadge}
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function EmailLogEntryRow({ log }: { log: EmailLogEntry }) {
  const status = (log.status || "unknown").toLowerCase();
  const colorClass =
    status === "sent" || status === "delivered"
      ? "border-green-500/30 text-green-400 bg-green-500/10"
      : status === "pending" || status === "queued"
        ? "border-yellow-500/30 text-yellow-400 bg-yellow-500/10"
        : status === "suppressed"
          ? "border-orange-500/30 text-orange-400 bg-orange-500/10"
          : status === "failed" || status === "error" || status === "bounced"
            ? "border-red-500/30 text-red-400 bg-red-500/10"
            : "border-muted text-muted-foreground bg-muted/30";

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Inbox className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground truncate">
            {log.template_name}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {formatRelativeTime(log.created_at)}
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 capitalize ${colorClass}`}>
          {status}
        </Badge>
        <span className="text-[10px] text-muted-foreground truncate">{log.recipient_email}</span>
      </div>
      {log.error_message && (
        <p className="text-[11px] text-red-400 leading-relaxed line-clamp-2">{log.error_message}</p>
      )}
    </div>
  );
}
