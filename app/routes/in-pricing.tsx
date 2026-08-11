import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
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
import { agentsById, resolveCustomers } from "~/lib/entities";
import { fmtDate, fmtText } from "~/lib/format";
import { DomainTerm } from "~/components/domain-term";
import type { DealListItem, ListPage } from "~/lib/types";
import type { Route } from "./+types/in-pricing";

export function meta() {
  return [{ title: "In Pricing · VireCRM" }];
}

function fetchPage(cursor?: string | null): Promise<ListPage<DealListItem>> {
  const qs = new URLSearchParams({ stage: "In Pricing", limit: "100" });
  if (cursor) qs.set("cursor", cursor);
  return apiFetch(`/api/deals?${qs}`);
}

export async function clientLoader() {
  const page = await fetchPage();
  const [customers, agents] = await Promise.all([
    resolveCustomers(page.items.map((d) => d.customerId)),
    agentsById(),
  ]);
  return { page, customers, agents };
}

export function HydrateFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function InPricing({ loaderData }: Route.ComponentProps) {
  const { agents } = loaderData;
  const [items, setItems] = useState(loaderData.page.items);
  const [nextCursor, setNextCursor] = useState(loaderData.page.nextCursor);
  const [customerNames, setCustomerNames] = useState<Map<string, string>>(
    () => new Map([...loaderData.customers].map(([id, c]) => [id, c.name])),
  );
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (!nextCursor) return;
    setLoading(true);
    try {
      const page = await fetchPage(nextCursor);
      const more = await resolveCustomers(page.items.map((d) => d.customerId));
      setCustomerNames((prev) => {
        const next = new Map(prev);
        for (const [id, c] of more) next.set(id, c.name);
        return next;
      });
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          <DomainTerm term="In Pricing" />
        </h1>
        <p className="text-sm text-muted-foreground">
          Deals currently being quoted across suppliers.
        </p>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No deals are in pricing right now.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deal</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>
                  <DomainTerm term="Pri/Sec Agent">Agents</DomainTerm>
                </TableHead>
                <TableHead>
                  <DomainTerm term="Sale Status" />
                </TableHead>
                <TableHead>Sale date</TableHead>
                <TableHead>Source of lead</TableHead>
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
                    <TableCell>{agentNames || "—"}</TableCell>
                    <TableCell>
                      {deal.saleStatus ? (
                        <Badge variant="outline">{deal.saleStatus}</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{fmtDate(deal.saleDate)}</TableCell>
                    <TableCell>{fmtText(deal.sourceOfLead)}</TableCell>
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
    </div>
  );
}
