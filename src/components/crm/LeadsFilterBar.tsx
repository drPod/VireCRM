import { Search } from "lucide-react";
import { AssigneeMultiSelect, type AssigneeOption } from "@/components/crm/AssigneeMultiSelect";

type LeadsFilterBarProps = {
  search: string;
  onSearchChange: (next: string) => void;
  statusFilters: readonly string[];
  statusFilter: string;
  onStatusFilterChange: (next: string) => void;
  isOwner: boolean;
  members: AssigneeOption[];
  assigneeFilter: string[];
  onAssigneeFilterChange: (next: string[]) => void;
};

export function LeadsFilterBar({
  search,
  onSearchChange,
  statusFilters,
  statusFilter,
  onStatusFilterChange,
  isOwner,
  members,
  assigneeFilter,
  onAssigneeFilterChange,
}: LeadsFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search leads..."
          className="h-9 w-full rounded-lg border border-input bg-input pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="flex gap-1.5">
        {statusFilters.map((s) => (
          <button
            key={s}
            onClick={() => onStatusFilterChange(s)}
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
          onChange={onAssigneeFilterChange}
          placeholder="All assignees"
          emptyText="No employees yet."
        />
      )}
    </div>
  );
}
