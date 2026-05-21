import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import {
  listConnectorsFn,
  refreshConnectorStatusFn,
  type ConnectorStatus,
} from "@/functions/connectors.functions";
import { CONNECTORS } from "@/lib/connectors/catalog";

interface UseConnectorStatusArgs {
  organizationId: string | null | undefined;
  isOwner: boolean;
}

export interface UseConnectorStatusResult {
  statuses: Record<string, ConnectorStatus>;
  setStatuses: React.Dispatch<React.SetStateAction<Record<string, ConnectorStatus>>>;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Owns the connector-status map + the background poller that re-checks any
 * connector that's been enabled but is still waiting on the gateway to
 * inject its env var (or, for Google connectors, still waiting on the
 * connected-email discovery hop).
 *
 * Polling cadence: every 4s for the first minute, then every 12s, capped at
 * 5 minutes total. We only poll while the page is visible — when the user
 * switches tabs we pause to avoid wasted network calls.
 *
 * Surfaces a one-shot "<Provider> connected" toast the first time a pending
 * connector goes live; the dedup set is seeded on initial load so providers
 * that were already connected don't re-toast on refresh.
 */
export function useConnectorStatus({
  organizationId,
  isOwner,
}: UseConnectorStatusArgs): UseConnectorStatusResult {
  const listConnectors = useAuthedServerFn(listConnectorsFn);
  const refreshConnectorStatus = useAuthedServerFn(refreshConnectorStatusFn);

  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Record<string, ConnectorStatus>>({});
  // Tracks which providers we've already toasted "Connected" for, so the
  // background poller doesn't re-toast on every successful refresh.
  const toastedConnectedRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!organizationId || !isOwner) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await listConnectors({ data: { organizationId } });
      const map: Record<string, ConnectorStatus> = {};
      for (const s of res.statuses) map[s.id] = s;
      setStatuses(map);
      // Seed the "already toasted" set with anything that's currently
      // connected, so the poller doesn't fire a toast on first load.
      for (const s of res.statuses) {
        if (s.enabled && s.credentialPresent && s.verified === true) {
          toastedConnectedRef.current.add(s.id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [organizationId, isOwner, listConnectors]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Background poller: any provider that's enabled but still missing its
  // gateway credentials (or, for Gmail, missing the discovered connectedEmail)
  // gets re-checked periodically. As soon as the gateway has injected the env
  // var, the row will swap to "Connected" without a manual reload.
  useEffect(() => {
    if (!organizationId || !isOwner) return;

    const pendingProviders = () =>
      Object.values(statuses)
        .filter((s) => {
          if (!s.enabled) return false;
          // Awaiting auth: enabled but the gateway env var hasn't appeared yet.
          if (!s.credentialPresent) return true;
          // Verify failed mid-flight — keep polling, the gateway may still be
          // refreshing the token.
          if (s.verified === false) return true;
          // Google connectors: credentials are there but we haven't
          // discovered the connected account email yet. Worth one more
          // refresh to populate it.
          if (
            (s.id === "gmail" || s.id === "google_calendar") &&
            s.verified === true &&
            !s.config?.connectedEmail
          ) {
            return true;
          }
          return false;
        })
        .map((s) => s.id);

    if (pendingProviders().length === 0) return;

    const startedAt = Date.now();
    const MAX_DURATION_MS = 5 * 60 * 1000;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;
      if (document.hidden) {
        // Page not visible — try again soon without hitting the network.
        timer = setTimeout(tick, 4000);
        return;
      }
      const providers = pendingProviders();
      if (providers.length === 0 || Date.now() - startedAt > MAX_DURATION_MS) {
        return;
      }

      await Promise.all(
        providers.map(async (provider) => {
          try {
            const { status } = await refreshConnectorStatus({
              data: { organizationId, provider },
            });
            if (cancelled) return;
            setStatuses((prev) => ({ ...prev, [provider]: status }));

            // Surface a toast the first time a pending connector goes live.
            const becameConnected =
              status.enabled && status.credentialPresent && status.verified === true;
            if (becameConnected && !toastedConnectedRef.current.has(provider)) {
              toastedConnectedRef.current.add(provider);
              const meta = CONNECTORS.find((c) => c.id === provider);
              const email =
                (provider === "gmail" || provider === "google_calendar") &&
                typeof status.config?.connectedEmail === "string"
                  ? (status.config.connectedEmail as string)
                  : null;
              toast.success(`${meta?.name ?? provider} connected`, {
                description: email
                  ? `Connected as ${email}.`
                  : "Credentials are live and verified.",
              });
            }
          } catch {
            // Swallow — next tick will retry.
          }
        }),
      );

      const elapsed = Date.now() - startedAt;
      const interval = elapsed < 60_000 ? 4000 : 12000;
      timer = setTimeout(tick, interval);
    };

    timer = setTimeout(tick, 4000);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [organizationId, isOwner, statuses, refreshConnectorStatus]);

  return { statuses, setStatuses, loading, refresh };
}
