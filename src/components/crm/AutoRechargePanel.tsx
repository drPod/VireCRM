import { useState } from "react";
import { Check, CreditCard, Loader2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CREDIT_PACKS, formatPackPrice, packLabel } from "@/lib/credit-packs";
import type { AutoRechargeSettings } from "./credit-top-up.types";
import {
  DisableAutoRechargeDialog,
  EnableAutoRechargeDialog,
} from "./AutoRechargeConfirmDialogs";

interface AutoRechargePanelProps {
  organizationId: string;
  auto: AutoRechargeSettings;
  setAuto: React.Dispatch<React.SetStateAction<AutoRechargeSettings>>;
  hasPaymentMethod: boolean;
  savedCardLast4: string | null;
}

export function AutoRechargePanel({
  organizationId,
  auto,
  setAuto,
  hasPaymentMethod,
  savedCardLast4,
}: AutoRechargePanelProps) {
  const [savingAuto, setSavingAuto] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDisableOpen, setConfirmDisableOpen] = useState(false);
  const [pendingThreshold, setPendingThreshold] = useState<number>(auto.threshold_pct);
  const [pendingPack, setPendingPack] = useState<string>(auto.pack_key);

  const persistAuto = async (next: AutoRechargeSettings) => {
    const prev = auto;
    const enabledChanged = prev.enabled !== next.enabled;
    const thresholdChanged = prev.threshold_pct !== next.threshold_pct;
    const packChanged = prev.pack_key !== next.pack_key;

    setSavingAuto(true);
    const { error } = await supabase.from("org_credit_settings").upsert(
      {
        organization_id: organizationId,
        auto_recharge_enabled: next.enabled,
        auto_recharge_pack_key: next.pack_key,
        auto_recharge_threshold_pct: next.threshold_pct,
      },
      { onConflict: "organization_id" },
    );
    setSavingAuto(false);
    if (error) {
      if (enabledChanged) {
        toast.error(
          next.enabled
            ? "Couldn't enable auto-recharge — please try again"
            : "Couldn't disable auto-recharge — please try again",
        );
      } else if (packChanged) {
        toast.error(`Couldn't switch auto-recharge pack to ${packLabel(next.pack_key)}`);
      } else if (thresholdChanged) {
        toast.error(`Couldn't update threshold to ${next.threshold_pct}%`);
      } else {
        toast.error("Could not save auto-recharge settings");
      }
    } else {
      setAuto(next);
      if (enabledChanged) {
        if (next.enabled) {
          toast.success("Auto-recharge enabled", {
            description: `We'll auto-buy the ${packLabel(next.pack_key)} pack when balance drops below ${next.threshold_pct}% of quota.`,
          });
        } else {
          toast.success("Auto-recharge disabled", {
            description: "Your saved card won't be charged automatically.",
          });
        }
      } else if (packChanged) {
        toast.success(`Auto-recharge pack set to ${packLabel(next.pack_key)}`, {
          description:
            "This pack will be charged the next time your balance falls below the threshold.",
        });
      } else if (thresholdChanged) {
        toast.success(`Threshold updated to ${next.threshold_pct}%`, {
          description: `Auto-recharge will trigger when balance drops below ${next.threshold_pct}% of monthly quota.`,
        });
      } else {
        toast.success("Auto-recharge settings saved");
      }
    }
  };

  return (
    <div className="mt-4 rounded-md border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground">Auto-recharge</p>
            {savingAuto && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            {auto.enabled && (
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                ON
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {auto.enabled ? (
              <>
                Auto-buys the {packLabel(auto.pack_key)} pack when balance drops below{" "}
                <span className="font-semibold text-foreground">{auto.threshold_pct}%</span> of
                monthly quota.
              </>
            ) : (
              <>
                Automatically buy a pack when your balance gets low — never run out mid-campaign.
              </>
            )}
          </p>
        </div>
        <Switch
          checked={auto.enabled}
          onCheckedChange={(checked) => {
            if (checked) {
              setPendingThreshold(auto.threshold_pct);
              setPendingPack(auto.pack_key);
              setConfirmOpen(true);
            } else {
              setConfirmDisableOpen(true);
            }
          }}
          disabled={savingAuto}
        />
      </div>

      {auto.enabled && (
        <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Trigger threshold</p>
              <span className="text-xs font-semibold text-foreground tabular-nums">
                {auto.threshold_pct}%
              </span>
            </div>
            <Slider
              value={[auto.threshold_pct]}
              min={5}
              max={50}
              step={5}
              disabled={savingAuto}
              onValueChange={(v) => setAuto((a) => ({ ...a, threshold_pct: v[0] }))}
              onValueCommit={(v) => persistAuto({ ...auto, threshold_pct: v[0] })}
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>5%</span>
              <span>50%</span>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Auto-buy pack</p>
            <div className="flex flex-wrap gap-1.5">
              {CREDIT_PACKS.map((pack) => {
                const active = auto.pack_key === pack.key;
                return (
                  <button
                    key={pack.key}
                    type="button"
                    disabled={savingAuto}
                    onClick={() => persistAuto({ ...auto, pack_key: pack.key })}
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
              <span className="text-amber-400">
                No saved card — first manual purchase will be used for future charges.
              </span>
            )}
          </div>
        </div>
      )}

      <EnableAutoRechargeDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        pendingThreshold={pendingThreshold}
        setPendingThreshold={setPendingThreshold}
        pendingPack={pendingPack}
        setPendingPack={setPendingPack}
        hasPaymentMethod={hasPaymentMethod}
        savedCardLast4={savedCardLast4}
        savingAuto={savingAuto}
        onConfirm={async () => {
          await persistAuto({
            enabled: true,
            pack_key: pendingPack,
            threshold_pct: pendingThreshold,
          });
          setConfirmOpen(false);
        }}
      />

      <DisableAutoRechargeDialog
        open={confirmDisableOpen}
        onOpenChange={setConfirmDisableOpen}
        auto={auto}
        savingAuto={savingAuto}
        onConfirm={async () => {
          await persistAuto({ ...auto, enabled: false });
          setConfirmDisableOpen(false);
        }}
      />
    </div>
  );
}
