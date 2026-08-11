import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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
import { fmtDate, fmtKwh, fmtMils, fmtMoney, fmtRate, fmtText, oneLineAddress } from "~/lib/format";
import { DomainTerm } from "~/components/domain-term";
import type { CurrentClientRow, ListPage } from "~/lib/types";
import type { Route } from "./+types/current-clients";

export function meta() {
  return [{ title: "Current Clients · VireCRM" }];
}

function fetchPage(cursor?: string | null): Promise<ListPage<CurrentClientRow>> {
  const qs = new URLSearchParams({ limit: "100" });
  if (cursor) qs.set("cursor", cursor);
  return apiFetch(`/api/current-clients?${qs}`);
}

export async function clientLoader() {
  return { page: await fetchPage() };
}

export function HydrateFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

// Rows arrive flat (one per active contract); group per customer for display.
function groupByCustomer(rows: CurrentClientRow[]) {
  const groups = new Map<string, { customerName: string; rows: CurrentClientRow[] }>();
  for (const row of rows) {
    let g = groups.get(row.customerId);
    if (!g) {
      g = { customerName: row.customerName, rows: [] };
      groups.set(row.customerId, g);
    }
    g.rows.push(row);
  }
  return [...groups.entries()].sort(([, a], [, b]) =>
    a.customerName.localeCompare(b.customerName),
  );
}

export default function CurrentClients({ loaderData }: Route.ComponentProps) {
  const [rows, setRows] = useState(loaderData.page.items);
  const [nextCursor, setNextCursor] = useState(loaderData.page.nextCursor);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (!nextCursor) return;
    setLoading(true);
    try {
      const page = await fetchPage(nextCursor);
      setRows((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      toast.error("Couldn't load more clients", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  const groups = groupByCustomer(rows);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          <DomainTerm term="Current Clients" />
        </h1>
        <p className="text-sm text-muted-foreground">
          Customers with at least one active contract — the live book of business.
        </p>
      </div>
      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No active contracts yet.
        </p>
      ) : (
        groups.map(([customerId, g]) => (
          <Card key={customerId}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-baseline justify-between gap-2 text-base">
                <Link to={`/customers/${customerId}`} className="hover:underline">
                  {g.customerName}
                </Link>
                <span className="text-xs font-normal text-muted-foreground">
                  {g.rows.length} active contract{g.rows.length === 1 ? "" : "s"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <DomainTerm term="ESI ID" />
                      </TableHead>
                      <TableHead>Service address</TableHead>
                      <TableHead>
                        <DomainTerm term="REP">Supplier</DomainTerm>
                      </TableHead>
                      <TableHead>Supply type</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>
                        <DomainTerm term="Mils" />
                      </TableHead>
                      <TableHead>Annual usage</TableHead>
                      <TableHead>
                        <DomainTerm term="Net TCV" />
                      </TableHead>
                      <TableHead>
                        <DomainTerm term="Is Live">Live</DomainTerm>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.rows.map((row) => (
                      <TableRow key={row.contractId}>
                        <TableCell className="font-mono text-xs">
                          <Link to={`/contracts/${row.contractId}`} className="hover:underline">
                            {row.esiId}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-56 truncate" title={oneLineAddress(row)}>
                          {oneLineAddress(row)}
                        </TableCell>
                        <TableCell>{fmtText(row.supplier)}</TableCell>
                        <TableCell>{fmtText(row.supplyType)}</TableCell>
                        <TableCell>{fmtDate(row.startDate)}</TableCell>
                        <TableCell>{fmtDate(row.endDate)}</TableCell>
                        <TableCell>{fmtRate(row.costPerKwh, row.currency)}</TableCell>
                        <TableCell>{fmtMils(row.agentMils)}</TableCell>
                        <TableCell>{fmtKwh(row.annualUsageKwh)}</TableCell>
                        <TableCell>{fmtMoney(row.netTcv, row.currency)}</TableCell>
                        <TableCell>
                          {row.isLive ? (
                            <Badge>Live</Badge>
                          ) : (
                            <Badge variant="secondary">Signed</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))
      )}
      {nextCursor ? (
        <Button variant="outline" disabled={loading} onClick={loadMore}>
          {loading ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}
