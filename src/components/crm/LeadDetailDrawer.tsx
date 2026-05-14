import { useState, useEffect, useCallback, useMemo } from "react";
import { notifyLeadsChanged } from "@/lib/leads-events";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Save,
  Trash2,
  Mail,
  MessageSquare,
  Clock,
  Send,
  Inbox,
  RefreshCw,
  Trophy,
  Calculator,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAutoOutreach } from "@/hooks/useAutoOutreach";
import { listLeadEmailLogsFn, type EmailLogEntry } from "@/functions/email-log.functions";
import { OutreachPreviewDialog } from "./OutreachPreviewDialog";
import { LeadConnectorActions } from "./LeadConnectorActions";
import { LeadFollowupButton } from "./LeadFollowupButton";
import { LeadScoreButton } from "./LeadScoreButton";
import { AssigneeMultiSelect } from "./AssigneeMultiSelect";
import { ShareLeadPanel } from "./ShareLeadPanel";
import { AssigneeAvatars } from "./AssigneeAvatars";
import { LeadInvoicesPanel } from "./LeadInvoicesPanel";
import type { Lead } from "./LeadCard";

const STATUS_OPTIONS: Lead["status"][] = [
  "new",
  "contacted",
  "qualified",
  "negotiation",
  "won",
  "lost",
];

interface ActivityItem {
  id: string;
  type: "email" | "reply" | "task" | "won";
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
  /**
   * Optional optimistic patch hook. Called BEFORE the network write completes
   * so the parent list/pipeline can reflect edits instantly. Realtime + the
   * follow-up `onUpdated()` reconcile the server truth shortly after.
   */
  onOptimisticPatch?: (id: string, patch: Partial<Lead>) => void;
}

export function LeadDetailDrawer({
  lead,
  open,
  onOpenChange,
  onUpdated,
  onOptimisticPatch,
}: LeadDetailDrawerProps) {
  const { organization, role } = useAuth();
  const canAssign = role?.role === "owner" || role?.role === "manager";
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    status: "new" as string,
    score: 50,
    next_action: "",
    notes: "",
    annual_kwh: "" as string,
    contract_end_date: "" as string,
    current_supplier: "",
    deal_value: "" as string,
    deal_currency: "USD" as string,
    assigned_to: "" as string,
  });
  const [markingWon, setMarkingWon] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [emailLogs, setEmailLogs] = useState<EmailLogEntry[]>([]);
  const [loadingEmailLogs, setLoadingEmailLogs] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "activity" | "emails" | "invoices">(
    "details",
  );
  const [activityRefetchKey, setActivityRefetchKey] = useState(0);
  const [members, setMembers] = useState<
    Array<{ user_id: string; full_name: string; role: string }>
  >([]);
  // Multi-assignee state — sourced from the lead_assignees join table.
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [initialAssigneeIds, setInitialAssigneeIds] = useState<string[]>([]);
  const [commissionRule, setCommissionRule] = useState<{
    rule_type: string;
    percent: number;
    flat_cents: number;
    scope: "rep" | "org";
  } | null>(null);
  const [billingSummary, setBillingSummary] = useState<{
    count: number;
    collectedCents: number;
    outstandingCents: number;
    recurringActive: number;
    currency: string;
    lastPaidAt: string | null;
    lastInvoiceUrl: string | null;
  } | null>(null);

  // Load org members so owners/managers can pick an assignee.
  useEffect(() => {
    if (!organization?.id) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name")
          .eq("organization_id", organization.id),
        supabase.from("user_roles").select("user_id, role").eq("organization_id", organization.id),
      ]);
      if (cancelled) return;
      const roleByUser = new Map<string, string>();
      rolesRes.data?.forEach((r) => {
        if (r.user_id) roleByUser.set(r.user_id, r.role);
      });
      const list = (profilesRes.data ?? []).map((p) => ({
        user_id: p.user_id,
        full_name: p.full_name ?? "Unnamed",
        role: roleByUser.get(p.user_id) ?? "sales_rep",
      }));
      setMembers(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [organization?.id]);

  // Fetch active commission rule (rep override > org default) for the preview.
  useEffect(() => {
    if (!organization?.id) {
      setCommissionRule(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      const { data } = await supabase
        .from("commission_rules")
        .select("rule_type, percent, flat_cents, user_id")
        .eq("organization_id", organization.id)
        .eq("is_active", true);
      if (cancelled) return;
      if (!data || data.length === 0) {
        setCommissionRule(null);
        return;
      }
      const repRule = data.find((r) => r.user_id === uid);
      const orgRule = data.find((r) => r.user_id === null);
      const chosen = repRule ?? orgRule ?? data[0];
      setCommissionRule({
        rule_type: chosen.rule_type,
        percent: Number(chosen.percent ?? 0),
        flat_cents: Number(chosen.flat_cents ?? 0),
        scope: chosen.user_id ? "rep" : "org",
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [organization?.id]);

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
      annual_kwh:
        typeof lead.annualKwh === "number" && lead.annualKwh >= 0 ? String(lead.annualKwh) : "",
      contract_end_date: lead.contractEndDate ?? "",
      current_supplier: lead.currentSupplier ?? "",
      deal_value: "",
      deal_currency: "USD",
      assigned_to: lead.assignedTo ?? "",
    });

    // Fetch the full notes + energy + deal + assignment fields (the list view doesn't include them).
    setLoadingNotes(true);
    Promise.all([
      supabase
        .from("leads")
        .select(
          "notes, annual_kwh, contract_end_date, current_supplier, deal_value_cents, deal_currency, assigned_to",
        )
        .eq("id", lead.id)
        .single(),
      supabase.from("lead_assignees").select("user_id").eq("lead_id", lead.id),
    ]).then(([leadRes, assigneeRes]) => {
      const data = leadRes.data;
      if (data) {
        setForm((prev) => ({
          ...prev,
          notes: data.notes ?? "",
          annual_kwh:
            typeof data.annual_kwh === "number" && data.annual_kwh >= 0
              ? String(data.annual_kwh)
              : prev.annual_kwh,
          contract_end_date: data.contract_end_date ?? prev.contract_end_date,
          current_supplier: data.current_supplier ?? prev.current_supplier,
          deal_value:
            typeof data.deal_value_cents === "number" && data.deal_value_cents > 0
              ? (data.deal_value_cents / 100).toString()
              : "",
          deal_currency: data.deal_currency ?? "USD",
          assigned_to: data.assigned_to ?? prev.assigned_to,
        }));
      }
      const ids = (assigneeRes.data ?? []).map((r) => r.user_id);
      // Fall back to the legacy single column if the join table is empty.
      const fallback = ids.length === 0 && data?.assigned_to ? [data.assigned_to] : ids;
      setAssigneeIds(fallback);
      setInitialAssigneeIds(fallback);
      setLoadingNotes(false);
    });
  }, [lead]);

  // Fetch activity history (re-runs on lead change OR when an action signals
  // a refetch via activityRefetchKey, e.g. after sending an email).
  useEffect(() => {
    if (!lead) return;
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
          type: m.type === "lead_won" ? "won" : "email",
          title: m.subject || (m.type === "lead_won" ? "Lead marked as won" : "Outreach email"),
          content: m.content,
          date: m.created_at,
          status: m.status,
          sentiment: m.sentiment,
        }),
      );

      repliesRes.data?.forEach((r) =>
        items.push({
          id: r.id,
          type: "reply",
          title: `Reply via ${r.channel}`,
          content: r.content,
          date: r.created_at,
          sentiment: r.sentiment,
        }),
      );

      tasksRes.data?.forEach((t) =>
        items.push({
          id: t.id,
          type: "task",
          title: t.title,
          content: t.description || "",
          date: t.created_at,
          status: t.status,
        }),
      );

      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setActivities(items);
      setLoadingActivity(false);
    });
  }, [lead, activityRefetchKey]);

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
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setEmailLogs([]);
        return;
      }
      const rows = await listLeadEmailLogsFn({
        headers: { Authorization: `Bearer ${token}` },
        data: { email },
      });
      // Server functions can wrap responses in different shapes (array, { result }, { data }).
      // Defensively normalize so a non-array response never crashes the render.
      const list: EmailLogEntry[] = Array.isArray(rows)
        ? rows
        : Array.isArray((rows as { result?: unknown })?.result)
          ? (rows as { result: EmailLogEntry[] }).result
          : Array.isArray((rows as { data?: unknown })?.data)
            ? (rows as { data: EmailLogEntry[] }).data
            : [];
      setEmailLogs(list);
    } catch (err) {
      console.error("[LeadDetailDrawer] Failed to load email logs:", err);
      setEmailLogs([]);
    } finally {
      setLoadingEmailLogs(false);
    }
  }, [lead, form.email]);

  useEffect(() => {
    if (!lead || activeTab !== "emails") return;
    void refreshEmailLogs();
  }, [lead, activeTab, refreshEmailLogs]);

  // Billing summary — counts + totals + last payment from client_invoices for this lead.
  // Refreshes on lead change AND in realtime as Stripe webhooks update invoice rows.
  const refreshBillingSummary = useCallback(async () => {
    if (!lead?.id || !organization?.id) {
      setBillingSummary(null);
      return;
    }
    const { data } = await supabase
      .from("client_invoices")
      .select(
        "amount_due_cents, amount_paid_cents, currency, status, is_recurring, paid_at, hosted_invoice_url, created_at",
      )
      .eq("lead_id", lead.id)
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false });
    const rows = data || [];
    if (rows.length === 0) {
      setBillingSummary({
        count: 0,
        collectedCents: 0,
        outstandingCents: 0,
        recurringActive: 0,
        currency: "USD",
        lastPaidAt: null,
        lastInvoiceUrl: null,
      });
      return;
    }
    let collected = 0;
    let outstanding = 0;
    let recurringActive = 0;
    let lastPaidAt: string | null = null;
    for (const r of rows) {
      if (r.status === "paid") {
        collected += r.amount_paid_cents || r.amount_due_cents;
        if (r.paid_at && (!lastPaidAt || r.paid_at > lastPaidAt)) lastPaidAt = r.paid_at;
      } else if (r.status === "open" || r.status === "past_due") {
        outstanding += r.amount_due_cents;
      }
      if (r.is_recurring && (r.status === "active" || r.status === "open")) recurringActive += 1;
    }
    setBillingSummary({
      count: rows.length,
      collectedCents: collected,
      outstandingCents: outstanding,
      recurringActive,
      currency: (rows[0].currency || "USD").toUpperCase(),
      lastPaidAt,
      lastInvoiceUrl: rows.find((r) => r.hosted_invoice_url)?.hosted_invoice_url ?? null,
    });
  }, [lead?.id, organization?.id]);

  useEffect(() => {
    void refreshBillingSummary();
  }, [refreshBillingSummary]);

  useEffect(() => {
    if (!lead?.id || !organization?.id) return;
    const channel = supabase
      .channel(`lead_invoices_${lead.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "client_invoices",
          filter: `lead_id=eq.${lead.id}`,
        },
        () => void refreshBillingSummary(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [lead?.id, organization?.id, refreshBillingSummary]);

  const update = (field: string, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const parseDealValueCents = (): { ok: true; cents: number } | { ok: false; error: string } => {
    const raw = form.deal_value.trim();
    if (!raw) {
      return { ok: false, error: "Deal value is required — enter a positive amount" };
    }
    const cleaned = raw.replace(/[^\d.]/g, "");
    const n = cleaned ? Number(cleaned) : NaN;
    if (!Number.isFinite(n) || n <= 0) {
      return { ok: false, error: "Deal value must be greater than 0" };
    }
    return { ok: true, cents: Math.round(n * 100) };
  };

  const dealValidation = useMemo(() => {
    const raw = form.deal_value.trim();
    if (!raw) return { valid: false, error: "Enter a positive deal value" };
    const cleaned = raw.replace(/[^\d.]/g, "");
    const n = cleaned ? Number(cleaned) : NaN;
    if (!Number.isFinite(n) || n <= 0) {
      return { valid: false, error: "Deal value must be greater than 0" };
    }
    return { valid: true as const, cents: Math.round(n * 100) };
  }, [form.deal_value]);

  const recordWonActivity = async (cents: number, currency: string) => {
    if (!lead || !organization?.id) return;
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(cents / 100);
    await supabase.from("messages").insert({
      organization_id: organization.id,
      lead_id: lead.id,
      type: "lead_won",
      subject: `Lead marked as won — ${formatted}`,
      content: `${form.name.trim() || lead.name} was marked as won with a deal value of ${formatted}.`,
      status: "logged",
    });
  };

  const handleSave = async () => {
    if (!lead || !form.name.trim()) {
      toast.error("Name is required");
      return;
    }

    // Parse annual kWh — accept blank, "12,000", "12000 kWh".
    let annualKwh: number | null = null;
    const rawKwh = form.annual_kwh.trim();
    if (rawKwh) {
      const cleaned = rawKwh.replace(/[^\d.]/g, "");
      const n = cleaned ? Math.round(Number(cleaned)) : NaN;
      if (!Number.isFinite(n) || n < 0) {
        toast.error("Annual kWh must be a positive number");
        return;
      }
      annualKwh = n;
    }

    const dealParsed = parseDealValueCents();
    if (!dealParsed.ok) {
      toast.error(dealParsed.error);
      return;
    }

    setSaving(true);
    const updatePayload: TablesUpdate<"leads"> = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      company: form.company.trim() || null,
      status: form.status,
      score: form.score,
      next_action: form.next_action.trim() || null,
      notes: form.notes.trim() || null,
      annual_kwh: annualKwh,
      contract_end_date: form.contract_end_date || null,
      current_supplier: form.current_supplier.trim() || null,
      deal_value_cents: dealParsed.cents,
      deal_currency: form.deal_currency || "USD",
    };
    // Only owners/managers may change assignees — DB trigger enforces too.
    // Primary assignee = first id in the multi-select (or null when empty).
    if (canAssign) {
      updatePayload.assigned_to = assigneeIds[0] ?? null;
    }

    // Optimistically patch the parent list/pipeline before the round-trip.
    // If the write fails, the next refetch (or realtime) will reconcile.
    onOptimisticPatch?.(lead.id, {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      company: form.company.trim() || undefined,
      status: form.status as Lead["status"],
      score: form.score,
      nextAction: form.next_action.trim() || undefined,
      annualKwh: annualKwh,
      contractEndDate: form.contract_end_date || null,
      currentSupplier: form.current_supplier.trim() || null,
      ...(canAssign ? { assignedTo: assigneeIds[0] ?? null } : {}),
    });

    const { error } = await supabase.from("leads").update(updatePayload).eq("id", lead.id);

    if (!error && canAssign && organization?.id) {
      // Diff the join table so we add new assignees and remove dropped ones.
      const toAdd = assigneeIds.filter((id) => !initialAssigneeIds.includes(id));
      const toRemove = initialAssigneeIds.filter((id) => !assigneeIds.includes(id));
      if (toAdd.length > 0) {
        await supabase.from("lead_assignees").upsert(
          toAdd.map((user_id) => ({
            lead_id: lead.id,
            user_id,
            organization_id: organization.id,
          })),
          { onConflict: "lead_id,user_id", ignoreDuplicates: true },
        );
      }
      if (toRemove.length > 0) {
        await supabase
          .from("lead_assignees")
          .delete()
          .eq("lead_id", lead.id)
          .in("user_id", toRemove);
      }
      setInitialAssigneeIds(assigneeIds);
    }

    setSaving(false);
    if (error) {
      toast.error("Failed to update lead");
    } else {
      const transitionedToWon = form.status === "won" && lead.status !== "won";
      if (transitionedToWon) {
        await recordWonActivity(dealParsed.cents, form.deal_currency || "USD");
      }
      toast.success(form.status === "won" ? "Lead marked as won 🎉" : "Lead updated");
      onUpdated();
      onOpenChange(false);
    }
  };

  const handleMarkWon = async () => {
    if (!lead) return;
    const dealParsed = parseDealValueCents();
    if (!dealParsed.ok) {
      toast.error(dealParsed.error);
      return;
    }
    setMarkingWon(true);
    const { error } = await supabase
      .from("leads")
      .update({
        status: "won",
        deal_value_cents: dealParsed.cents,
        deal_currency: form.deal_currency || "USD",
      })
      .eq("id", lead.id);
    setMarkingWon(false);
    if (error) {
      toast.error("Failed to mark lead as won");
    } else {
      if (lead.status !== "won") {
        await recordWonActivity(dealParsed.cents, form.deal_currency || "USD");
      }
      toast.success("Lead marked as won 🎉");
      setForm((prev) => ({ ...prev, status: "won" }));
      setActivityRefetchKey((k) => k + 1);
      onUpdated();
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

  const handleOpenPreview = () => {
    if (!lead) return;
    const email = form.email.trim() || lead.email;
    if (!email) {
      toast.error("Add an email address first");
      return;
    }
    setPreviewOpen(true);
  };

  const handleSent = () => {
    // Refresh parent list (lead status may have moved to "contacted") and the
    // drawer's tabs so the new message + send-log entry show up immediately.
    onUpdated();
    if (lead) {
      void refreshEmailLogs();
      setActivityRefetchKey((k) => k + 1);
    }
  };

  const inputClass =
    "h-9 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring";

  const lastOutreachDate = activities.find((a) => a.type === "email")?.date ?? null;
  const lastOutreachLabel = lastOutreachDate ? formatRelativeTime(lastOutreachDate) : null;

  if (!lead) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <SheetTitle>Lead Details</SheetTitle>
              <SheetDescription>Edit lead information and view activity history.</SheetDescription>
              {assigneeIds.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <AssigneeAvatars
                    assignees={assigneeIds.map((id) => ({
                      user_id: id,
                      full_name: members.find((m) => m.user_id === id)?.full_name ?? "Unnamed",
                    }))}
                    size="sm"
                    max={4}
                  />
                  <span className="text-[11px] text-muted-foreground">
                    {assigneeIds.length === 1
                      ? "Assigned to 1 employee"
                      : `Shared with ${assigneeIds.length} employees`}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="flex items-center gap-1.5">
                <Button
                  variant="command"
                  size="sm"
                  onClick={handleOpenPreview}
                  disabled={!(form.email.trim() || lead.email)}
                  title={
                    form.email.trim() || lead.email
                      ? "Preview an AI-generated outreach email before sending"
                      : "Add an email address to enable sending"
                  }
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Send outreach
                </Button>
                <LeadConnectorActions
                  leadId={lead.id}
                  leadName={form.name || lead.name}
                  leadEmail={form.email.trim() || lead.email || null}
                  leadPhone={form.phone.trim() || lead.phone || null}
                  onActed={handleSent}
                />
                <LeadFollowupButton leadId={lead.id} />
                <LeadScoreButton leadId={lead.id} onScored={(s) => update("score", s)} />
              </div>
              {lastOutreachLabel && (
                <span
                  className="flex items-center gap-1 text-[10px] text-muted-foreground"
                  title={new Date(lastOutreachDate!).toLocaleString()}
                >
                  <Clock className="h-3 w-3" />
                  Last outreach: {lastOutreachLabel}
                </span>
              )}
            </div>
          </div>
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
          <button
            onClick={() => setActiveTab("invoices")}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "invoices"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Invoices
            {billingSummary && billingSummary.count > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {billingSummary.count}
              </Badge>
            )}
          </button>
        </div>

        {/* Billing summary — visible on every tab once an invoice exists */}
        {billingSummary && billingSummary.count > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab("invoices")}
            className="mt-3 w-full rounded-lg border border-border bg-card/60 px-3 py-2 text-left transition-colors hover:bg-muted/40"
            title="View invoices for this lead"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <Calculator className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-success font-semibold tabular-nums">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: billingSummary.currency,
                      }).format(billingSummary.collectedCents / 100)}
                    </span>
                    <span className="text-muted-foreground">collected</span>
                    {billingSummary.outstandingCents > 0 && (
                      <>
                        <span className="text-muted-foreground/50">·</span>
                        <span className="text-warning font-semibold tabular-nums">
                          {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: billingSummary.currency,
                          }).format(billingSummary.outstandingCents / 100)}
                        </span>
                        <span className="text-muted-foreground">due</span>
                      </>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {billingSummary.count} {billingSummary.count === 1 ? "invoice" : "invoices"}
                    {billingSummary.recurringActive > 0 &&
                      ` · ${billingSummary.recurringActive} recurring`}
                    {billingSummary.lastPaidAt &&
                      ` · last paid ${new Date(billingSummary.lastPaidAt).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          </button>
        )}

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
                <label className="mb-1 block text-xs font-medium text-foreground">
                  Score (0–100)
                </label>
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
              <label className="mb-1 block text-xs font-medium text-foreground">
                Assignees
                {!canAssign && (
                  <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                    (owners & managers only)
                  </span>
                )}
              </label>
              {canAssign ? (
                <div className="space-y-2">
                  <AssigneeMultiSelect
                    options={members.map((m) => ({
                      user_id: m.user_id,
                      full_name: `${m.full_name} (${m.role.replace("_", " ")})`,
                    }))}
                    selected={assigneeIds}
                    onChange={setAssigneeIds}
                    placeholder="Unassigned"
                    emptyText="No employees yet."
                    className="w-full"
                  />
                  {assigneeIds.length > 0 && (
                    <div className="flex items-center gap-2">
                      <AssigneeAvatars
                        assignees={assigneeIds.map((id) => ({
                          user_id: id,
                          full_name: members.find((m) => m.user_id === id)?.full_name ?? "Unnamed",
                        }))}
                        size="sm"
                        max={5}
                      />
                      <span className="text-[11px] text-muted-foreground">
                        {assigneeIds.length === 1
                          ? "1 employee assigned"
                          : `${assigneeIds.length} employees assigned`}
                        {assigneeIds.length > 1 && " · first is primary"}
                      </span>
                    </div>
                  )}
                </div>
              ) : assigneeIds.length > 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-input bg-input/40 px-3 py-2">
                  <AssigneeAvatars
                    assignees={assigneeIds.map((id) => ({
                      user_id: id,
                      full_name: members.find((m) => m.user_id === id)?.full_name ?? "Unnamed",
                    }))}
                    size="sm"
                    max={5}
                  />
                  <span className="text-xs text-muted-foreground truncate">
                    {assigneeIds
                      .map((id) => members.find((m) => m.user_id === id)?.full_name ?? "Unnamed")
                      .join(", ")}
                  </span>
                </div>
              ) : (
                <p className="text-xs italic text-muted-foreground">Unassigned</p>
              )}
            </div>

            {lead && (
              <ShareLeadPanel
                leadId={lead.id}
                createdBy={lead.createdBy ?? null}
                assignedTo={lead.assignedTo ?? null}
              />
            )}

            <div
              className={`rounded-lg border p-3 space-y-3 ${
                form.status === "won"
                  ? "border-success/40 bg-success/5"
                  : "border-border bg-secondary/30"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Deal value
                </p>
                {form.status !== "won" ? (
                  <Button
                    variant="command"
                    size="sm"
                    onClick={handleMarkWon}
                    disabled={markingWon || !dealValidation.valid}
                    className="h-7 px-2.5 text-xs"
                    title={
                      dealValidation.valid
                        ? "Mark this lead as won and record the deal value"
                        : "Enter a positive deal value first"
                    }
                  >
                    {markingWon ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trophy className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Mark as Won
                  </Button>
                ) : (
                  <Badge variant="success" className="text-[10px]">
                    <Trophy className="mr-1 h-3 w-3" /> Won
                  </Badge>
                )}
              </div>
              <div className="grid gap-3 grid-cols-[1fr_90px]">
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    Amount <span className="text-destructive">*</span>
                  </label>
                  <input
                    inputMode="decimal"
                    className={`${inputClass} ${!dealValidation.valid ? "border-destructive focus:ring-destructive" : ""}`}
                    value={form.deal_value}
                    onChange={(e) => update("deal_value", e.target.value)}
                    placeholder="e.g. 2500"
                    aria-invalid={!dealValidation.valid}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">Currency</label>
                  <select
                    className={inputClass}
                    value={form.deal_currency}
                    onChange={(e) => update("deal_currency", e.target.value)}
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="CAD">CAD</option>
                    <option value="AUD">AUD</option>
                  </select>
                </div>
              </div>
              {!dealValidation.valid && (
                <p className="text-[11px] text-destructive leading-relaxed">
                  {dealValidation.error}
                </p>
              )}
              {(() => {
                const cents = dealValidation.valid ? dealValidation.cents : null;
                if (form.status !== "won" || !cents || cents <= 0) {
                  return (
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Recording a deal value when marking a lead as won automatically creates a
                      commission earning if rules are configured.
                    </p>
                  );
                }
                if (!commissionRule) {
                  return (
                    <div className="rounded-md border border-warning/30 bg-warning/5 px-2.5 py-2">
                      <p className="text-[11px] text-warning leading-relaxed flex items-start gap-1.5">
                        <Calculator className="h-3 w-3 mt-0.5 shrink-0" />
                        No active commission rule configured — set one in Payouts → Commission Rules
                        to auto-calculate earnings.
                      </p>
                    </div>
                  );
                }
                const commissionCents =
                  commissionRule.rule_type === "flat"
                    ? commissionRule.flat_cents
                    : Math.round(cents * commissionRule.percent);
                const fmt = (c: number) =>
                  new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: form.deal_currency || "USD",
                    maximumFractionDigits: 2,
                  }).format(c / 100);
                const ruleLabel =
                  commissionRule.rule_type === "flat"
                    ? `${fmt(commissionRule.flat_cents)} flat`
                    : `${(commissionRule.percent * 100).toFixed(1)}% of deal`;
                return (
                  <div className="rounded-md border border-success/30 bg-success/5 px-3 py-2.5 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-success">
                        <Calculator className="h-3 w-3" />
                        Estimated commission
                      </span>
                      <span className="text-base font-bold text-success">
                        {fmt(commissionCents)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {ruleLabel} ·{" "}
                      {commissionRule.scope === "rep" ? "your personal rule" : "org default"}
                    </p>
                  </div>
                );
              })()}
            </div>

            <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Energy details
              </p>
              <div className="grid gap-3 grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    Annual kWh
                  </label>
                  <input
                    inputMode="numeric"
                    className={inputClass}
                    value={form.annual_kwh}
                    onChange={(e) => update("annual_kwh", e.target.value)}
                    placeholder="e.g. 120000"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    Contract end date
                  </label>
                  <input
                    type="date"
                    className={inputClass}
                    value={form.contract_end_date}
                    onChange={(e) => update("contract_end_date", e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    Current supplier
                  </label>
                  <input
                    className={inputClass}
                    value={form.current_supplier}
                    onChange={(e) => update("current_supplier", e.target.value)}
                    placeholder="e.g. British Gas, EDF, Octopus"
                  />
                </div>
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
              <Button
                variant="command"
                size="sm"
                onClick={handleSave}
                disabled={saving || !dealValidation.valid}
                title={
                  dealValidation.valid ? "Save changes" : "Enter a positive deal value to save"
                }
              >
                {saving ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save Changes
              </Button>
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
        {activeTab === "invoices" && lead && organization?.id && (
          <LeadInvoicesPanel
            leadId={lead.id}
            leadName={form.name.trim() || lead.name}
            leadEmail={form.email.trim() || lead.email || null}
            organizationId={organization.id}
          />
        )}
      </SheetContent>
      {lead && (form.email.trim() || lead.email) ? (
        <OutreachPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          lead={{
            id: lead.id,
            name: form.name.trim() || lead.name,
            email: (form.email.trim() || lead.email) as string,
            company: form.company.trim() || lead.company || null,
            role: (lead as { role?: string | null }).role ?? null,
          }}
          onSent={handleSent}
        />
      ) : null}
    </Sheet>
  );
}

function htmlToPlainText(input: string): string {
  if (!input) return "";
  // Strip script/style blocks entirely
  let s = input.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "");
  // Convert common block tags to newlines so paragraphs don't run together
  s = s.replace(/<\/(p|div|h[1-6]|li|tr|br)\s*>/gi, "\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  // Strip all remaining tags
  s = s.replace(/<[^>]+>/g, "");
  // Decode the most common HTML entities
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
  // Collapse whitespace
  s = s
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s;
}

function ActivityEntry({ item }: { item: ActivityItem }) {
  const [expanded, setExpanded] = useState(false);

  const iconMap = {
    email: <Mail className="h-3.5 w-3.5" />,
    reply: <MessageSquare className="h-3.5 w-3.5" />,
    task: <Clock className="h-3.5 w-3.5" />,
    won: <Trophy className="h-3.5 w-3.5" />,
  };

  const colorMap = {
    email: "bg-primary/15 text-primary border-primary/20",
    reply: "bg-accent text-accent-foreground border-accent",
    task: "bg-secondary text-secondary-foreground border-secondary",
    won: "bg-success/15 text-success border-success/30",
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
  const plainContent = useMemo(() => htmlToPlainText(item.content || ""), [item.content]);
  const isLong = plainContent.length > 180 || plainContent.includes("\n");
  const canExpand = isLong && item.type === "email";

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

        {plainContent && !expanded && (
          <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed whitespace-pre-wrap">
            {plainContent}
          </p>
        )}
        {plainContent && expanded && (
          <pre className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap font-sans bg-muted/40 rounded-md p-2 max-h-72 overflow-y-auto">
            {plainContent}
          </pre>
        )}

        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            {expanded ? (
              <>
                <ChevronDown className="h-3 w-3" /> Hide full message
              </>
            ) : (
              <>
                <ChevronRight className="h-3 w-3" /> View full message
              </>
            )}
          </button>
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
          <span className="text-xs font-medium text-foreground truncate">{log.template_name}</span>
        </div>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {formatRelativeTime(log.created_at)}
        </span>
      </div>
      {log.subject && (
        <p className="text-xs text-foreground/90 font-medium leading-snug line-clamp-1">
          {log.subject}
        </p>
      )}
      {log.body_preview &&
        (() => {
          const cleaned = htmlToPlainText(log.body_preview);
          return cleaned ? (
            <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 whitespace-pre-wrap">
              {cleaned}
            </p>
          ) : null;
        })()}
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
