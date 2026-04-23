import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

interface OrgFeatureRow {
  feature_key: string;
  enabled: boolean;
  config: Record<string, unknown>;
  expires_at: string | null;
}

interface FeatureMap {
  [key: string]: { enabled: boolean; config: Record<string, unknown> };
}

// Module-level cache so multiple components asking for different flags share
// one network round-trip per org.
const cache = new Map<string, { features: FeatureMap; loadedAt: number }>();
const inflight = new Map<string, Promise<FeatureMap>>();
const CACHE_TTL_MS = 60_000;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

async function loadFeatures(orgId: string): Promise<FeatureMap> {
  const existing = inflight.get(orgId);
  if (existing) return existing;

  const promise = (async () => {
    const { data, error } = await supabase
      .from("org_features")
      .select("feature_key, enabled, config, expires_at")
      .eq("organization_id", orgId);

    if (error) {
      console.warn("[useFeatureFlag] load failed", error.message);
      return {};
    }

    const now = Date.now();
    const map: FeatureMap = {};
    for (const row of (data ?? []) as OrgFeatureRow[]) {
      if (!row.enabled) continue;
      if (row.expires_at && new Date(row.expires_at).getTime() < now) continue;
      map[row.feature_key] = { enabled: true, config: row.config ?? {} };
    }
    cache.set(orgId, { features: map, loadedAt: Date.now() });
    notify();
    return map;
  })();

  inflight.set(orgId, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(orgId);
  }
}

/** Force-refresh the feature cache (e.g. after a platform admin toggles a flag). */
export function invalidateFeatureCache(orgId?: string) {
  if (orgId) cache.delete(orgId);
  else cache.clear();
  notify();
}

/**
 * Returns whether the current user's organization has the given feature enabled.
 * Returns `null` while loading so callers can avoid flashing locked UI.
 */
export function useFeatureFlag(featureKey: string): {
  enabled: boolean | null;
  config: Record<string, unknown>;
  loading: boolean;
} {
  const { organization } = useAuth();
  const orgId = organization?.id ?? null;
  const [, force] = useState(0);

  useEffect(() => {
    const rerender = () => force((n) => n + 1);
    listeners.add(rerender);
    return () => {
      listeners.delete(rerender);
    };
  }, []);

  useEffect(() => {
    if (!orgId) return;
    const cached = cache.get(orgId);
    if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) return;
    void loadFeatures(orgId);
  }, [orgId]);

  if (!orgId) return { enabled: false, config: {}, loading: false };

  const cached = cache.get(orgId);
  if (!cached) return { enabled: null, config: {}, loading: true };

  const entry = cached.features[featureKey];
  return {
    enabled: !!entry,
    config: entry?.config ?? {},
    loading: false,
  };
}
