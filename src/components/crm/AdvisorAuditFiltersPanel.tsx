import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StatusFilter } from "./advisor-audit.types";

interface UserOption {
  id: string;
  name: string;
}

interface AdvisorAuditFiltersPanelProps {
  search: string;
  onSearchChange: (v: string) => void;
  userFilter: string;
  onUserFilterChange: (v: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (v: StatusFilter) => void;
  dateFrom: string;
  onDateFromChange: (v: string) => void;
  dateTo: string;
  onDateToChange: (v: string) => void;
  userOptions: UserOption[];
  activeFilterCount: number;
  filteredCount: number;
  totalCount: number;
  onClear: () => void;
}

export function AdvisorAuditFiltersPanel({
  search,
  onSearchChange,
  userFilter,
  onUserFilterChange,
  statusFilter,
  onStatusFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  userOptions,
  activeFilterCount,
  filteredCount,
  totalCount,
  onClear,
}: AdvisorAuditFiltersPanelProps) {
  return (
    <div className="border-b border-border bg-background/30 px-5 py-3 space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search command text or summary…"
          value={search}
          onChange={(ev) => onSearchChange(ev.target.value)}
          className="h-8 text-sm pl-8 pr-8"
        />
        {search && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <Label className="text-[11px] font-semibold text-muted-foreground">User</Label>
          <Select value={userFilter} onValueChange={onUserFilterChange}>
            <SelectTrigger className="h-8 text-xs mt-1">
              <SelectValue placeholder="All users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {userOptions.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-[11px] font-semibold text-muted-foreground">Status</Label>
          <Select
            value={statusFilter}
            onValueChange={(v) => onStatusFilterChange(v as StatusFilter)}
          >
            <SelectTrigger className="h-8 text-xs mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              <SelectItem value="success">Success only</SelectItem>
              <SelectItem value="errors">With errors</SelectItem>
              <SelectItem value="skipped">With skipped</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-[11px] font-semibold text-muted-foreground">From</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(ev) => onDateFromChange(ev.target.value)}
            className="h-8 text-xs mt-1"
          />
        </div>

        <div>
          <Label className="text-[11px] font-semibold text-muted-foreground">To</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(ev) => onDateToChange(ev.target.value)}
            className="h-8 text-xs mt-1"
          />
        </div>
      </div>

      {activeFilterCount > 0 && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-muted-foreground">
            Showing {filteredCount} of {totalCount} entries
          </span>
          <Button size="sm" variant="ghost" onClick={onClear} className="h-7 text-xs">
            <X className="h-3 w-3 mr-1" />
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
