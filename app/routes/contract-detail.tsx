import { useState } from "react";
import { Link, isRouteErrorResponse, useNavigate, useRouteError } from "react-router";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { ApiError, apiFetch } from "~/lib/api";
import { getCustomer, getEsi } from "~/lib/entities";
import {
  fmtDate,
  fmtKwh,
  fmtMils,
  fmtMoney,
  fmtNumeric,
  fmtRate,
  fmtText,
  fmtTimestamp,
  oneLineAddress,
} from "~/lib/format";
import { DomainTerm } from "~/components/domain-term";
import { ContractFormDialog } from "~/components/contract-form-dialog";
import { Field, FieldList } from "~/components/field";
import type { ContractRow, ServiceAddressListItem } from "~/lib/types";
import type { Route } from "./+types/contract-detail";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `${data?.contract.supplier ?? "Contract"} · VireCRM` }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const contract = await apiFetch<ContractRow>(`/api/contracts/${params.id}`).catch((e) => {
    if (e instanceof ApiError && e.status === 404) {
      throw new Response("Not Found", { status: 404 });
    }
    throw e;
  });
  // ESI → address → customer chain for the header; each link may be absent.
  const esi = await getEsi(contract.esiId);
  const address = esi
    ? await apiFetch<ServiceAddressListItem>(
        `/api/service-addresses/${esi.serviceAddressId}`,
      ).catch(() => null)
    : null;
  const customer = address ? await getCustomer(address.customerId) : null;
  return { contract, esi, address, customer };
}

export function HydrateFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      {notFound ? "Contract not found." : "Something went wrong loading this contract."}
    </p>
  );
}

export default function ContractDetail({ loaderData }: Route.ComponentProps) {
  const { esi, address, customer } = loaderData;
  const navigate = useNavigate();
  const [contract, setContract] = useState(loaderData.contract);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    if (!window.confirm("Delete this contract? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/contracts/${contract.id}`, { method: "DELETE" });
      toast.success("Contract deleted");
      navigate("/contracts", { replace: true });
    } catch (err) {
      toast.error("Couldn't delete contract", {
        description: err instanceof Error ? err.message : String(err),
      });
      setDeleting(false);
    }
  }

  const yesNo = (b: boolean) => (b ? "Yes" : "No");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {contract.supplier || "(no supplier)"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {customer ? (
              <>
                <Link to={`/customers/${customer.id}`} className="hover:underline">
                  {customer.name}
                </Link>
                {address ? <> · {oneLineAddress(address)}</> : null}
              </>
            ) : (
              "Contract record"
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
          <CardTitle className="text-base">Meter & term</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldList>
            <Field label={<DomainTerm term="ESI ID" />}>
              <span className="font-mono text-xs">{esi ? esi.esiId : "—"}</span>
            </Field>
            <Field label={<DomainTerm term="Physical Meter Serial">Meter serial</DomainTerm>}>
              <span className="font-mono text-xs">{fmtText(esi?.physicalMeterSerial)}</span>
            </Field>
            <Field label={<DomainTerm term="REP">Supplier</DomainTerm>}>
              {fmtText(contract.supplier)}
            </Field>
            <Field label={<DomainTerm term="Non-HH">Supply type</DomainTerm>}>
              {fmtText(contract.supplyType)}
            </Field>
            <Field label="Start date">{fmtDate(contract.startDate)}</Field>
            <Field label="End date">{fmtDate(contract.endDate)}</Field>
            <Field label={<DomainTerm term="Acq/Ren">Sale type</DomainTerm>}>
              {fmtText(contract.saleType)}
            </Field>
            <Field label="Payment term">{fmtText(contract.paymentTerm)}</Field>
            <Field label={<DomainTerm term="Nomination" />}>
              {fmtText(contract.nomination)}
            </Field>
            <Field label="External sale ID">
              <span className="font-mono text-xs">{fmtText(contract.externalSaleId)}</span>
            </Field>
            <Field label="Currency">{contract.currency}</Field>
            <Field label="FX rate">{fmtNumeric(contract.fxRate)}</Field>
          </FieldList>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Rates, volume & value</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldList>
            <Field label="Cost per kWh">{fmtRate(contract.costPerKwh, contract.currency)}</Field>
            <Field label={<DomainTerm term="Mils">Agent mils</DomainTerm>}>
              {fmtMils(contract.agentMils)}
            </Field>
            <Field label="Annual usage">{fmtKwh(contract.annualUsageKwh)}</Field>
            <Field label={<DomainTerm term="Gross TCV" />}>
              {fmtMoney(contract.grossTcv, contract.currency)}
            </Field>
            <Field label={<DomainTerm term="Lost TCV" />}>
              {fmtMoney(contract.lostTcv, contract.currency)}
            </Field>
            <Field label={<DomainTerm term="Net TCV" />}>
              {fmtMoney(contract.netTcv, contract.currency)}
            </Field>
            <Field label={<DomainTerm term="TCV">Gross TCV (xlsx)</DomainTerm>}>
              {fmtMoney(contract.grossTcvXlsx, contract.currency)}
            </Field>
            <Field label={<DomainTerm term="TCV">Net TCV (xlsx)</DomainTerm>}>
              {fmtMoney(contract.netTcvXlsx, contract.currency)}
            </Field>
            <Field label={<DomainTerm term="AQ">AQ loss</DomainTerm>}>
              {fmtKwh(contract.aqLoss)}
            </Field>
            <Field label={<DomainTerm term="AQ">AQ gain</DomainTerm>}>
              {fmtKwh(contract.aqGain)}
            </Field>
            <Field label={<DomainTerm term="AQ">Net AQ</DomainTerm>}>
              {fmtKwh(contract.netAq)}
            </Field>
            <Field label={<DomainTerm term="AQ">AQ check</DomainTerm>}>
              {fmtNumeric(contract.aqCheck)}
            </Field>
          </FieldList>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lifecycle</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldList>
            <Field label={<DomainTerm term="Pipeline Stage">Pipeline status</DomainTerm>}>
              <Badge variant="outline">{contract.pipelineStatus}</Badge>
            </Field>
            <Field label={<DomainTerm term="Is Live" />}>
              {contract.isLive ? <Badge>Live</Badge> : "No"}
            </Field>
            <Field label="Completed post-live">{yesNo(contract.completedPostLive)}</Field>
            <Field label="Lost date">{fmtDate(contract.lostDate)}</Field>
            <Field label="Lost reason">{fmtText(contract.lostReason)}</Field>
            <Field label="Lost before start">{yesNo(contract.lostBeforeStart)}</Field>
            <Field label="Lost after live">{yesNo(contract.lostAfterLive)}</Field>
            <Field label="Lost partial">{yesNo(contract.lostPartial)}</Field>
            <Field label={<DomainTerm term="Drop">Drop date</DomainTerm>}>
              {fmtDate(contract.dropDate)}
            </Field>
            <Field label={<DomainTerm term="Drop">Drop reason</DomainTerm>}>
              {fmtText(contract.dropReason)}
            </Field>
          </FieldList>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resold & record</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldList>
            <Field label={<DomainTerm term="Resold Status">Resold status</DomainTerm>}>
              {fmtText(contract.resoldStatus)}
            </Field>
            <Field label="Is resold">{yesNo(contract.isResold)}</Field>
            <Field label="Resold from">
              {contract.resoldFromContractId ? (
                <Link
                  to={`/contracts/${contract.resoldFromContractId}`}
                  className="hover:underline"
                >
                  View original contract
                </Link>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Created">{fmtTimestamp(contract.createdAt)}</Field>
            <Field label="Updated">{fmtTimestamp(contract.updatedAt)}</Field>
          </FieldList>
        </CardContent>
      </Card>

      <ContractFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={contract}
        onSaved={setContract}
      />
    </div>
  );
}
