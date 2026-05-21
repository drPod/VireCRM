import { Loader2, UserPlus, X, Wand2, Trash2, MoveRight } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AssigneeMultiSelect, type AssigneeOption } from "@/components/crm/AssigneeMultiSelect";
import type { BulkAssignMode, BulkDeleteMode } from "@/lib/leads-types";

type LeadsBulkControlsProps = {
  members: AssigneeOption[];
  statusFilters: readonly string[];

  selectedLeadIds: string[];
  visibleLeadIds: string[];
  allVisibleSelected: boolean;
  onSelectAllVisible: () => void;
  onClearSelection: () => void;

  bulkAssignMode: BulkAssignMode;
  onBulkAssignModeChange: (next: BulkAssignMode) => void;
  bulkAssignTargets: string[];
  onBulkAssignTargetsChange: (next: string[]) => void;
  bulkAssigning: boolean;
  onBulkAssignClick: () => void;
  confirmRoundRobinOpen: boolean;
  onConfirmRoundRobinOpenChange: (next: boolean) => void;
  onConfirmRoundRobinRun: () => void;

  onApplyTemplateClick: () => void;

  bulkMoveStatus: string;
  onBulkMoveStatusChange: (next: string) => void;
  bulkMoving: boolean;
  onBulkMove: (status: string) => void;

  bulkDeleteOpen: boolean;
  onBulkDeleteOpenChange: (next: boolean) => void;
  bulkDeleting: boolean;
  onBulkDelete: (mode: BulkDeleteMode) => void;
};

export function LeadsBulkControls({
  members,
  statusFilters,
  selectedLeadIds,
  visibleLeadIds,
  allVisibleSelected,
  onSelectAllVisible,
  onClearSelection,
  bulkAssignMode,
  onBulkAssignModeChange,
  bulkAssignTargets,
  onBulkAssignTargetsChange,
  bulkAssigning,
  onBulkAssignClick,
  confirmRoundRobinOpen,
  onConfirmRoundRobinOpenChange,
  onConfirmRoundRobinRun,
  onApplyTemplateClick,
  bulkMoveStatus,
  onBulkMoveStatusChange,
  bulkMoving,
  onBulkMove,
  bulkDeleteOpen,
  onBulkDeleteOpenChange,
  bulkDeleting,
  onBulkDelete,
}: LeadsBulkControlsProps) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onSelectAllVisible}
          disabled={visibleLeadIds.length === 0}
        >
          {allVisibleSelected ? "Deselect all" : "Select all visible"}
        </Button>
        <span className="text-xs text-muted-foreground">{selectedLeadIds.length} selected</span>

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
              onClick={() => onBulkAssignModeChange("share")}
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
              onClick={() => onBulkAssignModeChange("round_robin")}
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
            onChange={onBulkAssignTargetsChange}
            placeholder="Assign to employees"
            emptyText="No employees to assign."
          />
          <Button
            size="sm"
            onClick={onBulkAssignClick}
            disabled={
              bulkAssigning || selectedLeadIds.length === 0 || bulkAssignTargets.length === 0
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
            onClick={onApplyTemplateClick}
            disabled={selectedLeadIds.length === 0}
            className="gap-1.5"
            title="Personalize an outreach template with AI and send to every selected lead"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Apply template
          </Button>
          {/* Bulk move to a pipeline stage — optimistic relocation across
              the leads list and pipeline view. */}
          <div className="flex items-center gap-1.5">
            <Select
              value={bulkMoveStatus}
              onValueChange={onBulkMoveStatusChange}
              disabled={selectedLeadIds.length === 0 || bulkMoving}
            >
              <SelectTrigger className="h-9 w-[150px] text-xs" aria-label="Move to stage">
                <SelectValue placeholder="Move to stage…" />
              </SelectTrigger>
              <SelectContent>
                {statusFilters
                  .filter((s) => s !== "all")
                  .map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onBulkMove(bulkMoveStatus)}
              disabled={bulkMoving || selectedLeadIds.length === 0 || !bulkMoveStatus}
              className="gap-1.5"
              title="Move every selected lead to the chosen pipeline stage"
            >
              {bulkMoving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MoveRight className="h-3.5 w-3.5" />
              )}
              Move
            </Button>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onBulkDeleteOpenChange(true)}
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
          {selectedLeadIds.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="gap-1.5 text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={confirmRoundRobinOpen} onOpenChange={onConfirmRoundRobinOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Distribute leads round-robin?</AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong>replace existing assignees</strong> on {selectedLeadIds.length}{" "}
              selected lead
              {selectedLeadIds.length === 1 ? "" : "s"} and distribute them one-by-one across{" "}
              {bulkAssignTargets.length} employee
              {bulkAssignTargets.length === 1 ? "" : "s"}. Each lead will end up with exactly one
              assignee. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkAssigning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkAssigning}
              onClick={(e) => {
                e.preventDefault();
                onConfirmRoundRobinRun();
              }}
            >
              Distribute
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={bulkDeleteOpen}
        onOpenChange={(o) => !bulkDeleting && onBulkDeleteOpenChange(o)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedLeadIds.length} lead{selectedLeadIds.length === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>Choose how to remove the selected leads from your CRM.</p>
                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-2">
                  <p>
                    <strong className="text-foreground">Archive</strong> — hides the leads but keeps
                    related tasks, messages, and conversations.
                  </p>
                  <p>
                    <strong className="text-destructive">Permanently delete</strong> — removes the
                    leads and every related record. This cannot be undone.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkDeleting}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
              onClick={(e) => {
                e.preventDefault();
                onBulkDelete("soft");
              }}
            >
              Archive
            </AlertDialogAction>
            <AlertDialogAction
              disabled={bulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                onBulkDelete("hard");
              }}
            >
              Permanently delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
