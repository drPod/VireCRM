import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  updateAuditRetentionFn,
  purgeAuditLogNowFn,
  type AuditRetentionInfo,
} from "@/functions/audit-retention.functions";

export interface UseRetentionSettingsArgs {
  retention: AuditRetentionInfo | null;
  refresh: () => Promise<void>;
}

export interface UseRetentionSettingsResult {
  retentionInput: string;
  setRetentionInput: (v: string) => void;
  savingRetention: boolean;
  purging: boolean;
  handleSaveRetention: () => Promise<void>;
  handlePurgeNow: () => Promise<void>;
}

export function useRetentionSettings({
  retention,
  refresh,
}: UseRetentionSettingsArgs): UseRetentionSettingsResult {
  const updateRetention = useServerFn(updateAuditRetentionFn);
  const purgeNow = useServerFn(purgeAuditLogNowFn);

  const [retentionInput, setRetentionInput] = useState<string>("90");
  const [savingRetention, setSavingRetention] = useState(false);
  const [purging, setPurging] = useState(false);

  // Sync input with latest retention on every refresh (matches pre-refactor
  // behavior where refresh always clobbered any unsaved input).
  useEffect(() => {
    if (retention) {
      setRetentionInput(String(retention.retention_days));
    }
  }, [retention]);

  const handleSaveRetention = async () => {
    const days = parseInt(retentionInput, 10);
    if (Number.isNaN(days) || days < 0 || days > 3650) {
      toast.error("Enter a number between 0 and 3650");
      return;
    }
    setSavingRetention(true);
    try {
      await updateRetention({ data: { retention_days: days } });
      toast.success(
        days === 0
          ? "Retention disabled — entries will be kept forever"
          : `Saved — entries older than ${days} day${days === 1 ? "" : "s"} will be purged`,
      );
      await refresh();
    } catch (e) {
      toast.error("Could not save retention", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setSavingRetention(false);
    }
  };

  const handlePurgeNow = async () => {
    setPurging(true);
    try {
      const res = await purgeNow();
      toast.success(`Purged ${res.deleted} old entr${res.deleted === 1 ? "y" : "ies"}`);
      await refresh();
    } catch (e) {
      toast.error("Purge failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setPurging(false);
    }
  };

  return {
    retentionInput,
    setRetentionInput,
    savingRetention,
    purging,
    handleSaveRetention,
    handlePurgeNow,
  };
}
