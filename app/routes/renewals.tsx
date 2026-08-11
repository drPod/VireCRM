import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { DomainTerm } from "~/components/domain-term";
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
import { fmtDate, fmtKwh, fmtMils, fmtMoney, fmtText, oneLineAddress } from "~/lib/format";
import type { ListPage, RenewalRow } from "~/lib/types";
import type { Route } from "./+types/renewals";

export function meta() {
  return [{ title: "Renewals · VireCRM" }];
}

type RenewalPage = ListPage<RenewalRow> & { windowStart: string; windowEnd: string };

function fetchPage(cursor?: string | null): Promise<RenewalPage> {
  const qs = new URLSearchParams({ limit: "200", days: "90" });
  if (cursor) qs.set("cursor", cursor);
  return apiFetch(`/api/renewals?${qs}`);
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

function daysUntil(endDate: string, windowStart: string): number {
  return Math.round((Date.parse(endDate) - Date.parse(windowStart)) / 86_400_000);
}

const BUCKETS = [
  { label: "Next 30 days", max: 30 },
  { label: "31–60 days", max: 60 },
  { label: "61–90 days", max: 90 },
] as const;

function bucketOf(days: number): number {
  return days <= 30 ? 0 : days <= 60 ? 1 : 2;
}

function DaysLeftBadge({ days }: { days: number }) {
  if (days <= 30) return <Badge variant="destructive">{days}d</Badge>;
  if (days <= 60) return <Badge variant="secondary">{days}d</Badge>;
  return <Badge variant="outline">{days}d</Badge>;
}

export default function Renewals({ loaderData }: Route.ComponentProps) {
  const [rows, setRows] = useState(loaderData.page.items);
  const [nextCursor, setNextCursor] = useState(loaderData.page.nextCursor);
  const [loading, setLoading] = useState(false);
  const windowStart = loaderData.page.windowStart;

  async function loadMore() {
    if (!nextCursor) return;
    setLoading(true);
    try {
      const page = await fetchPage(nextCursor);
      setRows((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      toast.error("Couldn't load more renewals", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  const buckets: RenewalRow[][] = [[], [], []];
  for (const row of rows) {
    buckets[bucketOf(daysUntil(row.endDate, windowStart))]!.push(row);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Renewals</h1>
        <p className="text-sm text-muted-foreground">
          Active contracts ending in the next 90 days — the renewal pipeline.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No contracts end in the next 90 days.
        </p>
      ) : (
        BUCKETS.map((bucket, i) =>
          buckets[i]!.length === 0 ? null : (
            <Card key={bucket.label}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-baseline justify-between gap-2 text-base">
                  {bucket.label}
                  <span className="text-xs font-normal text-muted-foreground">
                    {buckets[i]!.length} contract{buckets[i]!.length === 1 ? "" : "s"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>End</TableHead>
                        <TableHead>Days left</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>
                          <DomainTerm term="ESI ID" />
                        </TableHead>
                        <TableHead>Service address</TableHead>
                        <TableHead>
                          <DomainTerm term="REP">Supplier</DomainTerm>
                        </TableHead>
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
                      {buckets[i]!.map((row) => (
                        <TableRow key={row.contractId}>
                          <TableCell>{fmtDate(row.endDate)}</TableCell>
                          <TableCell>
                            <DaysLeftBadge days={daysUntil(row.endDate, windowStart)} />
                          </TableCell>
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
                          <TableCell className="max-w-56 truncate" title={oneLineAddress(row)}>
                            {oneLineAddress(row)}
                          </TableCell>
                          <TableCell>{fmtText(row.supplier)}</TableCell>
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
          ),
        )
      )}
      {nextCursor ? (
        <Button variant="outline" disabled={loading} onClick={loadMore}>
          {loading ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}
