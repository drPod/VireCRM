import { AlertTriangle, Check, CreditCard, Loader2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CREDIT_PACKS, formatPackPrice, packLabel } from "@/lib/credit-packs";
import type { AutoRechargeSettings } from "./credit-top-up.types";

interface EnableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingThreshold: number;
  setPendingThreshold: (n: number) => void;
  pendingPack: string;
  setPendingPack: (key: string) => void;
  hasPaymentMethod: boolean;
  savedCardLast4: string | null;
  savingAuto: boolean;
  onConfirm: () => Promise<void>;
}

export function EnableAutoRechargeDialog({
  open,
  onOpenChange,
  pendingThreshold,
  setPendingThreshold,
  pendingPack,
  setPendingPack,
  hasPaymentMethod,
  savedCardLast4,
  savingAuto,
  onConfirm,
}: EnableDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Enable auto-recharge?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                When your balance drops below{" "}
                <span className="font-semibold text-foreground">{pendingThreshold}%</span> of your
                monthly quota, we&apos;ll automatically charge your saved card for the{" "}
                <span className="font-semibold text-foreground">{packLabel(pendingPack)}</span>{" "}
                pack.
              </p>

              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Trigger threshold
                    </span>
                    <span className="text-xs font-semibold text-foreground tabular-nums">
                      {pendingThreshold}%
                    </span>
                  </div>
                  <Slider
                    value={[pendingThreshold]}
                    min={5}
                    max={50}
                    step={5}
                    onValueChange={(v) => setPendingThreshold(v[0])}
                  />
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Pack</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CREDIT_PACKS.map((pack) => {
                      const active = pendingPack === pack.key;
                      return (
                        <button
                          key={pack.key}
                          type="button"
                          onClick={() => setPendingPack(pack.key)}
                          className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition ${
                            active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:bg-accent"
                          }`}
                        >
                          {active && <Check className="h-3 w-3" />}
                          {pack.credits.toLocaleString()} · {formatPackPrice(pack.priceCents)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-md bg-background/60 px-2.5 py-2 text-xs">
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  {hasPaymentMethod ? (
                    <span className="text-muted-foreground">
                      Charges saved card{savedCardLast4 ? ` (•••• ${savedCardLast4})` : ""}
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3" />
                      No saved card yet — auto-recharge activates after your next manual purchase.
                    </span>
                  )}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                You can change the threshold, swap the pack, or disable this anytime.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={savingAuto}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={savingAuto}
            onClick={async (e) => {
              e.preventDefault();
              await onConfirm();
            }}
          >
            {savingAuto ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enable auto-recharge"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface DisableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  auto: AutoRechargeSettings;
  savingAuto: boolean;
  onConfirm: () => Promise<void>;
}

export function DisableAutoRechargeDialog({
  open,
  onOpenChange,
  auto,
  savingAuto,
  onConfirm,
}: DisableDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Turn off auto-recharge?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                Your saved card will no longer be charged automatically when your balance drops
                below{" "}
                <span className="font-semibold text-foreground">{auto.threshold_pct}%</span> of your
                monthly quota.
              </p>
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  If your balance runs out mid-campaign, outreach and AI actions may pause until you
                  manually buy more credits.
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                You can re-enable auto-recharge anytime — your threshold and pack preferences will
                be remembered.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={savingAuto}>Keep auto-recharge on</AlertDialogCancel>
          <AlertDialogAction
            disabled={savingAuto}
            onClick={async (e) => {
              e.preventDefault();
              await onConfirm();
            }}
          >
            {savingAuto ? <Loader2 className="h-4 w-4 animate-spin" /> : "Turn off"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
