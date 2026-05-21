import { useCallback, useEffect, useState } from "react";
import type { CustomHostnameSnapshot } from "@/functions/custom-hostnames.functions";
import { isNotConfigured, describeError } from "@/lib/cf-saas-errors";
import { classifyCfStatus } from "@/lib/domain-health-utils";
import type { CfStatusKind } from "@/lib/domain-health.types";

export type CfHostnamePollFn = (opts: {
  data: { organizationId: string; hostname: string };
}) => Promise<CustomHostnameSnapshot | null>;

interface UseCfHostnameStatus {
  snapshot: CustomHostnameSnapshot | null;
  loading: boolean;
  /** Effective kind to render (collapses to "loading" while a fetch is in flight). */
  kind: CfStatusKind;
  label: string;
  errorMsg: string | null;
  refresh: () => Promise<void>;
}

/**
 * One-shot Cloudflare custom-hostname status fetch + manual refresh. No
 * polling loop on purpose — a periodic sweeper that writes back into the
 * DB lives elsewhere; this just shows the latest CF state on demand.
 */
export function useCfHostnameStatus(
  organizationId: string,
  hostname: string,
  poll: CfHostnamePollFn,
): UseCfHostnameStatus {
  const [snapshot, setSnapshot] = useState<CustomHostnameSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  // unconfigured = 503 from server fn (CLOUDFLARE_API_TOKEN / _ZONE_ID missing).
  // error = other failure; surfaced inline rather than via toast because the
  // panel may render many rows and a toast storm would be noisy.
  const [state, setState] = useState<CfStatusKind>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const result = await poll({ data: { organizationId, hostname } });
      setSnapshot(result);
      if (!result) {
        setState("unprovisioned");
      } else {
        setState(classifyCfStatus(result).kind);
      }
    } catch (err) {
      if (isNotConfigured(err)) {
        setState("unconfigured");
        setErrorMsg("Cloudflare for SaaS not configured on this worker.");
      } else {
        setState("error");
        setErrorMsg(describeError(err) || "Cloudflare poll failed");
      }
    } finally {
      setLoading(false);
    }
  }, [poll, organizationId, hostname]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const classification = snapshot
    ? classifyCfStatus(snapshot)
    : {
        kind: state,
        label:
          state === "unprovisioned"
            ? "Not provisioned"
            : state === "unconfigured"
              ? "CF not configured"
              : state === "error"
                ? "Cloudflare poll failed"
                : "",
      };
  const kind: CfStatusKind = loading ? "loading" : state;
  const label = kind === "loading" ? "Checking…" : classification.label;

  return { snapshot, loading, kind, label, errorMsg, refresh };
}
