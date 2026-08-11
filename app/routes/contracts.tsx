import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { apiFetch } from "~/lib/api";
import { resolveEsis } from "~/lib/entities";
import { fmtDate, fmtMoney } from "~/lib/format";
import { DomainTerm } from "~/components/domain-term";
import { ContractFormDialog } from "~/components/contract-form-dialog";
import { PIPELINE_STATUSES, type ContractRow, type ListPage } from "~/lib/types";
import type { Route } from "./+types/contracts";

export function meta() {
  return [{ title: "Contracts · VireCRM" }];
}

const ALL = "__all__";

interface Filters {
  pipelineStatus: string;
  isLive: string; // ALL | "true" | "false"
}

function fetchPage(filters: Filters, cursor?: string | null): Promise<ListPage<ContractRow>> {
  const qs = new URLSearchParams({ limit: "50" });
  if (filters.pipelineStatus !== ALL) qs.set("pipelineStatus", filters.pipelineStatus);
  if (filters.isLive !== ALL) qs.set("isLive", filters.isLive);
  if (cursor) qs.set("cursor", cursor);
  return apiFetch(`/api/contracts?${qs}`);
}

export async function clientLoader() {
  const page = await fetchPage({ pipelineStatus: ALL, isLive: ALL });
  const esis = await resolveEsis(page.items.map((c) => c.esiId));
  return { page, esis };
}

export function HydrateFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function Contracts({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>({ pipelineStatus: ALL, isLive: ALL });
  const [items, setItems] = useState(loaderData.page.items);
  const [nextCursor, setNextCursor] = useState(loaderData.page.nextCursor);
  const [esiText, setEsiText] = useState<Map<string, string>>(
    () => new Map([...loaderData.esis].map(([id, e]) => [id, e.esiId])),
  );
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  async function mergeEsiText(rows: ContractRow[]) {
    const more = await resolveEsis(rows.map((c) => c.esiId));
    setEsiText((prev) => {
      const next = new Map(prev);
      for (const [id, e] of more) next.set(id, e.esiId);
      return next;
    });
  }

  async function applyFilters(next: Filters) {
    setFilters(next);
    setLoading(true);
    try {
      const page = await fetchPage(next);
      await mergeEsiText(page.items);
      setItems(page.items);
      setNextCursor(page.nextCursor);
    } catch (err) {
      toast.error("Couldn't load contracts", {
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
      const page = await fetchPage(filters, nextCursor);
      await mergeEsiText(page.items);
      setItems((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      toast.error("Couldn't load more contracts", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contracts</h1>
          <p className="text-sm text-muted-foreground">
            All supply contracts, one per <DomainTerm term="ESI ID">ESI</DomainTerm>.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> New contract
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select
          value={filters.pipelineStatus}
          onValueChange={(v) => applyFilters({ ...filters, pipelineStatus: v })}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {PIPELINE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.isLive}
          onValueChange={(v) => applyFilters({ ...filters, isLive: v })}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Live and not live</SelectItem>
            <SelectItem value="true">Live only</SelectItem>
            <SelectItem value="false">Not live</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No contracts match these filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <DomainTerm term="REP">Supplier</DomainTerm>
                </TableHead>
                <TableHead>
                  <DomainTerm term="ESI ID" />
                </TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <DomainTerm term="Is Live">Live</DomainTerm>
                </TableHead>
                <TableHead>
                  <DomainTerm term="Net TCV" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link to={`/contracts/${c.id}`} className="font-medium hover:underline">
                      {c.supplier || "(no supplier)"}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {esiText.get(c.esiId) ?? "—"}
                  </TableCell>
                  <TableCell>{fmtDate(c.startDate)}</TableCell>
                  <TableCell>{fmtDate(c.endDate)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{c.pipelineStatus}</Badge>
                  </TableCell>
                  <TableCell>{c.isLive ? <Badge>Live</Badge> : "—"}</TableCell>
                  <TableCell>{fmtMoney(c.netTcv, c.currency)}</TableCell>
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

      <ContractFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(row) => navigate(`/contracts/${row.id}`)}
      />
    </div>
  );
}
