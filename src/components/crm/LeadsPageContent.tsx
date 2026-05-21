import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { type Lead } from "@/components/crm/LeadCard";
import { AddLeadDialog } from "@/components/crm/AddLeadDialog";
import { ImportLeadsDialog } from "@/components/crm/ImportLeadsDialog";
import { AutoFindLeadsDialog } from "@/components/crm/AutoFindLeadsDialog";
import { ImportApolloListDialog } from "@/components/crm/ImportApolloListDialog";
import { LeadDetailDrawer } from "@/components/crm/LeadDetailDrawer";
import { OutreachPreviewDialog } from "@/components/crm/OutreachPreviewDialog";
import { ExportLeadsButton } from "@/components/crm/ExportLeadsButton";
import { TestAccountButton } from "@/components/admin/TestAccountButton";
import { BulkApplyTemplateDialog } from "@/components/crm/BulkApplyTemplateDialog";
import { LeadsFilterBar } from "@/components/crm/LeadsFilterBar";
import { LeadsBulkControls } from "@/components/crm/LeadsBulkControls";
import { LeadsListView } from "@/components/crm/LeadsListView";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLeadsList } from "@/hooks/useLeadsList";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useLeadsBulkActions } from "@/hooks/useLeadsBulkActions";
import type { LeadsSearch } from "@/lib/leads-types";

export type LeadsPageContentProps = {
  statusFilters: readonly string[];
  search: LeadsSearch;
};

export function LeadsPageContent({ statusFilters, search: routeSearch }: LeadsPageContentProps) {
  const { organization, role, user } = useAuth();
  const isOwner = role?.role === "owner";
  const navigate = useNavigate();
  const { q, action, ai_desc, ai_industry } = routeSearch;
  const [search, setSearch] = useState(q ?? "");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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
  // Owner-only: which assignees the owner is filtering the list by (union/OR).
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);
  // Bulk apply outreach template (any role) — opens the personalize+send dialog.
  const [bulkTemplateOpen, setBulkTemplateOpen] = useState(false);

  // Sync search input when URL ?q= changes (e.g., navigating from AI Advisor)
  useEffect(() => {
    if (q !== undefined) setSearch(q);
  }, [q]);

  // Auto-open dialogs from ?action= and clear the param so refresh doesn't reopen.
  useEffect(() => {
    if (action === "add") {
      setAddOpen(true);
      navigate({
        to: "/leads",
        search: (prev: LeadsSearch) => ({ ...prev, action: undefined }),
        replace: true,
      });
    } else if (action === "import") {
      setImportOpen(true);
      navigate({
        to: "/leads",
        search: (prev: LeadsSearch) => ({ ...prev, action: undefined }),
        replace: true,
      });
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

  const { leads, setLeads, loading, totalCount, setTotalCount, refresh } = useLeadsList({
    organizationId: organization?.id,
    isOwner,
    statusFilter,
    search,
    assigneeFilter,
  });

  const handleLeadAdded = useCallback(() => refresh(), [refresh]);

  const members = useOrgMembers(organization?.id, isOwner);

  const bulk = useLeadsBulkActions({
    organizationId: organization?.id,
    leads,
    setLeads,
    totalCount,
    setTotalCount,
    statusFilter,
    onChanged: handleLeadAdded,
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground">{totalCount} total leads in pipeline</p>
        </div>
        <div className="flex gap-2">
          <TestAccountButton />
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
          <AddLeadDialog onLeadAdded={handleLeadAdded} open={addOpen} onOpenChange={setAddOpen} />
        </div>
      </div>

      <LeadsFilterBar
        search={search}
        onSearchChange={setSearch}
        statusFilters={statusFilters}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        isOwner={isOwner}
        members={members}
        assigneeFilter={assigneeFilter}
        onAssigneeFilterChange={setAssigneeFilter}
      />

      {isOwner && (
        <LeadsBulkControls
          members={members}
          statusFilters={statusFilters}
          selectedLeadIds={bulk.selectedLeadIds}
          visibleLeadIds={bulk.visibleLeadIds}
          allVisibleSelected={bulk.allVisibleSelected}
          onSelectAllVisible={bulk.handleSelectAllVisible}
          onClearSelection={bulk.handleClearSelection}
          bulkAssignMode={bulk.bulkAssignMode}
          onBulkAssignModeChange={bulk.setBulkAssignMode}
          bulkAssignTargets={bulk.bulkAssignTargets}
          onBulkAssignTargetsChange={bulk.setBulkAssignTargets}
          bulkAssigning={bulk.bulkAssigning}
          onBulkAssignClick={bulk.handleBulkAssignClick}
          confirmRoundRobinOpen={bulk.confirmRoundRobinOpen}
          onConfirmRoundRobinOpenChange={bulk.setConfirmRoundRobinOpen}
          onConfirmRoundRobinRun={() => {
            bulk.setConfirmRoundRobinOpen(false);
            void bulk.runBulkAssign();
          }}
          onApplyTemplateClick={() => setBulkTemplateOpen(true)}
          bulkMoveStatus={bulk.bulkMoveStatus}
          onBulkMoveStatusChange={bulk.setBulkMoveStatus}
          bulkMoving={bulk.bulkMoving}
          onBulkMove={(status) => void bulk.runBulkMove(status)}
          bulkDeleteOpen={bulk.bulkDeleteOpen}
          onBulkDeleteOpenChange={bulk.setBulkDeleteOpen}
          bulkDeleting={bulk.bulkDeleting}
          onBulkDelete={(mode) => void bulk.runBulkDelete(mode)}
        />
      )}

      <LeadsListView
        leads={leads}
        setLeads={setLeads}
        setTotalCount={setTotalCount}
        loading={loading}
        isOwner={isOwner}
        userId={user?.id}
        selectedLeadIds={bulk.selectedLeadIds}
        setSelectedLeadIds={bulk.setSelectedLeadIds}
        onToggleSelected={bulk.toggleLeadSelected}
        onSendEmail={(l) => {
          setOutreachLead(l);
          setOutreachOpen(true);
        }}
        onOpenDetail={(lead) => {
          setSelectedLead(lead);
          setDrawerOpen(true);
        }}
      />

      {isOwner && (
        <LeadDetailDrawer
          lead={selectedLead}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onUpdated={handleLeadAdded}
          onOptimisticPatch={(id, patch) =>
            setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
          }
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

      <BulkApplyTemplateDialog
        open={bulkTemplateOpen}
        onOpenChange={setBulkTemplateOpen}
        recipients={bulk.bulkTemplateRecipients}
        onSent={() => {
          bulk.handleClearSelection();
          handleLeadAdded();
        }}
      />
    </div>
  );
}
