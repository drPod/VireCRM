import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import {
  checkDomainHealth,
  type DomainHealthResult,
} from "@/functions/domain-health.functions";

interface UseDomainHealthCheck {
  results: DomainHealthResult[] | null;
  loading: boolean;
  lastRunAt: string | null;
  refresh: () => Promise<void>;
}

/**
 * Drives the live HTTPS / SSL / app-fingerprint probe panel for a given org.
 *
 * Auto-runs once on mount, and ticks a 30s heartbeat so the "Xs ago" caption
 * in the consumer stays current without re-fetching.
 */
export function useDomainHealthCheck(organizationId: string | undefined): UseDomainHealthCheck {
  const runCheck = useAuthedServerFn(checkDomainHealth);
  const [results, setResults] = useState<DomainHealthResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [, setNowTick] = useState(0);

  // Tick once a minute so "Xm ago" stays accurate; `formatRelativeTime` only
  // changes at minute boundaries so finer ticks would be wasted re-renders.
  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const refresh = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = (await runCheck({ data: { organizationId } })) as {
        ok: boolean;
        results: DomainHealthResult[];
      };
      setResults(res.results ?? []);
      setLastRunAt(new Date().toISOString());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Health check failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [organizationId, runCheck]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { results, loading, lastRunAt, refresh };
}
