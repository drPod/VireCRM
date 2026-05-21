import { Button } from "@/components/ui/button";
import { Activity, Loader2, Pencil, Trash2 } from "lucide-react";

export interface ProviderConnectedActionsProps {
  testing: boolean;
  testLocked: boolean;
  removing: boolean;
  onTest: () => void | Promise<void>;
  onEdit: () => void;
  onDisconnect: () => void;
}

/** Test / Edit / Disconnect action row shown on a connected provider card. */
export function ProviderConnectedActions({
  testing,
  testLocked,
  removing,
  onTest,
  onEdit,
  onDisconnect,
}: ProviderConnectedActionsProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      <Button
        variant="outline"
        size="sm"
        onClick={onTest}
        disabled={testLocked}
        aria-busy={testing}
      >
        {testing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Activity className="h-3.5 w-3.5" />
        )}
        Test
      </Button>
      <Button variant="outline" size="sm" onClick={onEdit}>
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </Button>
      <Button variant="outline" size="sm" onClick={onDisconnect} disabled={removing}>
        {removing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
        Disconnect
      </Button>
    </div>
  );
}
