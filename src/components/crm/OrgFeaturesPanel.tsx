import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Search, Sparkles, Trash2 } from "lucide-react";
import { FEATURE_CATALOG, FEATURE_BY_KEY } from "@/lib/features/catalog";
import { invalidateFeatureCache } from "@/hooks/useFeatureFlag";
import { useConfirm } from "@/hooks/useConfirm";

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  brand_name: string | null;
  plan: string;
  is_reseller: boolean;
}

interface FeatureRow {
  id: string;
  feature_key: string;
  enabled: boolean;
  notes: string | null;
  enabled_at: string;
  expires_at: string | null;
}

export function OrgFeaturesPanel() {
  const [search, setSearch] = useState("");
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [loadingFeatures, setLoadingFeatures] = useState(false);
  const [grantingKey, setGrantingKey] = useState<string | null>(null);
  const [pickFeature, setPickFeature] = useState<string>(FEATURE_CATALOG[0]?.key ?? "");
  const [notes, setNotes] = useState("");
  const { confirm } = useConfirm();

  const loadOrgs = useCallback(async (q: string) => {
    setLoadingOrgs(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-org-features", {
        body: { action: "list_orgs", search: q },
      });
      if (error) {
        toast.error(error.message ?? "Failed to load organizations");
        return;
      }
      setOrgs((data?.organizations as OrgRow[]) ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoadingOrgs(false);
    }
  }, []);

  const loadFeatures = useCallback(async (orgId: string) => {
    setLoadingFeatures(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-org-features", {
        body: { action: "list", organizationId: orgId },
      });
      if (error) {
        toast.error(error.message ?? "Failed to load features");
        return;
      }
      setFeatures((data?.features as FeatureRow[]) ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoadingFeatures(false);
    }
  }, []);

  useEffect(() => {
    void loadOrgs("");
  }, [loadOrgs]);

  useEffect(() => {
    if (selectedOrgId) void loadFeatures(selectedOrgId);
    else setFeatures([]);
  }, [selectedOrgId, loadFeatures]);

  const selectedOrg = useMemo(
    () => orgs.find((o) => o.id === selectedOrgId) ?? null,
    [orgs, selectedOrgId],
  );
  const enabledKeys = useMemo(() => new Set(features.map((f) => f.feature_key)), [features]);
  const availableToGrant = useMemo(
    () => FEATURE_CATALOG.filter((f) => !enabledKeys.has(f.key)),
    [enabledKeys],
  );

  async function handleGrant() {
    if (!selectedOrgId || !pickFeature) return;
    setGrantingKey(pickFeature);
    try {
      const { error } = await supabase.functions.invoke("manage-org-features", {
        body: {
          action: "grant",
          organizationId: selectedOrgId,
          featureKey: pickFeature,
          notes: notes.trim() || undefined,
        },
      });
      if (error) {
        toast.error(error.message ?? "Failed to grant feature");
        return;
      }
      toast.success(`Enabled "${FEATURE_BY_KEY[pickFeature]?.name ?? pickFeature}"`);
      setNotes("");
      invalidateFeatureCache(selectedOrgId);
      await loadFeatures(selectedOrgId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setGrantingKey(null);
    }
  }

  async function handleRevoke(featureKey: string) {
    if (!selectedOrgId) return;
    const ok = await confirm({
      title: `Revoke "${FEATURE_BY_KEY[featureKey]?.name ?? featureKey}" for this org?`,
      confirmLabel: "Revoke",
      destructive: true,
    });
    if (!ok) return;
    try {
      const { error } = await supabase.functions.invoke("manage-org-features", {
        body: {
          action: "revoke",
          organizationId: selectedOrgId,
          featureKey,
        },
      });
      if (error) {
        toast.error(error.message ?? "Failed to revoke feature");
        return;
      }
      toast.success("Feature revoked");
      invalidateFeatureCache(selectedOrgId);
      await loadFeatures(selectedOrgId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unexpected error");
    }
  }

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle>Custom Features (Per Org)</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Toggle premium / enterprise features for any organization without changing the base CRM.
          Add features to <code className="text-xs">src/lib/features/catalog.ts</code>, gate UI with{" "}
          <code className="text-xs">{`<FeatureGate feature="...">`}</code>.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Org search + select */}
        <div className="space-y-2">
          <Label htmlFor="org-search">Find organization</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="org-search"
                placeholder="Search by name, slug, or brand"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void loadOrgs(search);
                }}
                className="pl-8"
              />
            </div>
            <Button variant="outline" onClick={() => void loadOrgs(search)} disabled={loadingOrgs}>
              {loadingOrgs ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </div>
          <Select value={selectedOrgId ?? ""} onValueChange={(v) => setSelectedOrgId(v || null)}>
            <SelectTrigger>
              <SelectValue placeholder="Select an organization" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                  {o.brand_name && o.brand_name !== o.name ? ` (${o.brand_name})` : ""}
                  {o.is_reseller ? " — reseller" : ""}
                </SelectItem>
              ))}
              {orgs.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">No organizations</div>
              )}
            </SelectContent>
          </Select>
          {selectedOrg && (
            <p className="text-xs text-muted-foreground">
              Org ID: <span className="font-mono">{selectedOrg.id}</span> · plan:{" "}
              <Badge variant="outline" className="ml-1">
                {selectedOrg.plan}
              </Badge>
            </p>
          )}
        </div>

        {selectedOrgId && (
          <>
            {/* Currently enabled features */}
            <div className="space-y-2">
              <Label>Enabled features</Label>
              {loadingFeatures ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : features.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No custom features enabled for this org yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {features.map((f) => {
                    const def = FEATURE_BY_KEY[f.feature_key];
                    return (
                      <div
                        key={f.id}
                        className="flex items-start justify-between gap-3 rounded-md border p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{def?.name ?? f.feature_key}</span>
                            <Badge variant="secondary" className="text-xs">
                              {def?.category ?? "custom"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {def?.description ?? "Custom feature"}
                          </p>
                          {f.notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">
                              Note: {f.notes}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleRevoke(f.feature_key)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Grant new feature */}
            {availableToGrant.length > 0 && (
              <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                <Label>Enable a new feature</Label>
                <Select value={pickFeature} onValueChange={setPickFeature}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableToGrant.map((f) => (
                      <SelectItem key={f.key} value={f.key}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Internal note (optional, e.g. 'Sold $500/mo addon')"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <Button
                  onClick={handleGrant}
                  disabled={!pickFeature || grantingKey !== null}
                  className="w-full"
                >
                  {grantingKey ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Enabling...
                    </>
                  ) : (
                    "Enable feature"
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
