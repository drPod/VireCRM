import { useEffect, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";
import { useLeadActions } from "@/hooks/useLeadActions";
import { useLeadActivity } from "@/hooks/useLeadActivity";
import { useLeadBillingSummary } from "@/hooks/useLeadBillingSummary";
import { useLeadEmailLogs } from "@/hooks/useLeadEmailLogs";
import { useLeadForm } from "@/hooks/useLeadForm";
import { LeadActivityTab } from "./LeadActivityTab";
import { LeadBillingSummaryCard } from "./LeadBillingSummaryCard";
import { LeadDetailDrawerHeader } from "./LeadDetailDrawerHeader";
import { LeadDetailsForm, useDealValidation } from "./LeadDetailsForm";
import { LeadEmailsTab } from "./LeadEmailsTab";
import { LeadInvoicesPanel } from "./LeadInvoicesPanel";
import { OutreachPreviewDialog } from "./OutreachPreviewDialog";
import type { Lead } from "./LeadCard";
import type { LeadDrawerTab } from "./LeadDetailDrawer.types";

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

  const {
    form,
    update,
    loadingNotes,
    members,
    assigneeIds,
    setAssigneeIds,
    initialAssigneeIds,
    setInitialAssigneeIds,
  } = useLeadForm(lead, organization?.id);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<LeadDrawerTab>("details");
  const [activityRefetchKey, setActivityRefetchKey] = useState(0);

  const { activities, loadingActivity } = useLeadActivity(lead, activityRefetchKey);
  const { emailLogs, loadingEmailLogs, refresh: refreshEmailLogs } = useLeadEmailLogs(
    lead,
    form.email,
    activeTab === "emails",
  );
  const { billingSummary } = useLeadBillingSummary(lead?.id, organization?.id);

  const dealValidation = useDealValidation(form.deal_value);

  const {
    saving,
    markingWon,
    deleting,
    confirmDelete,
    setConfirmDelete,
    handleSave,
    handleMarkWon,
    handleDelete,
  } = useLeadActions({
    lead,
    organizationId: organization?.id,
    form,
    update,
    canAssign,
    assigneeIds,
    initialAssigneeIds,
    setInitialAssigneeIds,
    onUpdated,
    onOpenChange,
    onOptimisticPatch,
    bumpActivityRefetch: () => setActivityRefetchKey((k) => k + 1),
  });

  // Reset transient UI state on lead change. (Form reset lives in useLeadForm,
  // delete-confirm reset lives in useLeadActions when handleDelete fires.)
  useEffect(() => {
    if (!lead) return;
    setConfirmDelete(false);
    setActiveTab("details");
  }, [lead, setConfirmDelete]);

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

  if (!lead) return null;

  const effectiveEmail = (form.email.trim() || lead.email || "").trim();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <LeadDetailDrawerHeader
          lead={lead}
          formName={form.name}
          formEmail={form.email}
          formPhone={form.phone}
          effectiveEmail={effectiveEmail}
          assigneeIds={assigneeIds}
          members={members}
          activities={activities}
          emailLogs={emailLogs}
          billingSummary={billingSummary}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onOpenPreview={handleOpenPreview}
          onScored={(s) => update("score", s)}
          onActed={handleSent}
        />

        {/* Billing summary — visible on every tab once an invoice exists */}
        {billingSummary && billingSummary.count > 0 && (
          <LeadBillingSummaryCard
            summary={billingSummary}
            onOpenInvoices={() => setActiveTab("invoices")}
          />
        )}

        {activeTab === "details" ? (
          <LeadDetailsForm
            lead={lead}
            form={form}
            update={update}
            loadingNotes={loadingNotes}
            members={members}
            assigneeIds={assigneeIds}
            setAssigneeIds={setAssigneeIds}
            canAssign={canAssign}
            dealValidation={dealValidation}
            saving={saving}
            deleting={deleting}
            markingWon={markingWon}
            confirmDelete={confirmDelete}
            onCancelDelete={() => setConfirmDelete(false)}
            onSave={handleSave}
            onMarkWon={handleMarkWon}
            onDelete={handleDelete}
          />
        ) : activeTab === "activity" ? (
          <LeadActivityTab activities={activities} loading={loadingActivity} />
        ) : activeTab === "emails" ? (
          <LeadEmailsTab
            email={effectiveEmail}
            emailLogs={emailLogs}
            loading={loadingEmailLogs}
            onRefresh={() => void refreshEmailLogs()}
          />
        ) : null}
        {activeTab === "invoices" && organization?.id && (
          <LeadInvoicesPanel
            leadId={lead.id}
            leadName={form.name.trim() || lead.name}
            leadEmail={form.email.trim() || lead.email || null}
            organizationId={organization.id}
          />
        )}
      </SheetContent>
      {effectiveEmail ? (
        <OutreachPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          lead={{
            id: lead.id,
            name: form.name.trim() || lead.name,
            email: effectiveEmail,
            company: form.company.trim() || lead.company || null,
            role: (lead as { role?: string | null }).role ?? null,
          }}
          onSent={handleSent}
        />
      ) : null}
    </Sheet>
  );
}
