import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
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
import { fmtText } from "~/lib/format";
import type { CustomerListItem, ListPage } from "~/lib/types";
import type { Route } from "./+types/customers";

export function meta() {
  return [{ title: "Customers · VireCRM" }];
}

function fetchPage(q: string, cursor?: string | null): Promise<ListPage<CustomerListItem>> {
  const qs = new URLSearchParams({ limit: "50" });
  if (q.trim()) qs.set("q", q.trim());
  if (cursor) qs.set("cursor", cursor);
  return apiFetch(`/api/customers?${qs}`);
}

export async function clientLoader() {
  return { page: await fetchPage("") };
}

export function HydrateFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function Customers({ loaderData }: Route.ComponentProps) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState(loaderData.page.items);
  const [nextCursor, setNextCursor] = useState(loaderData.page.nextCursor);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  // Debounced search; a new query replaces the list.
  useEffect(() => {
    const mySeq = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const page = await fetchPage(q);
        if (seq.current !== mySeq) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
      } catch (err) {
        if (seq.current !== mySeq) return;
        toast.error("Search failed", {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoading(true);
    try {
      const page = await fetchPage(q, nextCursor);
      setItems((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      toast.error("Couldn't load more customers", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground">
          All customers on file. Search by company name.
        </p>
      </div>
      <Input
        className="max-w-xs"
        placeholder="Search customers…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No customers found.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>External ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link to={`/customers/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell>{fmtText(c.primaryContactName)}</TableCell>
                  <TableCell>{fmtText(c.primaryEmail)}</TableCell>
                  <TableCell>{fmtText(c.primaryPhone)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {fmtText(c.externalCustomerId)}
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
