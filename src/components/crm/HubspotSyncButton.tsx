import { useState } from "react";
import { Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { importHubspotContactsFn } from "@/functions/connector-actions.functions";

interface HubspotSyncButtonProps {
  organizationId: string;
  importLimit: unknown;
}

export function HubspotSyncButton({ organizationId, importLimit }: HubspotSyncButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const importHubspot = useServerFn(importHubspotContactsFn);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const parsed =
        typeof importLimit === "string"
          ? parseInt(importLimit, 10)
          : typeof importLimit === "number"
            ? importLimit
            : 25;
      const limit = Number.isFinite(parsed) && parsed > 0 ? parsed : 25;
      const res = await importHubspot({ data: { organizationId, limit } });
      toast.success("HubSpot sync complete", {
        description: `Imported ${res.inserted} new lead${res.inserted === 1 ? "" : "s"} (${res.skipped} skipped).`,
      });
    } catch (err) {
      toast.error("Sync failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Button variant="outline" size="sm" disabled={syncing} onClick={handleSync}>
      {syncing ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      Sync contacts
    </Button>
  );
}
