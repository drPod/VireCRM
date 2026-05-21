import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  RefreshCw,
  Search,
  ChevronRight,
  ChevronDown,
  CreditCard,
  ExternalLink,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { INDUSTRY_TEMPLATES, type IndustryKey } from "@/lib/industry-templates";
import { PLAN_CATALOG, getPlan, type PlanCatalogEntry } from "@/lib/plan-catalog";
import { useConfirm } from "@/hooks/useConfirm";
import { formatPlanPrice, planBadgeVariant, subStatusVariant } from "@/lib/admin-utils";
import type { AdminOrgRow, OrgBillingSnapshot } from "@/types/admin";

const INDUSTRY_OPTIONS: ReadonlyArray<{ key: IndustryKey; label: string }> = [
  { key: "general", label: "General" },
  { key: "gym", label: "Gym" },
  { key: "solar", label: "Solar" },
  { key: "energy", label: "Energy" },
  { key: "real_estate", label: "Real Estate" },
  { key: "insurance", label: "Insurance" },
];

const PLAN_LABELS: ReadonlyArray<{ value: string; label: string; price: string; tagline: string }> =
  PLAN_CATALOG.map((p: PlanCatalogEntry) => ({
    value: p.value,
    label: p.label,
    price: formatPlanPrice(p),
    tagline: p.tagline,
  }));

export function OrganizationsPanel() {
  const [rows, setRows] = useState<AdminOrgRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { confirm } = useConfirm();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_organizations");
    setLoading(false);
    if (error) {
      toast.error(error.message ?? "Failed to load organizations");
      return;
    }
    setRows((data ?? []) as AdminOrgRow[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        (r.industry_template ?? "").toLowerCase().includes(q) ||
        (r.owner_email ?? "").toLowerCase().includes(q) ||
        (r.plan ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const handleIndustryChange = async (orgId: string, industry: string) => {
    setSavingId(orgId);
    const { data, error } = await supabase.rpc("admin_set_org_industry", {
      p_org_id: orgId,
      p_industry: industry,
    });
    setSavingId(null);
    if (error) {
      toast.error(error.message ?? "Failed to update industry");
      return;
    }
    const result = data as { success: boolean; error?: string } | null;
    if (!result?.success) {
      toast.error(result?.error ?? "Failed to update industry");
      return;
    }
    toast.success(`Industry set to ${industry}`);
    void load();
  };

  const handlePlanChange = async (orgId: string, plan: string, orgLabel?: string) => {
    const target = getPlan(plan);
    // Require explicit confirmation for any non-free plan so a mis-click in
    // the dropdown can't silently grant a $7,000 product or a paid tier.
    if (target && target.value !== "free") {
      const price = formatPlanPrice(target);
      const who = orgLabel ? ` to ${orgLabel}` : "";
      const ok = await confirm({
        title: `Assign "${target.label}" (${price})${who}?`,
        description: `${target.tagline}\n\nThis updates the org's plan immediately. It does NOT charge the customer — use the invoice flow for billing.`,
        confirmLabel: "Assign plan",
      });
      if (!ok) return;
    }
    setSavingPlanId(orgId);
    const { data, error } = await supabase.rpc("admin_set_org_plan", {
      p_org_id: orgId,
      p_plan: plan,
    });
    setSavingPlanId(null);
    if (error) {
      toast.error(error.message ?? "Failed to update plan");
      return;
    }
    const result = data as { success: boolean; error?: string } | null;
    if (!result?.success) {
      toast.error(result?.error ?? "Failed to update plan");
      return;
    }
    toast.success(`Plan set to ${target?.label ?? plan}`);
    void load();
  };

  const handleRemovePlan = async (orgId: string, orgLabel?: string) => {
    const ok = await confirm({
      title: `Remove the assigned plan${orgLabel ? ` from ${orgLabel}` : ""}?`,
      description: "The organization will be downgraded to Free.",
      confirmLabel: "Remove plan",
      destructive: true,
    });
    if (!ok) return;
    void handlePlanChange(orgId, "free", orgLabel);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>All Organizations</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Assign plans, industry templates, and inspect billing for every customer org.
            {rows ? (
              <>
                {" "}
                Showing {filtered.length} of {rows.length}.
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search orgs, owners, plans…"
              className="w-64 pl-8"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !rows ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No organizations match.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Org</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((org) => {
                  const tpl = org.industry_template
                    ? INDUSTRY_TEMPLATES[org.industry_template as IndustryKey]
                    : undefined;
                  const isExpanded = expandedId === org.id;
                  const planValue = org.plan ?? "free";
                  return (
                    <Fragment key={org.id}>
                      <TableRow>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setExpandedId(isExpanded ? null : org.id)}
                            aria-label={isExpanded ? "Collapse" : "Expand"}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-foreground">{org.name}</div>
                          <div className="font-mono text-xs text-muted-foreground">{org.slug}</div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {org.owner_email ? (
                            <span className="font-mono text-muted-foreground">
                              {org.owner_email}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Select
                              value={planValue}
                              onValueChange={(v) => void handlePlanChange(org.id, v, org.name)}
                              disabled={savingPlanId === org.id}
                            >
                              <SelectTrigger className="w-44">
                                <SelectValue>
                                  {savingPlanId === org.id ? (
                                    <span className="flex items-center gap-2">
                                      <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                                    </span>
                                  ) : (
                                    <Badge
                                      variant={planBadgeVariant(planValue)}
                                      className="capitalize"
                                    >
                                      {getPlan(planValue)?.label ?? planValue}
                                    </Badge>
                                  )}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {PLAN_LABELS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value} className="py-2">
                                    <div className="flex flex-col">
                                      <div className="flex items-center justify-between gap-3">
                                        <span className="font-medium">{opt.label}</span>
                                        <span className="text-[11px] tabular-nums text-muted-foreground">
                                          {opt.price}
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-muted-foreground">
                                        {opt.tagline}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {planValue !== "free" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemovePlan(org.id, org.name)}
                                disabled={savingPlanId === org.id}
                              >
                                Remove
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <Badge
                              variant={subStatusVariant(org.subscription_status)}
                              className="w-fit capitalize"
                            >
                              {org.subscription_status ?? "no subscription"}
                            </Badge>
                            {org.current_period_end ? (
                              <span className="text-[11px] text-muted-foreground">
                                {org.cancel_at_period_end ? "ends " : "renews "}
                                {formatDistanceToNow(new Date(org.current_period_end), {
                                  addSuffix: true,
                                })}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={org.industry_template ?? "general"}
                            onValueChange={(v) => void handleIndustryChange(org.id, v)}
                            disabled={savingId === org.id}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Select…">
                                {savingId === org.id ? (
                                  <span className="flex items-center gap-2">
                                    <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                                  </span>
                                ) : (
                                  (tpl?.name ?? org.industry_template ?? "General")
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {INDUSTRY_OPTIONS.map((opt) => (
                                <SelectItem key={opt.key} value={opt.key}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {org.member_count}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(org.created_at), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                      {isExpanded ? (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-muted/30">
                            <OrgBillingDetails orgId={org.id} />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OrgBillingDetails({ orgId }: { orgId: string }) {
  const [data, setData] = useState<OrgBillingSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const { data: res, error: err } = await supabase.rpc("admin_org_billing", {
        p_org_id: orgId,
      });
      if (cancelled) return;
      setLoading(false);
      if (err) {
        setError(err.message ?? "Failed to load billing");
        return;
      }
      setData(res as unknown as OrgBillingSnapshot);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading billing…
      </div>
    );
  }
  if (error) {
    return <div className="py-3 text-xs text-destructive">{error}</div>;
  }
  if (!data) return null;

  return (
    <div className="grid gap-4 py-2 md:grid-cols-2">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <CreditCard className="h-3 w-3" /> Subscriptions
        </div>
        {data.subscriptions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No Stripe subscriptions on file.</p>
        ) : (
          <ul className="space-y-2">
            {data.subscriptions.map((s) => (
              <li key={s.id} className="rounded-md border border-border/60 bg-card p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={subStatusVariant(s.status)} className="capitalize">
                    {s.status}
                  </Badge>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {s.environment}
                  </span>
                </div>
                <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {s.price_id ?? "—"}
                </div>
                {s.current_period_end ? (
                  <div className="text-[11px] text-muted-foreground">
                    {s.cancel_at_period_end ? "Ends " : "Renews "}
                    {new Date(s.current_period_end).toLocaleDateString()}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <FileText className="h-3 w-3" /> Recent invoices
        </div>
        {data.invoices.length === 0 ? (
          <p className="text-xs text-muted-foreground">No platform invoices yet.</p>
        ) : (
          <ul className="space-y-2">
            {data.invoices.slice(0, 6).map((inv) => (
              <li key={inv.id} className="rounded-md border border-border/60 bg-card p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px]">{inv.number ?? inv.id.slice(0, 8)}</span>
                  <Badge variant={subStatusVariant(inv.status)} className="capitalize">
                    {inv.status}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {(inv.amount_paid_cents / 100).toLocaleString(undefined, {
                      style: "currency",
                      currency: inv.currency.toUpperCase(),
                    })}
                    {" / "}
                    {(inv.amount_due_cents / 100).toLocaleString(undefined, {
                      style: "currency",
                      currency: inv.currency.toUpperCase(),
                    })}
                  </span>
                  {inv.hosted_invoice_url ? (
                    <a
                      href={inv.hosted_invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
