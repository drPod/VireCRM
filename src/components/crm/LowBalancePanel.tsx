import { useState } from "react";
import { Bell, BellOff, Loader2, Send } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { LowBalanceSettings, PackBalance } from "./credit-top-up.types";

interface LowBalancePanelProps {
  organizationId: string;
  lowBalance: LowBalanceSettings;
  setLowBalance: React.Dispatch<React.SetStateAction<LowBalanceSettings>>;
  balance: PackBalance | null;
}

interface NotifyResult {
  success: boolean;
  notified?: boolean;
  reason?: string;
  queued?: number;
}

/**
 * Calls the low-balance notify endpoint with the current Supabase session.
 * Exported so the container can re-use it for the auto-evaluate effect.
 */
export async function callLowBalanceNotifyEndpoint(
  organizationId: string,
  force = false,
): Promise<NotifyResult | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  try {
    const res = await fetch(`/api/notify-low-balance${force ? "?force=1" : ""}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ organizationId }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function LowBalancePanel({
  organizationId,
  lowBalance,
  setLowBalance,
  balance,
}: LowBalancePanelProps) {
  const [savingLow, setSavingLow] = useState(false);
  const [testingLow, setTestingLow] = useState(false);
  const [thresholdInput, setThresholdInput] = useState<string>(String(lowBalance.threshold));

  const persistLow = async (next: LowBalanceSettings) => {
    setSavingLow(true);
    const { error } = await supabase.from("org_credit_settings").upsert(
      {
        organization_id: organizationId,
        low_balance_notify_enabled: next.enabled,
        low_balance_threshold: next.threshold,
      },
      { onConflict: "organization_id" },
    );
    setSavingLow(false);
    if (error) {
      toast.error("Could not save low-balance alert settings");
    } else {
      setLowBalance(next);
      setThresholdInput(String(next.threshold));
      toast.success(next.enabled ? "Low-balance alerts updated" : "Low-balance alerts disabled");
    }
  };

  const sendTestLow = async () => {
    setTestingLow(true);
    const result = await callLowBalanceNotifyEndpoint(organizationId);
    setTestingLow(false);
    if (!result) {
      toast.error("Could not run low-balance check");
      return;
    }
    if (result.notified) {
      toast.success(`Alert email queued to ${result.queued ?? 1} owner(s)`);
    } else if (result.reason === "above_threshold") {
      toast.info("Balance is above threshold — no alert needed");
    } else if (result.reason === "cooldown") {
      toast.info("An alert was already sent in the last 24h — skipped");
    } else if (result.reason === "disabled") {
      toast.info("Low-balance alerts are turned off");
    } else {
      toast.info("No alert sent");
    }
  };

  return (
    <div className="mt-3 rounded-md border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground">Low-balance email alert</p>
            {savingLow && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            {lowBalance.enabled ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                <Bell className="h-2.5 w-2.5" /> ON
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                <BellOff className="h-2.5 w-2.5" /> OFF
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {lowBalance.enabled ? (
              <>
                Emails every owner when pack balance drops below{" "}
                <span className="font-semibold text-foreground">
                  {lowBalance.threshold.toLocaleString()}
                </span>{" "}
                credits. Re-sends at most once every 24h.
              </>
            ) : (
              <>Get notified by email before you run out of credits.</>
            )}
          </p>
        </div>
        <Switch
          checked={lowBalance.enabled}
          onCheckedChange={(checked) => persistLow({ ...lowBalance, enabled: checked })}
          disabled={savingLow}
        />
      </div>

      {lowBalance.enabled && (
        <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Threshold (credits)</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={10}
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                onBlur={() => {
                  const n = Math.max(0, Math.floor(Number(thresholdInput) || 0));
                  setThresholdInput(String(n));
                  if (n !== lowBalance.threshold) {
                    persistLow({ ...lowBalance, threshold: n });
                  }
                }}
                disabled={savingLow}
                className="h-8 w-32 rounded-md border border-border bg-background px-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
              <div className="flex flex-wrap gap-1">
                {[25, 50, 100, 250, 500].map((v) => (
                  <button
                    key={v}
                    type="button"
                    disabled={savingLow}
                    onClick={() => {
                      setThresholdInput(String(v));
                      persistLow({ ...lowBalance, threshold: v });
                    }}
                    className={`rounded-md border px-2 py-1 text-xs transition ${
                      lowBalance.threshold === v
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            {balance && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Current pack balance:{" "}
                <span
                  className={`font-semibold ${balance.total < lowBalance.threshold ? "text-amber-400" : "text-foreground"}`}
                >
                  {balance.total.toLocaleString()}
                </span>{" "}
                credits
                {balance.total < lowBalance.threshold && " — below threshold"}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={sendTestLow}
            disabled={testingLow || savingLow}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-60"
          >
            {testingLow ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            Run check now
          </button>
        </div>
      )}
    </div>
  );
}
