import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LeadCard, type Lead } from "@/components/crm/LeadCard";
import { AddLeadDialog } from "@/components/crm/AddLeadDialog";
import { ImportLeadsDialog } from "@/components/crm/ImportLeadsDialog";
import { AutoFindLeadsDialog } from "@/components/crm/AutoFindLeadsDialog";
import { ImportApolloListDialog } from "@/components/crm/ImportApolloListDialog";
import { LeadDetailDrawer } from "@/components/crm/LeadDetailDrawer";
import { OutreachPreviewDialog } from "@/components/crm/OutreachPreviewDialog";
import { ExportLeadsButton } from "@/components/crm/ExportLeadsButton";
import { AssigneeMultiSelect, type AssigneeOption } from "@/components/crm/AssigneeMultiSelect";
import { BulkApplyTemplateDialog, type BulkRecipient } from "@/components/crm/BulkApplyTemplateDialog";
import { Button } from "@/components/ui/button";
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
import { Search, Loader2, UserPlus, X, Wand2, Trash2 } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";

type LeadsAction = "add" | "import" | "auto-find";
type LeadsSearch = { q?: string; action?: LeadsAction; ai_desc?: string; ai_industry?: string };

export const Route = createFileRoute("/_app/leads")({
  component: LeadsPage,
  validateSearch: (search: Record<string, unknown>): LeadsSearch => {
    const out: LeadsSearch = {};
    if (typeof search.q === "string" && search.q.length > 0) out.q = search.q;
    if (search.action === "add" || search.action === "import" || search.action === "auto-find") {
      out.action = search.action;
    }
    if (typeof search.ai_desc === "string" && search.ai_desc.length > 0) {
      out.ai_desc = search.ai_desc.slice(0, 1000);
    }
    if (typeof search.ai_industry === "string" && search.ai_industry.length > 0) {
      out.ai_industry = search.ai_industry.slice(0, 200);
    }
    return out;
  },
  head: () => ({
    meta: [
      { title: "Genesis — Leads" },
      { name: "description", content: "Manage and score your leads" },
    ],
  }),
});

const statusFilters = ["all", "new", "contacted", "qualified", "negotiation", "won", "lost"] as const;

function LeadsPage() {
  const { organization, role, user } = useAuth();
  const isOwner = role?.role === "owner";
  const navigate = useNavigate();
  const { q, action, ai_desc, ai_industry } = Route.useSearch();
  const [search, setSearch] = useState(q ?? "");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Lead picked for the inline "Send email" action — separate from the
  // detail drawer so opening the email composer doesn't open the drawer too.
  const [outreachLead, setOutreachLead] = useState<Lead | null>(null);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [autoFindOpen, setAutoFindOpen] = useState(false);
  // Captured once when the AI Advisor deep-links us in, so the dialog gets
  // pre-filled even after we strip the URL params.
  const [aiPrefill, setAiPrefill] = useState<{ desc?: string; industry?: string }>({});

  // Owner-only: members of the org used for filtering & bulk-assign.
  const [members, setMembers] = useState<AssigneeOption[]>([]);
  // Owner-only: which assignees the owner is filtering the list by (union/OR).
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);
  // Owner-only: bulk-select state.
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  // Owner-only: which employees to bulk-assign the selected leads to.
  const [bulkAssignTargets, setBulkAssignTargets] = useState<string[]>([]);
  // Owner-only: how to distribute. "share" = every lead → every employee
  // (one shared lead, multiple assignees). "round_robin" = distribute leads
  // one-by-one across employees (each lead gets exactly one assignee).
  const [bulkAssignMode, setBulkAssignMode] = useState<"share" | "round_robin">("share");
  const [bulkAssigning, setBulkAssigning] = useState(false);
  // Owner-only: confirmation prompt before the destructive round-robin pass
  // (which clears existing assignees on the selected leads).
  const [confirmRoundRobinOpen, setConfirmRoundRobinOpen] = useState(false);
  // Bulk apply outreach template (any role) — opens the personalize+send dialog.
  const [bulkTemplateOpen, setBulkTemplateOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Sync search input when URL ?q= changes (e.g., navigating from AI Advisor)
  useEffect(() => {
    if (q !== undefined) setSearch(q);
  }, [q]);

  // Auto-open dialogs from ?action= and clear the param so refresh doesn't reopen.
  useEffect(() => {
    if (action === "add") {
      setAddOpen(true);
      navigate({ to: "/leads", search: (prev: LeadsSearch) => ({ ...prev, action: undefined }), replace: true });
    } else if (action === "import") {
      setImportOpen(true);
      navigate({ to: "/leads", search: (prev: LeadsSearch) => ({ ...prev, action: undefined }), replace: true });
    } else if (action === "auto-find") {
      setAiPrefill({ desc: ai_desc, industry: ai_industry });
      setAutoFindOpen(true);
      navigate({
        to: "/leads",
        search: (prev: LeadsSearch) => ({
          ...prev,
          action: undefined,
          ai_desc: undefined,
          ai_industry: undefined,
        }),
        replace: true,
      });
    }
  }, [action, ai_desc, ai_industry, navigate]);

  const handleLeadAdded = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Load org members once for owner controls.
  useEffect(() => {
    if (!organization?.id || !isOwner) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("organization_id", organization.id);
      if (cancelled || error || !data) return;
      setMembers(
        data
          .filter((p): p is { user_id: string; full_name: string | null } => Boolean(p.user_id))
          .map((p) => ({ user_id: p.user_id, full_name: p.full_name ?? "Unnamed" }))
          .sort((a, b) => a.full_name.localeCompare(b.full_name))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [organization?.id, isOwner]);

  useEffect(() => {
    if (!organization?.id) return;

    const fetchLeads = async () => {
      setLoading(true);

      // If filtering by assignee, first resolve which lead ids match in the
      // join table (union/OR across the selected employees), then constrain
      // the leads query to those ids.
      let restrictedIds: string[] | null = null;
      if (isOwner && assigneeFilter.length > 0) {
        const { data: matches } = await supabase
          .from("lead_assignees")
          .select("lead_id")
          .eq("organization_id", organization.id)
          .in("user_id", assigneeFilter);
        restrictedIds = Array.from(new Set((matches ?? []).map((m) => m.lead_id)));
        if (restrictedIds.length === 0) {
          setLeads([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }
      }

      let query = supabase
        .from("leads")
        .select("*", { count: "exact" })
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (restrictedIds) {
        query = query.in("id", restrictedIds);
      }

      if (search.trim()) {
        // Sanitize search input: strip PostgREST metacharacters and limit length
        const sanitized = search.trim().slice(0, 200).replace(/[,.()"'\\]/g, "");
        if (sanitized) {
          query = query.or(
            `name.ilike.%${sanitized}%,email.ilike.%${sanitized}%,company.ilike.%${sanitized}%`
          );
        }
      }

      const [{ data, count, error }, profilesRes] = await Promise.all([
        query,
        supabase
          .from("profiles")
          .select("user_id, full_name")
          .eq("organization_id", organization.id),
      ]);

      const nameByUserId = new Map<string, string>();
      profilesRes.data?.forEach((p) => {
        if (p.user_id) nameByUserId.set(p.user_id, p.full_name ?? "Unnamed");
      });

      // Fetch all assignees + share counts for the visible leads in one round-trip.
      const leadIds = (data ?? []).map((l) => l.id);
      const assigneesByLead = new Map<string, Array<{ user_id: string; full_name: string }>>();
      const shareCountByLead = new Map<string, number>();
      if (leadIds.length > 0) {
        const [assigneeRes, sharesRes] = await Promise.all([
          supabase
            .from("lead_assignees")
            .select("lead_id, user_id")
            .in("lead_id", leadIds),
          supabase
            .from("lead_shares")
            .select("lead_id")
            .in("lead_id", leadIds),
        ]);
        assigneeRes.data?.forEach((r) => {
          const list = assigneesByLead.get(r.lead_id) ?? [];
          list.push({
            user_id: r.user_id,
            full_name: nameByUserId.get(r.user_id) ?? "Unnamed",
          });
          assigneesByLead.set(r.lead_id, list);
        });
        sharesRes.data?.forEach((r) => {
          shareCountByLead.set(r.lead_id, (shareCountByLead.get(r.lead_id) ?? 0) + 1);
        });
      }

      if (!error && data) {
        setLeads(
          data.map((l) => {
            const list = assigneesByLead.get(l.id) ?? [];
            // Fall back to the legacy single-assignee column if the join
            // table hasn't been backfilled for this lead yet.
            if (list.length === 0 && l.assigned_to) {
              list.push({
                user_id: l.assigned_to,
                full_name: nameByUserId.get(l.assigned_to) ?? "Unnamed",
              });
            }
            return {
              id: l.id,
              name: l.name,
              email: l.email ?? "",
              phone: l.phone ?? undefined,
              company: l.company ?? undefined,
              status: l.status as Lead["status"],
              score: l.score ?? 0,
              nextAction: l.next_action ?? undefined,
              lastContact: l.last_contact ?? undefined,
              annualKwh: l.annual_kwh ?? null,
              contractEndDate: l.contract_end_date ?? null,
              currentSupplier: l.current_supplier ?? null,
              assignedTo: l.assigned_to ?? null,
              assigneeName: l.assigned_to
                ? nameByUserId.get(l.assigned_to) ?? null
                : list[0]?.full_name ?? null,
              assignees: list,
              createdBy: (l as { created_by?: string | null }).created_by ?? null,
              shareCount: shareCountByLead.get(l.id) ?? 0,
            };
          })
        );
        setTotalCount(count ?? data.length);
      }
      setLoading(false);
    };

    fetchLeads();
  }, [organization?.id, statusFilter, search, refreshKey, isOwner, assigneeFilter]);

  // Drop any selected ids that are no longer in the visible list (e.g. after
  // filtering or refresh).
  useEffect(() => {
    setSelectedLeadIds((prev) => prev.filter((id) => leads.some((l) => l.id === id)));
  }, [leads]);

  const visibleLeadIds = useMemo(() => leads.map((l) => l.id), [leads]);
  const allVisibleSelected =
    visibleLeadIds.length > 0 && visibleLeadIds.every((id) => selectedLeadIds.includes(id));

  const bulkTemplateRecipients: BulkRecipient[] = useMemo(
    () =>
      leads
        .filter((l) => selectedLeadIds.includes(l.id))
        .map((l) => ({
          id: l.id,
          name: l.name,
          email: l.email || null,
          company: l.company ?? null,
        })),
    [leads, selectedLeadIds],
  );

  const toggleLeadSelected = useCallback((id: string, next: boolean) => {
    setSelectedLeadIds((prev) =>
      next ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id)
    );
  }, []);

  const handleSelectAllVisible = () => {
    setSelectedLeadIds(allVisibleSelected ? [] : [...visibleLeadIds]);
  };

  const handleClearSelection = () => {
    setSelectedLeadIds([]);
    setBulkAssignTargets([]);
  };

  const runBulkDelete = async (mode: "soft" | "hard") => {
    if (selectedLeadIds.length === 0) return;
    setBulkDeleting(true);
    let success = 0;
    const failures: string[] = [];
    for (const id of selectedLeadIds) {
      const { error } = await supabase.rpc("delete_lead", { p_lead_id: id, p_mode: mode });
      if (error) failures.push(error.message);
      else success += 1;
    }
    setBulkDeleting(false);
    setBulkDeleteOpen(false);
    if (success > 0) {
      const verb = mode === "hard" ? "Deleted" : "Archived";
      toast.success(`${verb} ${success} lead${success === 1 ? "" : "s"}`);
      setLeads((prev) => prev.filter((l) => !selectedLeadIds.includes(l.id)));
      setTotalCount((c) => Math.max(0, c - success));
      handleClearSelection();
    }
    if (failures.length > 0) {
      toast.error(`${failures.length} lead${failures.length === 1 ? "" : "s"} failed`, {
        description: failures[0],
      });
    }
  };

  /**
   * Bulk-assign with two distribution modes:
   *
   * 1. "share" — every selected lead is shared with every chosen employee
   *    (rows in the join table). The first picked employee becomes the
   *    primary assignee on `leads.assigned_to`.
   *
   * 2. "round_robin" — leads are distributed one-by-one across the chosen
   *    employees (lead 1 → emp A, lead 2 → emp B, lead 3 → emp A, …). Each
   *    lead ends up with exactly one assignee, and `leads.assigned_to`
   *    matches that single assignee. Existing assignees on the selected
   *    leads are replaced so the distribution is clean.
   */
  /**
   * Entry point clicked by the user. Round-robin is destructive (it wipes
   * existing assignees on the selected leads), so we require an explicit
   * confirmation prompt before running. Share is additive and runs directly.
   */
  const handleBulkAssignClick = () => {
    if (selectedLeadIds.length === 0) {
      toast.error("Select at least one lead first.");
      return;
    }
    if (bulkAssignTargets.length === 0) {
      toast.error("Pick at least one employee to assign to.");
      return;
    }
    if (bulkAssignMode === "round_robin") {
      setConfirmRoundRobinOpen(true);
      return;
    }
    void runBulkAssign();
  };

  const runBulkAssign = async () => {
    if (!organization?.id) return;
    if (selectedLeadIds.length === 0 || bulkAssignTargets.length === 0) return;
    setBulkAssigning(true);
    try {
      if (bulkAssignMode === "round_robin") {
        // Build the lead → single-employee map by rotating through targets.
        const pairs = selectedLeadIds.map((leadId, idx) => ({
          leadId,
          userId: bulkAssignTargets[idx % bulkAssignTargets.length]!,
        }));

        // 1) Wipe existing join-table rows for these leads so we don't leave
        //    stale assignees behind from a previous "share" pass.
        const { error: delErr } = await supabase
          .from("lead_assignees")
          .delete()
          .in("lead_id", selectedLeadIds);
        if (delErr) throw delErr;

        // 2) Update primary assignee per lead. We have to issue one update
        //    per lead because each gets a different user_id.
        await Promise.all(
          pairs.map(({ leadId, userId }) =>
            supabase.from("leads").update({ assigned_to: userId }).eq("id", leadId)
          )
        );

        // 3) Insert one join-table row per lead.
        const rows: TablesInsert<"lead_assignees">[] = pairs.map(({ leadId, userId }) => ({
          lead_id: leadId,
          user_id: userId,
          organization_id: organization.id,
        }));
        const { error: insErr } = await supabase
          .from("lead_assignees")
          .upsert(rows, { onConflict: "lead_id,user_id", ignoreDuplicates: true });
        if (insErr) throw insErr;

        toast.success(
          `Distributed ${selectedLeadIds.length} lead${
            selectedLeadIds.length === 1 ? "" : "s"
          } across ${bulkAssignTargets.length} employee${
            bulkAssignTargets.length === 1 ? "" : "s"
          } (round-robin)`
        );
      } else {
        // "share" mode — original behavior.
        const [primaryTarget] = bulkAssignTargets;

        const { error: updErr } = await supabase
          .from("leads")
          .update({ assigned_to: primaryTarget })
          .in("id", selectedLeadIds);
        if (updErr) throw updErr;

        const rows: TablesInsert<"lead_assignees">[] = [];
        for (const leadId of selectedLeadIds) {
          for (const target of bulkAssignTargets) {
            rows.push({
              lead_id: leadId,
              user_id: target,
              organization_id: organization.id,
            });
          }
        }
        const { error: insErr } = await supabase
          .from("lead_assignees")
          .upsert(rows, { onConflict: "lead_id,user_id", ignoreDuplicates: true });
        if (insErr) throw insErr;

        toast.success(
          `Shared ${selectedLeadIds.length} lead${
            selectedLeadIds.length === 1 ? "" : "s"
          } with ${bulkAssignTargets.length} employee${
            bulkAssignTargets.length === 1 ? "" : "s"
          }`
        );
      }
      handleClearSelection();
      handleLeadAdded();
    } catch (err) {
      console.error("[Leads] bulk-assign failed", err);
      toast.error(err instanceof Error ? err.message : "Bulk assign failed");
    } finally {
      setBulkAssigning(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground">{totalCount} total leads in pipeline</p>
        </div>
        <div className="flex gap-2">
          <ExportLeadsButton leads={leads} />
          <ImportApolloListDialog onLeadsImported={handleLeadAdded} />
          <AutoFindLeadsDialog
            onLeadsImported={handleLeadAdded}
            open={autoFindOpen}
            onOpenChange={(v) => {
              setAutoFindOpen(v);
              if (!v) setAiPrefill({});
            }}
            initialDescription={aiPrefill.desc}
            initialIndustry={aiPrefill.industry}
          />
          <ImportLeadsDialog
            onLeadsImported={handleLeadAdded}
            open={importOpen}
            onOpenChange={setImportOpen}
          />
          <AddLeadDialog
            onLeadAdded={handleLeadAdded}
            open={addOpen}
            onOpenChange={setAddOpen}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads..."
            className="h-9 w-full rounded-lg border border-input bg-input pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex gap-1.5">
          {statusFilters.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                statusFilter === s
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        {isOwner && (
          <AssigneeMultiSelect
            options={members}
            selected={assigneeFilter}
            onChange={setAssigneeFilter}
            placeholder="All assignees"
            emptyText="No employees yet."
          />
        )}
      </div>

      {isOwner && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAllVisible}
            disabled={visibleLeadIds.length === 0}
          >
            {allVisibleSelected ? "Deselect all" : "Select all visible"}
          </Button>
          <span className="text-xs text-muted-foreground">
            {selectedLeadIds.length} selected
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Distribution mode toggle — controls how multi-employee assigns
                actually distribute the selected leads. */}
            <div
              role="tablist"
              aria-label="Bulk-assign distribution mode"
              className="inline-flex rounded-md border border-border bg-background p-0.5 text-xs"
            >
              <button
                type="button"
                role="tab"
                aria-selected={bulkAssignMode === "share"}
                onClick={() => setBulkAssignMode("share")}
                title="Each selected lead is shared with every chosen employee"
                className={`rounded-sm px-2.5 py-1 transition-colors ${
                  bulkAssignMode === "share"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Share
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={bulkAssignMode === "round_robin"}
                onClick={() => setBulkAssignMode("round_robin")}
                title="Distribute leads one-by-one across the chosen employees"
                className={`rounded-sm px-2.5 py-1 transition-colors ${
                  bulkAssignMode === "round_robin"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Round-robin
              </button>
            </div>
            <AssigneeMultiSelect
              options={members}
              selected={bulkAssignTargets}
              onChange={setBulkAssignTargets}
              placeholder="Assign to employees"
              emptyText="No employees to assign."
            />
            <Button
              size="sm"
              onClick={handleBulkAssignClick}
              disabled={
                bulkAssigning ||
                selectedLeadIds.length === 0 ||
                bulkAssignTargets.length === 0
              }
              className="gap-1.5"
              title={
                bulkAssignMode === "round_robin"
                  ? "Distribute leads one-by-one across employees"
                  : "Share each lead with every chosen employee"
              }
            >
              {bulkAssigning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserPlus className="h-3.5 w-3.5" />
              )}
              {bulkAssignMode === "round_robin" ? "Distribute" : "Share"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBulkTemplateOpen(true)}
              disabled={selectedLeadIds.length === 0}
              className="gap-1.5"
              title="Personalize an outreach template with AI and send to every selected lead"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Apply template
            </Button>
            {isOwner && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBulkDeleteOpen(true)}
                disabled={selectedLeadIds.length === 0 || bulkDeleting}
                className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/40"
                title="Archive or permanently delete every selected lead"
              >
                {bulkDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Delete
              </Button>
            )}
            {selectedLeadIds.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                className="gap-1.5 text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              selectable={isOwner}
              selected={selectedLeadIds.includes(lead.id)}
              onSelectedChange={(next) => toggleLeadSelected(lead.id, next)}
              onSendEmail={
                isOwner
                  ? (l) => {
                      if (!l.email) {
                        toast.info("This lead has no email address.");
                        return;
                      }
                      setOutreachLead(l);
                      setOutreachOpen(true);
                    }
                  : undefined
              }
              canDelete={isOwner || lead.createdBy === user?.id}
              onDelete={async (l, mode) => {
                const { data, error } = await supabase.rpc("delete_lead", {
                  p_lead_id: l.id,
                  p_mode: mode,
                });
                if (error) {
                  toast.error(
                    mode === "hard" ? "Couldn't delete lead" : "Couldn't archive lead",
                    { description: error.message },
                  );
                  return;
                }
                if (mode === "hard") {
                  const removed = (data as { removed?: Record<string, number> } | null)?.removed;
                  const counts = removed
                    ? Object.entries(removed)
                        .filter(([, n]) => n > 0)
                        .map(([k, n]) => `${n} ${k.replace(/_/g, " ")}`)
                        .join(", ")
                    : "";
                  toast.success(`Deleted ${l.name}`, {
                    description: counts ? `Also removed ${counts}.` : "No related records to remove.",
                  });
                } else {
                  toast.success(`Archived ${l.name}`, {
                    description: "Tasks, messages, and conversations were preserved.",
                  });
                }
                setLeads((prev) => prev.filter((x) => x.id !== l.id));
                setSelectedLeadIds((prev) => prev.filter((id) => id !== l.id));
                setTotalCount((c) => Math.max(0, c - 1));
              }}
              onClick={() => {
                // Per org policy, only the owner can open the full lead
                // detail drawer. Reps and managers see the card data only.
                if (!isOwner) {
                  toast.info("Only the organization owner can open lead details.");
                  return;
                }
                setSelectedLead(lead);
                setDrawerOpen(true);
              }}
            />
          ))}
          {leads.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              No leads found matching your criteria
            </div>
          )}
        </div>
      )}

      {isOwner && (
        <LeadDetailDrawer
          lead={selectedLead}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onUpdated={handleLeadAdded}
        />
      )}

      {isOwner && outreachLead && (
        <OutreachPreviewDialog
          open={outreachOpen}
          onOpenChange={(next) => {
            setOutreachOpen(next);
            if (!next) setOutreachLead(null);
          }}
          lead={{
            id: outreachLead.id,
            name: outreachLead.name,
            email: outreachLead.email,
            company: outreachLead.company ?? null,
          }}
          onSent={() => {
            setOutreachOpen(false);
            setOutreachLead(null);
            handleLeadAdded();
          }}
        />
      )}

      <AlertDialog open={confirmRoundRobinOpen} onOpenChange={setConfirmRoundRobinOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Distribute leads round-robin?</AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong>replace existing assignees</strong> on{" "}
              {selectedLeadIds.length} selected lead
              {selectedLeadIds.length === 1 ? "" : "s"} and distribute them
              one-by-one across {bulkAssignTargets.length} employee
              {bulkAssignTargets.length === 1 ? "" : "s"}. Each lead will end
              up with exactly one assignee. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkAssigning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkAssigning}
              onClick={(e) => {
                e.preventDefault();
                setConfirmRoundRobinOpen(false);
                void runBulkAssign();
              }}
            >
              Distribute
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BulkApplyTemplateDialog
        open={bulkTemplateOpen}
        onOpenChange={setBulkTemplateOpen}
        recipients={bulkTemplateRecipients}
        onSent={() => {
          handleClearSelection();
          handleLeadAdded();
        }}
      />
    </div>
  );
}
