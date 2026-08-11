import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CustomerPicker } from "~/components/customer-picker";
import { DomainTerm } from "~/components/domain-term";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { ApiError, apiFetch } from "~/lib/api";
import {
  PIPELINE_STATUSES,
  type ContractRow,
  type CustomerListItem,
  type EsiListItem,
  type ListPage,
} from "~/lib/types";

interface Form {
  supplier: string;
  supplyType: string;
  startDate: string;
  endDate: string;
  costPerKwh: string;
  agentMils: string;
  annualUsageKwh: string;
  currency: string;
  pipelineStatus: string;
  isLive: boolean;
  saleType: string;
  paymentTerm: string;
  nomination: string;
  externalSaleId: string;
  lostDate: string;
  lostReason: string;
  dropDate: string;
  dropReason: string;
}

function toForm(row?: ContractRow): Form {
  return {
    supplier: row?.supplier ?? "",
    supplyType: row?.supplyType ?? "",
    startDate: row?.startDate ?? "",
    endDate: row?.endDate ?? "",
    costPerKwh: row?.costPerKwh ?? "",
    agentMils: row?.agentMils ?? "",
    annualUsageKwh: row?.annualUsageKwh ?? "",
    currency: row?.currency ?? "USD",
    pipelineStatus: row?.pipelineStatus ?? "pending",
    isLive: row?.isLive ?? false,
    saleType: row?.saleType ?? "",
    paymentTerm: row?.paymentTerm ?? "",
    nomination: row?.nomination ?? "",
    externalSaleId: row?.externalSaleId ?? "",
    lostDate: row?.lostDate ?? "",
    lostReason: row?.lostReason ?? "",
    dropDate: row?.dropDate ?? "",
    dropReason: row?.dropReason ?? "",
  };
}

export function ContractFormDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ContractRow;
  onSaved: (row: ContractRow) => void;
}) {
  const [customer, setCustomer] = useState<CustomerListItem | null>(null);
  const [esis, setEsis] = useState<EsiListItem[]>([]);
  const [esiRowId, setEsiRowId] = useState("");
  const [form, setForm] = useState<Form>(() => toForm(initial));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(toForm(initial));
    setCustomer(null);
    setEsis([]);
    setEsiRowId("");
    setFieldErrors({});
  }, [open, initial]);

  // Creating: ESI options load once a customer is picked.
  useEffect(() => {
    if (!customer) {
      setEsis([]);
      setEsiRowId("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const qs = new URLSearchParams({ customerId: customer.id, limit: "100" });
        const page: ListPage<EsiListItem> = await apiFetch(`/api/esis?${qs}`);
        if (!cancelled) setEsis(page.items);
      } catch {
        if (!cancelled) toast.error("Couldn't load ESIs for that customer");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customer]);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const orNull = (s: string) => (s.trim() === "" ? null : s.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!initial && !esiRowId) {
      setFieldErrors({ esiId: ["pick a customer, then an ESI"] });
      return;
    }
    setBusy(true);
    setFieldErrors({});
    const body: Record<string, unknown> = {
      supplier: orNull(form.supplier),
      supplyType: orNull(form.supplyType),
      startDate: orNull(form.startDate),
      endDate: orNull(form.endDate),
      costPerKwh: orNull(form.costPerKwh),
      agentMils: orNull(form.agentMils),
      annualUsageKwh: orNull(form.annualUsageKwh),
      currency: form.currency.trim().toUpperCase() || "USD",
      pipelineStatus: form.pipelineStatus,
      isLive: form.isLive,
      saleType: orNull(form.saleType),
      paymentTerm: orNull(form.paymentTerm),
      nomination: orNull(form.nomination),
      externalSaleId: orNull(form.externalSaleId),
      lostDate: orNull(form.lostDate),
      lostReason: orNull(form.lostReason),
      dropDate: orNull(form.dropDate),
      dropReason: orNull(form.dropReason),
    };
    // esiId = ESI row UUID; immutable after create in this UI.
    if (!initial) body.esiId = esiRowId;
    try {
      const row = initial
        ? await apiFetch<ContractRow>(`/api/contracts/${initial.id}`, {
            method: "PATCH",
            body,
          })
        : await apiFetch<ContractRow>("/api/contracts", { method: "POST", body });
      onOpenChange(false);
      onSaved(row);
      toast.success(initial ? "Contract updated" : "Contract created");
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setFieldErrors(err.fieldErrors);
        toast.error("Check the highlighted fields");
      } else {
        toast.error("Couldn't save contract", {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    } finally {
      setBusy(false);
    }
  }

  const err = (key: string) =>
    fieldErrors[key]?.length ? (
      <p className="text-xs text-destructive">{fieldErrors[key]!.join("; ")}</p>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit contract" : "New contract"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          {!initial ? (
            <>
              <div className="grid gap-2">
                <Label>Customer *</Label>
                <CustomerPicker value={customer} onChange={setCustomer} />
              </div>
              <div className="grid gap-2">
                <Label>
                  <DomainTerm term="ESI ID">ESI</DomainTerm> *
                </Label>
                <Select
                  value={esiRowId || undefined}
                  onValueChange={setEsiRowId}
                  disabled={!customer}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={customer ? "Pick an ESI" : "Pick a customer first"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {esis.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.esiId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {customer && esis.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No ESIs on file for this customer.
                  </p>
                ) : null}
                {err("esiId")}
              </div>
            </>
          ) : null}

          <p className="text-sm font-medium text-muted-foreground">Supplier & term</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="c-supplier">
                <DomainTerm term="REP">Supplier</DomainTerm>
              </Label>
              <Input
                id="c-supplier"
                value={form.supplier}
                onChange={(e) => set("supplier", e.target.value)}
              />
              {err("supplier")}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-supply-type">Supply type</Label>
              <Input
                id="c-supply-type"
                value={form.supplyType}
                onChange={(e) => set("supplyType", e.target.value)}
              />
              {err("supplyType")}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-start">Start date</Label>
              <Input
                id="c-start"
                type="date"
                value={form.startDate}
                onChange={(e) => set("startDate", e.target.value)}
              />
              {err("startDate")}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-end">End date</Label>
              <Input
                id="c-end"
                type="date"
                value={form.endDate}
                onChange={(e) => set("endDate", e.target.value)}
              />
              {err("endDate")}
            </div>
          </div>

          <p className="text-sm font-medium text-muted-foreground">Rates & volume</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="c-rate">Cost per kWh</Label>
              <Input
                id="c-rate"
                inputMode="decimal"
                placeholder="0.0567"
                value={form.costPerKwh}
                onChange={(e) => set("costPerKwh", e.target.value)}
              />
              {err("costPerKwh")}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-mils">
                <DomainTerm term="Mils">Agent mils</DomainTerm>
              </Label>
              <Input
                id="c-mils"
                inputMode="decimal"
                placeholder="5"
                value={form.agentMils}
                onChange={(e) => set("agentMils", e.target.value)}
              />
              {err("agentMils")}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-usage">Annual usage (kWh)</Label>
              <Input
                id="c-usage"
                inputMode="numeric"
                value={form.annualUsageKwh}
                onChange={(e) => set("annualUsageKwh", e.target.value)}
              />
              {err("annualUsageKwh")}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-currency">Currency</Label>
              <Input
                id="c-currency"
                maxLength={3}
                value={form.currency}
                onChange={(e) => set("currency", e.target.value)}
              />
              {err("currency")}
            </div>
          </div>

          <p className="text-sm font-medium text-muted-foreground">Status</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>
                <DomainTerm term="Pipeline Stage">Pipeline status</DomainTerm>
              </Label>
              <Select
                value={form.pipelineStatus}
                onValueChange={(v) => set("pipelineStatus", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-is-live">
                <DomainTerm term="Is Live" />
              </Label>
              <label className="flex h-9 items-center gap-2 text-sm">
                <input
                  id="c-is-live"
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={form.isLive}
                  onChange={(e) => set("isLive", e.target.checked)}
                />
                Billing has started
              </label>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-sale-type">
                <DomainTerm term="Acq/Ren">Sale type</DomainTerm>
              </Label>
              <Input
                id="c-sale-type"
                value={form.saleType}
                onChange={(e) => set("saleType", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-payment-term">Payment term</Label>
              <Input
                id="c-payment-term"
                value={form.paymentTerm}
                onChange={(e) => set("paymentTerm", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-nomination">
                <DomainTerm term="Nomination" />
              </Label>
              <Input
                id="c-nomination"
                value={form.nomination}
                onChange={(e) => set("nomination", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-external-id">External sale ID</Label>
              <Input
                id="c-external-id"
                value={form.externalSaleId}
                onChange={(e) => set("externalSaleId", e.target.value)}
              />
              {err("externalSaleId")}
            </div>
          </div>

          {initial ? (
            <>
              <p className="text-sm font-medium text-muted-foreground">
                Lost / <DomainTerm term="Drop" />
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="c-lost-date">Lost date</Label>
                  <Input
                    id="c-lost-date"
                    type="date"
                    value={form.lostDate}
                    onChange={(e) => set("lostDate", e.target.value)}
                  />
                  {err("lostDate")}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="c-lost-reason">Lost reason</Label>
                  <Input
                    id="c-lost-reason"
                    value={form.lostReason}
                    onChange={(e) => set("lostReason", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="c-drop-date">Drop date</Label>
                  <Input
                    id="c-drop-date"
                    type="date"
                    value={form.dropDate}
                    onChange={(e) => set("dropDate", e.target.value)}
                  />
                  {err("dropDate")}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="c-drop-reason">Drop reason</Label>
                  <Input
                    id="c-drop-reason"
                    value={form.dropReason}
                    onChange={(e) => set("dropReason", e.target.value)}
                  />
                </div>
              </div>
            </>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : initial ? "Save changes" : "Create contract"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
