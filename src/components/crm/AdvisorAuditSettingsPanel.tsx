import { Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuditRetentionInfo } from "@/functions/audit-retention.functions";

interface AdvisorAuditSettingsPanelProps {
  retention: AuditRetentionInfo;
  retentionInput: string;
  onRetentionInputChange: (v: string) => void;
  savingRetention: boolean;
  purging: boolean;
  onSave: () => void;
  onPurge: () => void;
}

export function AdvisorAuditSettingsPanel({
  retention,
  retentionInput,
  onRetentionInputChange,
  savingRetention,
  purging,
  onSave,
  onPurge,
}: AdvisorAuditSettingsPanelProps) {
  return (
    <div className="border-b border-border bg-background/30 px-5 py-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <Label htmlFor="retention-days" className="text-xs font-semibold">
            Retention period (days)
          </Label>
          <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">
            Entries older than this are purged automatically each day. Use{" "}
            <span className="font-mono">0</span> to keep entries forever (max 3650).
          </p>
          <Input
            id="retention-days"
            type="number"
            min={0}
            max={3650}
            value={retentionInput}
            onChange={(ev) => onRetentionInputChange(ev.target.value)}
            disabled={!retention.is_owner || savingRetention}
            className="h-8 text-sm max-w-[140px]"
          />
        </div>
        <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
          <span>Total entries: {retention.total_entries}</span>
          <span>
            Oldest:{" "}
            {retention.oldest_entry
              ? new Date(retention.oldest_entry).toLocaleDateString()
              : "—"}
          </span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={onPurge}
            disabled={!retention.is_owner || purging || retention.retention_days === 0}
            className="h-8"
          >
            {purging ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            <span className="ml-1.5 text-xs">Purge now</span>
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={
              !retention.is_owner ||
              savingRetention ||
              retentionInput === String(retention.retention_days)
            }
            className="h-8"
          >
            {savingRetention ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span className="ml-1.5 text-xs">Save</span>
          </Button>
        </div>
      </div>
      {!retention.is_owner && (
        <p className="text-[11px] text-muted-foreground mt-2">
          Only organization owners can change retention.
        </p>
      )}
    </div>
  );
}
