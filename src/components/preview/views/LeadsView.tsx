import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  Download,
  Filter,
  Mail,
  Phone,
  Plus,
  Search,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LEADS, leadCountByStatus, type LeadStatus } from "../data/leads";

const STATUSES: LeadStatus[] = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"];

function statusColor(status: LeadStatus): string {
  switch (status) {
    case "New":
      return "bg-[oklch(0.65_0.15_250)]/15 text-[oklch(0.65_0.15_250)]";
    case "Contacted":
      return "bg-[oklch(0.65_0.18_280)]/15 text-[oklch(0.65_0.18_280)]";
    case "Qualified":
      return "bg-primary/15 text-primary";
    case "Proposal":
      return "bg-[oklch(0.7_0.18_50)]/15 text-[oklch(0.7_0.18_50)]";
    case "Won":
      return "bg-success/15 text-success";
    case "Lost":
      return "bg-destructive/10 text-destructive/80";
  }
}

function scoreColor(score: number): string {
  if (score >= 85) return "text-success";
  if (score >= 70) return "text-primary";
  if (score >= 50) return "text-foreground";
  return "text-muted-foreground";
}

export function LeadsView() {
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "All">("All");
  const [query, setQuery] = useState("");
  const counts = useMemo(() => leadCountByStatus(), []);

  const filtered = useMemo(() => {
    let rows = LEADS;
    if (statusFilter !== "All") rows = rows.filter((r) => r.status === statusFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.company.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [statusFilter, query]);

  const totalValue = filtered.reduce((sum, r) => sum + r.value, 0);

  return (
    <div data-tour="leads-table" className="space-y-6 scroll-mt-24">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total leads</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{LEADS.length}</p>
            </div>
            <Users className="h-4 w-4 text-primary" />
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">In pipeline value</p>
          <p className="mt-1 text-2xl font-bold text-foreground">${totalValue.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Hot (≥85)</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {LEADS.filter((l) => l.score >= 85).length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Won this month</p>
          <p className="mt-1 text-2xl font-bold text-success">{counts.Won}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border/60 p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-preview-allow="true"
              placeholder="Search leads, companies, IDs…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 pl-9"
            />
          </div>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 cursor-not-allowed opacity-70"
                  aria-disabled="true"
                  onClick={(e) => e.preventDefault()}
                >
                  <Filter className="h-3.5 w-3.5" />
                  More filters
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sign up to save custom filter views.</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 cursor-not-allowed opacity-70"
                  aria-disabled="true"
                  onClick={(e) => e.preventDefault()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Import
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sign up to import your real lead lists.</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 cursor-not-allowed opacity-70"
                  aria-disabled="true"
                  onClick={(e) => e.preventDefault()}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sign up to export filtered lead lists.</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="command"
                  size="sm"
                  className="gap-1.5 cursor-not-allowed opacity-70"
                  aria-disabled="true"
                  onClick={(e) => e.preventDefault()}
                >
                  <Plus className="h-3.5 w-3.5" />
                  New lead
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sign up to create real leads.</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
          <button
            type="button"
            data-preview-allow="true"
            onClick={() => setStatusFilter("All")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ${
              statusFilter === "All"
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            All <span className="ml-1 text-[10px] opacity-70">{LEADS.length}</span>
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              data-preview-allow="true"
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                statusFilter === s
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {s} <span className="ml-1 text-[10px] opacity-70">{counts[s]}</span>
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[44px]">
                  <input
                    type="checkbox"
                    aria-label="Select all (read-only preview)"
                    disabled
                    className="cursor-not-allowed accent-primary"
                  />
                </TableHead>
                <TableHead>
                  <span className="inline-flex items-center gap-1">
                    Name <ArrowUpDown className="h-3 w-3 opacity-50" />
                  </span>
                </TableHead>
                <TableHead className="hidden sm:table-cell">Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Source</TableHead>
                <TableHead className="hidden lg:table-cell">Owner</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1">
                    Score <Sparkles className="h-3 w-3 text-primary" />
                  </span>
                </TableHead>
                <TableHead className="hidden xl:table-cell">Last touch</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l) => (
                <TableRow key={l.id} className="hover:bg-muted/30">
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`Select ${l.name} (read-only preview)`}
                      disabled
                      className="cursor-not-allowed accent-primary"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-[oklch(0.65_0.16_320)]/30 text-[10px] font-semibold text-foreground">
                        {l.initials}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{l.name}</p>
                        <p className="text-xs text-muted-foreground">{l.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <p className="text-sm text-foreground">{l.company}</p>
                    <p className="text-xs text-muted-foreground">{l.vertical}</p>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusColor(
                        l.status,
                      )}`}
                    >
                      {l.status}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className="text-[10px]">
                      {l.source}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-foreground">
                    {l.owner}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium text-foreground">
                    {l.value > 0 ? `$${l.value.toLocaleString()}` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`text-sm font-semibold ${scoreColor(l.score)}`}>
                      {l.score}
                    </span>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                    {l.lastTouch}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    No leads match your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
          <span>
            Showing {filtered.length} of {LEADS.length} demo leads
          </span>
          <div className="flex items-center gap-2">
            <Phone className="h-3 w-3" />
            <Mail className="h-3 w-3" />
            <span>Bulk-actions disabled in preview</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
