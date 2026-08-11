import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { DomainTerm } from "~/components/domain-term";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { apiFetch } from "~/lib/api";
import { fmtKwh, fmtMils, fmtMoney, fmtText } from "~/lib/format";
import type { ListPage, ReconciliationRow } from "~/lib/types";
import type { Route } from "./+types/reconciliation";

export function meta() {
  return [{ title: "Reconciliation · VireCRM" }];
}

const STATUS_OPTIONS = ["all", "short", "pending", "matched", "over", "unknown"] as const;
type StatusOption = (typeof STATUS_OPTIONS)[number];

function fetchPage(
  status: StatusOption,
  cursor?: string | null,
): Promise<ListPage<ReconciliationRow>> {
  const qs = new URLSearchParams({ limit: "100" });
  if (status !== "all") qs.set("status", status);
  if (cursor) qs.set("cursor", cursor);
  return apiFetch(`/api/commission-reconciliation?${qs}`);
}

export async function clientLoader() {
  return { page: await fetchPage("all") };
}

export function HydrateFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

// Billed AQ minus EAC; negative = billed under estimate (commission shortfall risk).
function aqVariance(row: ReconciliationRow): number | null {
  if (row.billedAqKwh == null || row.eacKwh == null) return null;
  return Number(row.billedAqKwh) - Number(row.eacKwh);
}

function VarianceCell({ row }: { row: ReconciliationRow }) {
  const v = aqVariance(row);
  if (v === null) return <span className="text-muted-foreground">—</span>;
  const label = `${v > 0 ? "+" : ""}${v.toLocaleString()} kWh`;
  if (v < 0) return <span className="font-medium text-destructive">{label}</span>;
  return <span>{label}</span>;
}

function StatusCell({ row }: { row: ReconciliationRow }) {
  return (
    <div className="flex flex-wrap gap-1">
      {row.shortCount > 0 && <Badge variant="destructive">{row.shortCount} short</Badge>}
      {row.pendingCount > 0 && <Badge variant="secondary">{row.pendingCount} pending</Badge>}
      {row.overCount > 0 && <Badge variant="outline">{row.overCount} over</Badge>}
      {row.matchedCount > 0 && <Badge variant="outline">{row.matchedCount} matched</Badge>}
      {row.unknownCount > 0 && <Badge variant="outline">{row.unknownCount} unknown</Badge>}
    </div>
  );
}

export default function Reconciliation({ loaderData }: Route.ComponentProps) {
  const [rows, setRows] = useState(loaderData.page.items);
  const [nextCursor, setNextCursor] = useState(loaderData.page.nextCursor);
  const [status, setStatus] = useState<StatusOption>("all");
  const [loading, setLoading] = useState(false);

  async function changeStatus(next: StatusOption) {
    setStatus(next);
    setLoading(true);
    try {
      const page = await fetchPage(next);
      setRows(page.items);
      setNextCursor(page.nextCursor);
    } catch (err) {
      toast.error("Couldn't load the report", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoading(true);
    try {
      const page = await fetchPage(status, nextCursor);
      setRows((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      toast.error("Couldn't load more rows", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Commission reconciliation</h1>
          <p className="text-sm text-muted-foreground">
            Statement totals per contract — commission is paid on <DomainTerm term="Billing AQ" />,
            not <DomainTerm term="EAC" />.
          </p>
        </div>
        <Select value={status} onValueChange={(v) => changeStatus(v as StatusOption)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All statuses" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No commission statements{status === "all" ? "" : ` with a ${status} line`} yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>
                  <DomainTerm term="ESI ID" />
                </TableHead>
                <TableHead>
                  <DomainTerm term="REP">Supplier</DomainTerm>
                </TableHead>
                <TableHead>
                  <DomainTerm term="Mils" />
                </TableHead>
                <TableHead>
                  <DomainTerm term="EAC" />
                </TableHead>
                <TableHead>
                  <DomainTerm term="Billing AQ">Billed AQ</DomainTerm>
                </TableHead>
                <TableHead>AQ variance</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>Statements</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.contractId}>
                  <TableCell>
                    <Link to={`/customers/${row.customerId}`} className="hover:underline">
                      {row.customerName}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <Link to={`/contracts/${row.contractId}`} className="hover:underline">
                      {row.esiId}
                    </Link>
                  </TableCell>
                  <TableCell>{fmtText(row.supplier)}</TableCell>
                  <TableCell>{fmtMils(row.agentMils)}</TableCell>
                  <TableCell>{fmtKwh(row.eacKwh)}</TableCell>
                  <TableCell>{fmtKwh(row.billedAqKwh)}</TableCell>
                  <TableCell>
                    <VarianceCell row={row} />
                  </TableCell>
                  <TableCell>{fmtMoney(row.expectedTotal, row.currency)}</TableCell>
                  <TableCell>{fmtMoney(row.receivedTotal, row.currency)}</TableCell>
                  <TableCell>{fmtMoney(row.outstandingTotal, row.currency)}</TableCell>
                  <TableCell>{row.statementCount}</TableCell>
                  <TableCell>
                    <StatusCell row={row} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {nextCursor ? (
        <Button variant="outline" disabled={loading} onClick={loadMore}>
          {loading ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}
