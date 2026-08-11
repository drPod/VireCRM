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
import { agentsById, resolveCustomers } from "~/lib/entities";
import { fmtDate, fmtText } from "~/lib/format";
import { DomainTerm } from "~/components/domain-term";
import { DealFormDialog } from "~/components/deal-form-dialog";
import { SALE_STATUSES, STAGES, type DealListItem, type ListPage } from "~/lib/types";
import type { Route } from "./+types/deals";

export function meta() {
  return [{ title: "Deals · VireCRM" }];
}

const ALL = "__all__";

interface Filters {
  stage: string;
  saleStatus: string;
}

function fetchPage(filters: Filters, cursor?: string | null): Promise<ListPage<DealListItem>> {
  const qs = new URLSearchParams({ limit: "50" });
  if (filters.stage !== ALL) qs.set("stage", filters.stage);
  if (filters.saleStatus !== ALL) qs.set("saleStatus", filters.saleStatus);
  if (cursor) qs.set("cursor", cursor);
  return apiFetch(`/api/deals?${qs}`);
}

export async function clientLoader() {
  const page = await fetchPage({ stage: ALL, saleStatus: ALL });
  const [customers, agents] = await Promise.all([
    resolveCustomers(page.items.map((d) => d.customerId)),
    agentsById(),
  ]);
  return { page, customers, agents };
}

export function HydrateFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function Deals({ loaderData }: Route.ComponentProps) {
  const { agents } = loaderData;
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>({ stage: ALL, saleStatus: ALL });
  const [items, setItems] = useState(loaderData.page.items);
  const [nextCursor, setNextCursor] = useState(loaderData.page.nextCursor);
  const [customerNames, setCustomerNames] = useState<Map<string, string>>(
    () => new Map([...loaderData.customers].map(([id, c]) => [id, c.name])),
  );
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  async function mergeCustomerNames(deals: DealListItem[]) {
    const more = await resolveCustomers(deals.map((d) => d.customerId));
    setCustomerNames((prev) => {
      const next = new Map(prev);
      for (const [id, c] of more) next.set(id, c.name);
      return next;
    });
  }

  async function applyFilters(next: Filters) {
    setFilters(next);
    setLoading(true);
    try {
      const page = await fetchPage(next);
      await mergeCustomerNames(page.items);
      setItems(page.items);
      setNextCursor(page.nextCursor);
    } catch (err) {
      toast.error("Couldn't load deals", {
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
      await mergeCustomerNames(page.items);
      setItems((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      toast.error("Couldn't load more deals", {
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
          <h1 className="text-2xl font-semibold tracking-tight">Deals</h1>
          <p className="text-sm text-muted-foreground">All deals across all stages.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> New deal
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={filters.stage} onValueChange={(v) => applyFilters({ ...filters, stage: v })}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All stages</SelectItem>
            {STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.saleStatus}
          onValueChange={(v) => applyFilters({ ...filters, saleStatus: v })}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All sale statuses</SelectItem>
            {SALE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No deals match these filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deal</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>
                  <DomainTerm term="Pipeline Stage">Stage</DomainTerm>
                </TableHead>
                <TableHead>
                  <DomainTerm term="Sale Status" />
                </TableHead>
                <TableHead>
                  <DomainTerm term="Pri/Sec Agent">Agents</DomainTerm>
                </TableHead>
                <TableHead>Sale date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((deal) => {
                const customerName = customerNames.get(deal.customerId);
                const agentNames = [deal.primaryAgentId, deal.secondaryAgentId]
                  .map((id) => (id ? agents.get(id)?.name : null))
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <TableRow key={deal.id}>
                    <TableCell>
                      <Link to={`/deals/${deal.id}`} className="font-medium hover:underline">
                        {deal.name || customerName || "Untitled deal"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link to={`/customers/${deal.customerId}`} className="hover:underline">
                        {customerName ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{deal.stage}</Badge>
                    </TableCell>
                    <TableCell>{fmtText(deal.saleStatus)}</TableCell>
                    <TableCell>{agentNames || "—"}</TableCell>
                    <TableCell>{fmtDate(deal.saleDate)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {nextCursor ? (
        <Button variant="outline" disabled={loading} onClick={loadMore}>
          {loading ? "Loading…" : "Load more"}
        </Button>
      ) : null}

      <DealFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(row) => navigate(`/deals/${row.id}`)}
      />
    </div>
  );
}
