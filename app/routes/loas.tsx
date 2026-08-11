import { useState } from "react";
import { Link } from "react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { getCustomer, resolveCustomers } from "~/lib/entities";
import { fmtDate, fmtText } from "~/lib/format";
import { DomainTerm } from "~/components/domain-term";
import { LoaFormDialog } from "~/components/loa-form-dialog";
import type { CustomerListItem, ListPage, LoaListItem } from "~/lib/types";
import type { Route } from "./+types/loas";

export function meta() {
  return [{ title: "LOAs · VireCRM" }];
}

function fetchPage(cursor?: string | null): Promise<ListPage<LoaListItem>> {
  const qs = new URLSearchParams({ limit: "50" });
  if (cursor) qs.set("cursor", cursor);
  return apiFetch(`/api/loas?${qs}`);
}

export async function clientLoader() {
  const page = await fetchPage();
  const customers = await resolveCustomers(page.items.map((l) => l.customerId));
  return { page, customers };
}

export function HydrateFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function Loas({ loaderData }: Route.ComponentProps) {
  const [items, setItems] = useState(loaderData.page.items);
  const [nextCursor, setNextCursor] = useState(loaderData.page.nextCursor);
  const [customers, setCustomers] = useState<Map<string, CustomerListItem>>(
    () => new Map(loaderData.customers),
  );
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LoaListItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function mergeCustomers(rows: LoaListItem[]) {
    const more = await resolveCustomers(rows.map((l) => l.customerId));
    setCustomers((prev) => {
      const next = new Map(prev);
      for (const [id, c] of more) next.set(id, c);
      return next;
    });
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoading(true);
    try {
      const page = await fetchPage(nextCursor);
      await mergeCustomers(page.items);
      setItems((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      toast.error("Couldn't load more LOAs", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  async function onSaved(row: LoaListItem) {
    // Make sure the (possibly new) customer name is resolvable, then upsert.
    const c = await getCustomer(row.customerId);
    if (c) {
      setCustomers((prev) => new Map(prev).set(c.id, c));
    }
    setItems((prev) => {
      const i = prev.findIndex((l) => l.id === row.id);
      if (i === -1) return [row, ...prev];
      const next = [...prev];
      next[i] = row;
      return next;
    });
  }

  async function remove(loa: LoaListItem) {
    if (!window.confirm("Delete this LOA? This cannot be undone.")) return;
    setDeletingId(loa.id);
    try {
      await apiFetch(`/api/loas/${loa.id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((l) => l.id !== loa.id));
      toast.success("LOA deleted");
    } catch (err) {
      toast.error("Couldn't delete LOA", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            <DomainTerm term="LOA">LOAs</DomainTerm>
          </h1>
          <p className="text-sm text-muted-foreground">
            Letters of Authorization. One is required before a deal can enter pricing.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" /> New LOA
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No LOAs on file.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Signed</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>PDF</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((loa) => (
                <TableRow key={loa.id}>
                  <TableCell>
                    <Link
                      to={`/customers/${loa.customerId}`}
                      className="font-medium hover:underline"
                    >
                      {customers.get(loa.customerId)?.name ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell>{fmtDate(loa.signedDate)}</TableCell>
                  <TableCell>{fmtDate(loa.expirationDate)}</TableCell>
                  <TableCell className="max-w-64 truncate font-mono text-xs">
                    {fmtText(loa.pdfStoragePath)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit LOA"
                        onClick={() => {
                          setEditing(loa);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete LOA"
                        disabled={deletingId === loa.id}
                        onClick={() => remove(loa)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
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

      <LoaFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing ?? undefined}
        initialCustomer={editing ? (customers.get(editing.customerId) ?? null) : null}
        onSaved={onSaved}
      />
    </div>
  );
}
