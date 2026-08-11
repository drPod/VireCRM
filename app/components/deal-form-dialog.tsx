import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CustomerPicker } from "~/components/customer-picker";
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
import { allAgents } from "~/lib/entities";
import {
  SALE_STATUSES,
  STAGES,
  type AgentListItem,
  type CustomerListItem,
  type DealListItem,
} from "~/lib/types";

const NONE = "__none__";

interface Form {
  name: string;
  externalSaleId: string;
  saleDate: string;
  stage: string;
  saleStatus: string;
  objectionStatus: string;
  objectionType: string;
  sourceOfLead: string;
  primaryAgentId: string;
  secondaryAgentId: string;
}

function toForm(deal?: DealListItem): Form {
  return {
    name: deal?.name ?? "",
    externalSaleId: deal?.externalSaleId ?? "",
    saleDate: deal?.saleDate ?? "",
    stage: deal?.stage ?? "Lead",
    saleStatus: deal?.saleStatus ?? NONE,
    objectionStatus: deal?.objectionStatus ?? "",
    objectionType: deal?.objectionType ?? "",
    sourceOfLead: deal?.sourceOfLead ?? "",
    primaryAgentId: deal?.primaryAgentId ?? "",
    secondaryAgentId: deal?.secondaryAgentId ?? NONE,
  };
}

export function DealFormDialog({
  open,
  onOpenChange,
  initial,
  initialCustomer,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: DealListItem;
  initialCustomer?: CustomerListItem | null;
  onSaved: (row: DealListItem) => void;
}) {
  const [customer, setCustomer] = useState<CustomerListItem | null>(initialCustomer ?? null);
  const [form, setForm] = useState<Form>(() => toForm(initial));
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(toForm(initial));
    setCustomer(initialCustomer ?? null);
    setFieldErrors({});
    allAgents().then(setAgents, () => toast.error("Couldn't load agents"));
  }, [open, initial, initialCustomer]);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const orNull = (s: string) => (s.trim() === "" ? null : s.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) {
      setFieldErrors({ customerId: ["pick a customer"] });
      return;
    }
    if (!form.primaryAgentId) {
      setFieldErrors({ primaryAgentId: ["pick a primary agent"] });
      return;
    }
    setBusy(true);
    setFieldErrors({});
    const body = {
      customerId: customer.id,
      primaryAgentId: form.primaryAgentId,
      secondaryAgentId: form.secondaryAgentId === NONE ? null : form.secondaryAgentId,
      name: orNull(form.name),
      externalSaleId: orNull(form.externalSaleId),
      saleDate: orNull(form.saleDate),
      stage: form.stage,
      saleStatus: form.saleStatus === NONE ? null : form.saleStatus,
      objectionStatus: orNull(form.objectionStatus),
      objectionType: orNull(form.objectionType),
      sourceOfLead: orNull(form.sourceOfLead),
    };
    try {
      const row = initial
        ? await apiFetch<DealListItem>(`/api/deals/${initial.id}`, {
            method: "PATCH",
            body,
          })
        : await apiFetch<DealListItem>("/api/deals", { method: "POST", body });
      onOpenChange(false);
      onSaved(row);
      toast.success(initial ? "Deal updated" : "Deal created");
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setFieldErrors(err.fieldErrors);
        toast.error("Check the highlighted fields");
      } else if (err instanceof ApiError && err.status === 409) {
        setFieldErrors({ externalSaleId: ["already exists for this tenant"] });
        toast.error("Duplicate external sale ID");
      } else {
        toast.error("Couldn't save deal", {
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit deal" : "New deal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Customer *</Label>
            <CustomerPicker value={customer} onChange={setCustomer} />
            {err("customerId")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Primary agent *</Label>
              <Select
                value={form.primaryAgentId || undefined}
                onValueChange={(v) => set("primaryAgentId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {err("primaryAgentId")}
            </div>
            <div className="grid gap-2">
              <Label>Secondary agent</Label>
              <Select
                value={form.secondaryAgentId}
                onValueChange={(v) => set("secondaryAgentId", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="deal-name">Deal name</Label>
            <Input
              id="deal-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
            {err("name")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Stage</Label>
              <Select value={form.stage} onValueChange={(v) => set("stage", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Sale status</Label>
              <Select value={form.saleStatus} onValueChange={(v) => set("saleStatus", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {SALE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="deal-sale-date">Sale date</Label>
              <Input
                id="deal-sale-date"
                type="date"
                value={form.saleDate}
                onChange={(e) => set("saleDate", e.target.value)}
              />
              {err("saleDate")}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deal-external-id">External sale ID</Label>
              <Input
                id="deal-external-id"
                value={form.externalSaleId}
                onChange={(e) => set("externalSaleId", e.target.value)}
              />
              {err("externalSaleId")}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="deal-source">Source of lead</Label>
              <Input
                id="deal-source"
                value={form.sourceOfLead}
                onChange={(e) => set("sourceOfLead", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deal-objection-type">Objection type</Label>
              <Input
                id="deal-objection-type"
                value={form.objectionType}
                onChange={(e) => set("objectionType", e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="deal-objection-status">Objection status</Label>
            <Input
              id="deal-objection-status"
              value={form.objectionStatus}
              onChange={(e) => set("objectionStatus", e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : initial ? "Save changes" : "Create deal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
