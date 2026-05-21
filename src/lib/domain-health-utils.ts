/**
 * Shared utilities for the domain-health panel surface.
 *
 * Pure functions + small browser-side side effects only — no React, no
 * server-fn imports. Lets the components stay thin and import their
 * narrow surface from one place.
 */

import { toast } from "sonner";
import type { CustomHostnameSnapshot } from "@/functions/custom-hostnames.functions";
import type { CfStatusClassification } from "./domain-health.types";

export async function copyValueToClipboard(value: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Couldn't copy — copy manually");
  }
}

export function openExternal(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

const CF_FAILED_STATUSES = new Set([
  "blocked",
  "deleted",
  "deactivated",
  "test_blocked",
  "test_failed",
]);

/**
 * Classify a Cloudflare custom-hostname snapshot into a UI badge state.
 *
 * Pending / pending_blocked / pending_migration / pending_deletion /
 * test_pending / test_active / test_active_apex / moved all map to
 * "Verifying" while the hostname clears CF's ownership/DCV gauntlet.
 */
export function classifyCfStatus(snap: CustomHostnameSnapshot | null): CfStatusClassification {
  if (!snap) return { kind: "unprovisioned", label: "Not provisioned" };
  const { status, sslStatus } = snap;
  if (CF_FAILED_STATUSES.has(status)) return { kind: "failed", label: "Failed" };
  if (status === "active" || status === "active_redeploying") {
    if (sslStatus === "active") return { kind: "active", label: "Active" };
    return { kind: "ssl", label: "Setting up SSL" };
  }
  return { kind: "verifying", label: "Verifying" };
}
