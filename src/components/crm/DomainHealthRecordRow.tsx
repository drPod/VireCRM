import { Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { copyValueToClipboard } from "@/lib/domain-health-utils";

/**
 * Single DNS record row (Name + Value with copy buttons + a type pill + note).
 * Used by both the static "expected records" guide and the live CF status
 * panel that surfaces ownership / SSL DCV TXT records.
 */
export function RecordRow({
  label,
  type,
  name,
  value,
  note,
}: {
  label: string;
  type: string;
  name: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-md border border-border bg-secondary/20 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <Badge variant="outline" className="text-[10px]">
          {type}
        </Badge>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <CopyField label="Name" value={name} />
        <CopyField label="Value" value={value} />
      </div>
      <p className="text-[11px] text-muted-foreground">{note}</p>
    </div>
  );
}

export function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex gap-1">
        <input
          readOnly
          value={value}
          className="h-8 flex-1 rounded-md border border-input bg-input px-2 text-xs font-mono text-foreground outline-none"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2"
          onClick={() => void copyValueToClipboard(value, label)}
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
