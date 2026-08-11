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
import { ApiError, apiFetch } from "~/lib/api";
import type { CustomerListItem, LoaListItem } from "~/lib/types";

export function LoaFormDialog({
  open,
  onOpenChange,
  initial,
  initialCustomer,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: LoaListItem;
  initialCustomer?: CustomerListItem | null;
  onSaved: (row: LoaListItem) => void;
}) {
  const [customer, setCustomer] = useState<CustomerListItem | null>(initialCustomer ?? null);
  const [pdfStoragePath, setPdfStoragePath] = useState("");
  const [signedDate, setSignedDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCustomer(initialCustomer ?? null);
    setPdfStoragePath(initial?.pdfStoragePath ?? "");
    setSignedDate(initial?.signedDate ?? "");
    setExpirationDate(initial?.expirationDate ?? "");
    setFieldErrors({});
  }, [open, initial, initialCustomer]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) {
      setFieldErrors({ customerId: ["pick a customer"] });
      return;
    }
    setBusy(true);
    setFieldErrors({});
    // Empty form fields → null (the API rejects empty-string dates).
    const body = {
      customerId: customer.id,
      pdfStoragePath: pdfStoragePath.trim() === "" ? null : pdfStoragePath.trim(),
      signedDate: signedDate === "" ? null : signedDate,
      expirationDate: expirationDate === "" ? null : expirationDate,
    };
    try {
      const row = initial
        ? await apiFetch<LoaListItem>(`/api/loas/${initial.id}`, { method: "PATCH", body })
        : await apiFetch<LoaListItem>("/api/loas", { method: "POST", body });
      onOpenChange(false);
      onSaved(row);
      toast.success(initial ? "LOA updated" : "LOA created");
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setFieldErrors(err.fieldErrors);
        toast.error("Check the highlighted fields");
      } else {
        toast.error("Couldn't save LOA", {
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit LOA" : "New LOA"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Customer *</Label>
            <CustomerPicker value={customer} onChange={setCustomer} />
            {err("customerId")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="loa-signed">Signed date</Label>
              <Input
                id="loa-signed"
                type="date"
                value={signedDate}
                onChange={(e) => setSignedDate(e.target.value)}
              />
              {err("signedDate")}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="loa-expires">Expiration date</Label>
              <Input
                id="loa-expires"
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
              />
              {err("expirationDate")}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="loa-pdf">PDF storage path</Label>
            <Input
              id="loa-pdf"
              value={pdfStoragePath}
              onChange={(e) => setPdfStoragePath(e.target.value)}
              placeholder="loas/customer/file.pdf"
            />
            {err("pdfStoragePath")}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : initial ? "Save changes" : "Create LOA"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
