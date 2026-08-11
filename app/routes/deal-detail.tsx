import { useState } from "react";
import { Link, isRouteErrorResponse, useNavigate, useRouteError } from "react-router";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { ApiError, apiFetch } from "~/lib/api";
import { agentsById, getCustomer } from "~/lib/entities";
import { fmtDate, fmtText, fmtTimestamp } from "~/lib/format";
import { DomainTerm } from "~/components/domain-term";
import { DealFormDialog } from "~/components/deal-form-dialog";
import { Field, FieldList } from "~/components/field";
import type { DealListItem } from "~/lib/types";
import type { Route } from "./+types/deal-detail";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `${data?.deal.name ?? "Deal"} · VireCRM` }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const deal = await apiFetch<DealListItem>(`/api/deals/${params.id}`).catch((e) => {
    if (e instanceof ApiError && e.status === 404) {
      throw new Response("Not Found", { status: 404 });
    }
    throw e;
  });
  const [customer, agents] = await Promise.all([getCustomer(deal.customerId), agentsById()]);
  return { deal, customer, agents };
}

export function HydrateFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      {notFound ? "Deal not found." : "Something went wrong loading this deal."}
    </p>
  );
}

export default function DealDetail({ loaderData }: Route.ComponentProps) {
  const { customer, agents } = loaderData;
  const navigate = useNavigate();
  const [deal, setDeal] = useState(loaderData.deal);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const agentName = (id: string | null) => (id ? (agents.get(id)?.name ?? id) : null);

  async function remove() {
    if (!window.confirm("Delete this deal? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/deals/${deal.id}`, { method: "DELETE" });
      toast.success("Deal deleted");
      navigate("/deals", { replace: true });
    } catch (err) {
      toast.error("Couldn't delete deal", {
        description: err instanceof Error ? err.message : String(err),
      });
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {deal.name || customer?.name || "Untitled deal"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {customer ? (
              <Link to={`/customers/${customer.id}`} className="hover:underline">
                {customer.name}
              </Link>
            ) : (
              "Deal record"
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" /> Edit
          </Button>
          <Button variant="destructive" disabled={deleting} onClick={remove}>
            <Trash2 className="size-4" /> {deleting ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Deal</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldList>
            <Field label={<DomainTerm term="Pipeline Stage">Stage</DomainTerm>}>
              <Badge variant="secondary">{deal.stage}</Badge>
            </Field>
            <Field label={<DomainTerm term="Sale Status" />}>{fmtText(deal.saleStatus)}</Field>
            <Field label="Sale date">{fmtDate(deal.saleDate)}</Field>
            <Field label={<DomainTerm term="Pri/Sec Agent">Primary agent</DomainTerm>}>
              {fmtText(agentName(deal.primaryAgentId))}
            </Field>
            <Field label={<DomainTerm term="Pri/Sec Agent">Secondary agent</DomainTerm>}>
              {fmtText(agentName(deal.secondaryAgentId))}
            </Field>
            <Field label="Source of lead">{fmtText(deal.sourceOfLead)}</Field>
            <Field label="Objection status">{fmtText(deal.objectionStatus)}</Field>
            <Field label="Objection type">{fmtText(deal.objectionType)}</Field>
            <Field label="External sale ID">
              <span className="font-mono text-xs">{fmtText(deal.externalSaleId)}</span>
            </Field>
            <Field label="Contract">
              {deal.contractId ? (
                <Link to={`/contracts/${deal.contractId}`} className="hover:underline">
                  View contract
                </Link>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Created">{fmtTimestamp(deal.createdAt)}</Field>
          </FieldList>
        </CardContent>
      </Card>

      <DealFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={deal}
        initialCustomer={customer}
        onSaved={setDeal}
      />
    </div>
  );
}
