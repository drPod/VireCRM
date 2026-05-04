import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Crown, Loader2, ShieldAlert, ShieldCheck, RefreshCw, Search, Building2, Users, Inbox, FileText, ChevronRight, ChevronDown, CreditCard, ExternalLink, DollarSign, TrendingUp, Activity, Receipt, Download } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { INDUSTRY_TEMPLATES, type IndustryKey } from "@/lib/industry-templates";
import { PLAN_CATALOG, getPlan, planLineItems, planTotalCents, type PlanCatalogEntry } from "@/lib/plan-catalog";
import { PlatformAdminPanel } from "@/components/crm/PlatformAdminPanel";
import { PlatformAdminsPanel } from "@/components/crm/PlatformAdminsPanel";

export const Route = createFileRoute("/_app/admin")({
  component: AdminConsole,
  head: () => ({
    meta: [
      { title: "Genesis — Platform Admin" },
      { name: "description", content: "Host-only platform administration console" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const INDUSTRY_OPTIONS: ReadonlyArray<{ key: IndustryKey; label: string }> = [
  { key: "general", label: "General" },
  { key: "gym", label: "Gym" },
  { key: "solar", label: "Solar" },
  { key: "energy", label: "Energy" },
  { key: "real_estate", label: "Real Estate" },
  { key: "insurance", label: "Insurance" },
];

interface AdminOrgRow {
  id: string;
  name: string;
  slug: string;
  industry_template: string | null;
  plan: string | null;
  is_reseller: boolean | null;
  member_count: number;
  lead_count: number;
  created_at: string;
  owner_email: string | null;
  subscription_status: string | null;
  subscription_price_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
}

interface OrgBillingSubscription {
  id: string;
  status: string;
  price_id: string | null;
  product_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  environment: string;
  created_at: string;
}

interface OrgBillingInvoice {
  id: string;
  number: string | null;
  status: string;
  amount_due_cents: number;
  amount_paid_cents: number;
  currency: string;
  hosted_invoice_url: string | null;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
}

interface OrgBillingSnapshot {
  owner: { user_id: string; email: string } | null;
  subscriptions: OrgBillingSubscription[];
  invoices: OrgBillingInvoice[];
}

// Plan dropdown options derive from the shared catalog so the org-row
// "Assign plan" select and the invoice "Use plan" select can never drift.
const PLAN_LABELS: ReadonlyArray<{ value: string; label: string }> = PLAN_CATALOG.map(
  (p) => ({ value: p.value, label: p.label }),
);

function planBadgeVariant(plan: string | null): "default" | "secondary" | "outline" | "destructive" {
  if (!plan || plan === "free") return "outline";
  if (plan === "ownership") return "default";
  if (plan === "enterprise" || plan === "pro") return "secondary";
  return "outline";
}

function subStatusVariant(status: string | null | undefined): "default" | "secondary" | "destructive" | "outline" {
  if (!status) return "outline";
  if (status === "active" || status === "trialing") return "default";
  if (status === "past_due" || status === "unpaid") return "destructive";
  if (status === "canceled" || status === "incomplete_expired") return "outline";
  return "secondary";
}

interface AdminProfileRow {
  user_id: string;
  full_name: string | null;
  organization_id: string;
  organization_name: string;
  created_at: string;
}

interface AdminSubmissionRow {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  project_type: string | null;
  budget: string | null;
  message: string;
  status: string;
  origin: string | null;
  test_mode: boolean;
  sentiment: string | null;
  topic: string | null;
  intent_summary: string | null;
  priority_suggestion: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  replied_at: string | null;
}

function AdminConsole() {
  const { user } = useAuth();
  const { loading: checking, isAdmin } = usePlatformAdmin();

  if (checking) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <Card className="border-destructive/40">
          <CardHeader className="flex flex-row items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <CardTitle>Restricted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The platform admin console is only available to host administrators.
              {user?.email ? (
                <> You're signed in as <span className="font-mono">{user.email}</span>.</>
              ) : null}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Platform Admin Console</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Host-level controls. Every action here applies across all customer organizations.
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Crown className="h-3 w-3" /> Super Admin
        </Badge>
      </div>

      <Tabs defaultValue="financials" className="w-full">
        <TabsList>
          <TabsTrigger value="financials" className="gap-2">
            <DollarSign className="h-4 w-4" /> Financials
          </TabsTrigger>
          <TabsTrigger value="orgs" className="gap-2">
            <Building2 className="h-4 w-4" /> Organizations
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" /> Users
          </TabsTrigger>
          <TabsTrigger value="submissions" className="gap-2">
            <Inbox className="h-4 w-4" /> Contact Submissions
          </TabsTrigger>
          <TabsTrigger value="subs" className="gap-2">
            <FileText className="h-4 w-4" /> Manual Subscriptions
          </TabsTrigger>
          <TabsTrigger value="admins" className="gap-2">
            <ShieldCheck className="h-4 w-4" /> Admins
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <ShieldAlert className="h-4 w-4" /> Template Audit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="financials" className="mt-6">
          <FinancialsPanel />
        </TabsContent>
        <TabsContent value="orgs" className="mt-6">
          <OrganizationsPanel />
        </TabsContent>
        <TabsContent value="users" className="mt-6">
          <UsersPanel />
        </TabsContent>
        <TabsContent value="submissions" className="mt-6">
          <ContactSubmissionsPanel />
        </TabsContent>
        <TabsContent value="subs" className="mt-6">
          <PlatformAdminPanel />
        </TabsContent>
        <TabsContent value="admins" className="mt-6">
          <PlatformAdminsPanel />
        </TabsContent>
        <TabsContent value="audit" className="mt-6">
          <TemplateAuditPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* --------------------------- Financials Panel ---------------------------- */

interface FinancialOverview {
  subscriptions: {
    total: number;
    active: number;
    trialing: number;
    past_due: number;
    canceled: number;
    new_this_month: number;
    ending_soon: number;
  };
  invoices: {
    total: number;
    paid_count: number;
    outstanding_count: number;
    void_count: number;
    new_this_month: number;
    paid_cents_total: number;
    paid_cents_this_month: number;
    outstanding_cents: number;
  };
  organizations: {
    total: number;
    new_this_month: number;
    resellers: number;
    paying: number;
  };
  users: { total: number; new_this_month: number };
  recent_invoices: Array<{
    id: string;
    customer_email: string;
    customer_name: string | null;
    amount_due_cents: number;
    amount_paid_cents: number;
    currency: string;
    status: string;
    number: string | null;
    hosted_invoice_url: string | null;
    created_at: string;
    paid_at: string | null;
  }>;
  recent_subscriptions: Array<{
    id: string;
    user_id: string;
    email: string | null;
    product_id: string;
    price_id: string;
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean | null;
    created_at: string;
    environment: string;
  }>;
  plan_breakdown: Record<string, number>;
  generated_at: string;
}

function formatMoney(cents: number, currency = "usd") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    }).format((cents || 0) / 100);
  } catch {
    return `$${((cents || 0) / 100).toFixed(2)}`;
  }
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  hint?: string;
  accent?: "primary" | "success" | "warning" | "muted";
}) {
  const accentClass =
    accent === "success"
      ? "text-emerald-400"
      : accent === "warning"
        ? "text-amber-400"
        : accent === "muted"
          ? "text-muted-foreground"
          : "text-primary";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <Icon className={`h-4 w-4 ${accentClass}`} />
        </div>
        <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function FinancialsPanel() {
  const [data, setData] = useState<FinancialOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data: res, error: err } = await supabase.rpc("admin_financial_overview");
    if (err) {
      setError(err.message);
      toast.error("Failed to load financial overview", { description: err.message });
    } else {
      setData(res as unknown as FinancialOverview);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // realtime updates
    const channel = supabase
      .channel("admin-financials")
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "platform_invoices" }, () => load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-destructive">{error}</p>
          <Button onClick={load} variant="outline" size="sm" className="mt-3 gap-2">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { subscriptions: s, invoices: inv, organizations: orgs, users: usr } = data;
  const planEntries = Object.entries(data.plan_breakdown || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Financial overview</h2>
          <p className="text-xs text-muted-foreground">
            Live snapshot · updated {formatDistanceToNow(new Date(data.generated_at), { addSuffix: true })}
          </p>
        </div>
        <Button onClick={load} variant="outline" size="sm" className="gap-2" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {/* Revenue row */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={DollarSign}
          label="Revenue (this month)"
          value={formatMoney(inv.paid_cents_this_month)}
          hint={`${inv.new_this_month} new invoice${inv.new_this_month === 1 ? "" : "s"}`}
          accent="success"
        />
        <StatCard
          icon={TrendingUp}
          label="Revenue (all time)"
          value={formatMoney(inv.paid_cents_total)}
          hint={`${inv.paid_count} paid invoice${inv.paid_count === 1 ? "" : "s"}`}
        />
        <StatCard
          icon={Receipt}
          label="Outstanding"
          value={formatMoney(inv.outstanding_cents)}
          hint={`${inv.outstanding_count} unpaid`}
          accent="warning"
        />
        <StatCard
          icon={FileText}
          label="Total invoices"
          value={String(inv.total)}
          hint={`${inv.void_count} voided`}
          accent="muted"
        />
      </div>

      {/* Subscribers + customers row */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Activity}
          label="Active subscribers"
          value={String(s.active)}
          hint={`${s.trialing} trialing · ${s.past_due} past due`}
          accent="success"
        />
        <StatCard
          icon={TrendingUp}
          label="New subscribers (this month)"
          value={String(s.new_this_month)}
          hint={s.ending_soon > 0 ? `${s.ending_soon} ending soon` : "No cancellations queued"}
        />
        <StatCard
          icon={Users}
          label="Active users"
          value={String(usr.total)}
          hint={`+${usr.new_this_month} this month`}
        />
        <StatCard
          icon={Building2}
          label="Customer orgs"
          value={String(orgs.total)}
          hint={`${orgs.paying} paying · ${orgs.resellers} resellers`}
        />
      </div>

      {/* Plan breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {planEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No plans assigned yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {planEntries.map(([plan, count]) => (
                <Badge key={plan} variant={planBadgeVariant(plan)} className="gap-1">
                  {plan}
                  <span className="opacity-70">· {count}</span>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent invoices</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.recent_invoices.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Stripe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent_invoices.map((iv) => (
                  <TableRow key={iv.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{iv.customer_name || iv.customer_email}</div>
                      <div className="text-xs text-muted-foreground">{iv.customer_email}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{iv.number || "—"}</TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{formatMoney(iv.amount_due_cents, iv.currency)}</div>
                      {iv.amount_paid_cents > 0 && iv.amount_paid_cents !== iv.amount_due_cents && (
                        <div className="text-xs text-emerald-400">
                          paid {formatMoney(iv.amount_paid_cents, iv.currency)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(iv.status)}>{iv.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(iv.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      {iv.hosted_invoice_url ? (
                        <a
                          href={iv.hosted_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent subscribers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent subscribers</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.recent_subscriptions.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No subscriptions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Plan / Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Renews</TableHead>
                  <TableHead>Env</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent_subscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium text-foreground">{sub.email || sub.user_id.slice(0, 8)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{sub.price_id}</TableCell>
                    <TableCell>
                      <Badge variant={subStatusVariant(sub.status)}>{sub.status}</Badge>
                      {sub.cancel_at_period_end && (
                        <Badge variant="outline" className="ml-1 text-[10px]">cancels</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {sub.current_period_end
                        ? formatDistanceToNow(new Date(sub.current_period_end), { addSuffix: true })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{sub.environment}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(sub.created_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------------- Organizations Panel -------------------------- */

function OrganizationsPanel() {
  const [rows, setRows] = useState<AdminOrgRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const handlePlanChange = async (orgId: string, plan: string) => {
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
    toast.success(`Plan set to ${plan}`);
    void load();
  };

  const handleRemovePlan = (orgId: string) => {
    if (!window.confirm("Remove the assigned plan? The organization will be downgraded to Free.")) {
      return;
    }
    void handlePlanChange(orgId, "free");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>All Organizations</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Assign plans, industry templates, and inspect billing for every customer org.
            {rows ? <> Showing {filtered.length} of {rows.length}.</> : null}
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
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
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
                          {org.is_reseller ? (
                            <Badge variant="secondary" className="mt-1 text-[10px]">Reseller</Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-xs">
                          {org.owner_email ? (
                            <span className="font-mono text-muted-foreground">{org.owner_email}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Select
                              value={planValue}
                              onValueChange={(v) => void handlePlanChange(org.id, v)}
                              disabled={savingPlanId === org.id}
                            >
                              <SelectTrigger className="w-36">
                                <SelectValue>
                                  {savingPlanId === org.id ? (
                                    <span className="flex items-center gap-2">
                                      <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                                    </span>
                                  ) : (
                                    <Badge variant={planBadgeVariant(planValue)} className="capitalize">
                                      {planValue}
                                    </Badge>
                                  )}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {PLAN_LABELS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {planValue !== "free" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemovePlan(org.id)}
                                disabled={savingPlanId === org.id}
                              >
                                Remove
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <Badge variant={subStatusVariant(org.subscription_status)} className="w-fit capitalize">
                              {org.subscription_status ?? "no subscription"}
                            </Badge>
                            {org.current_period_end ? (
                              <span className="text-[11px] text-muted-foreground">
                                {org.cancel_at_period_end ? "ends " : "renews "}
                                {formatDistanceToNow(new Date(org.current_period_end), { addSuffix: true })}
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
                                  tpl?.name ?? org.industry_template ?? "General"
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
                        <TableCell className="text-right tabular-nums">{org.member_count}</TableCell>
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
      const { data: res, error: err } = await supabase.rpc("admin_org_billing", { p_org_id: orgId });
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
                  <Badge variant={subStatusVariant(s.status)} className="capitalize">{s.status}</Badge>
                  <span className="font-mono text-[10px] text-muted-foreground">{s.environment}</span>
                </div>
                <div className="mt-1 font-mono text-[11px] text-muted-foreground">{s.price_id ?? "—"}</div>
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
                  <Badge variant={subStatusVariant(inv.status)} className="capitalize">{inv.status}</Badge>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {(inv.amount_paid_cents / 100).toLocaleString(undefined, { style: "currency", currency: inv.currency.toUpperCase() })}
                    {" / "}
                    {(inv.amount_due_cents / 100).toLocaleString(undefined, { style: "currency", currency: inv.currency.toUpperCase() })}
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

/* ------------------------------ Users Panel ------------------------------ */

function UsersPanel() {
  const [rows, setRows] = useState<AdminProfileRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    // Platform-admin RLS lets us read all profiles + the parent org name.
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, full_name, organization_id, created_at, organizations(name)")
      .order("created_at", { ascending: false })
      .limit(500);
    setLoading(false);
    if (error) {
      toast.error(error.message ?? "Failed to load users");
      return;
    }
    const mapped: AdminProfileRow[] = (data ?? []).map((r: any) => ({
      user_id: r.user_id,
      full_name: r.full_name,
      organization_id: r.organization_id,
      organization_name: r.organizations?.name ?? "—",
      created_at: r.created_at,
    }));
    setRows(mapped);
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
        (r.full_name ?? "").toLowerCase().includes(q) ||
        r.organization_name.toLowerCase().includes(q),
    );
  }, [rows, search]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>All Users</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Latest 500 profiles across every organization.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users…"
            className="w-56"
          />
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !rows ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell>{u.full_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{u.organization_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ----------------------- Contact Submissions Panel ----------------------- */

function ContactSubmissionsPanel() {
  const [rows, setRows] = useState<AdminSubmissionRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contact_submissions")
      .select(
        "id, name, email, company, phone, project_type, budget, message, status, origin, test_mode, sentiment, topic, intent_summary, priority_suggestion, metadata, created_at, replied_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    setLoading(false);
    if (error) {
      toast.error(error.message ?? "Failed to load submissions");
      return;
    }
    setRows((data ?? []) as AdminSubmissionRow[]);
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
        r.email.toLowerCase().includes(q) ||
        (r.company ?? "").toLowerCase().includes(q) ||
        (r.project_type ?? "").toLowerCase().includes(q) ||
        r.message.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const toggleRow = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setStatus = async (id: string, status: string) => {
    setSavingId(id);
    const patch: { status: string; replied_at?: string } = { status };
    if (status === "replied") patch.replied_at = new Date().toISOString();
    const { error } = await supabase.from("contact_submissions").update(patch).eq("id", id);
    setSavingId(null);
    if (error) {
      toast.error(error.message ?? "Failed to update");
      return;
    }
    toast.success(`Marked ${status}`);
    setRows((prev) =>
      prev
        ? prev.map((r) =>
            r.id === id
              ? { ...r, status, replied_at: status === "replied" ? new Date().toISOString() : r.replied_at }
              : r,
          )
        : prev,
    );
  };

  // Mailto invoice flow stayed handy for non-Stripe customers.
  const buildInvoiceMailto = (s: AdminSubmissionRow) => {
    const subject = `Genesis — Invoice for your ${s.project_type ?? "project"}`;
    const body = [
      `Hi ${s.name.split(" ")[0] || s.name},`,
      "",
      `Thanks for reaching out about your ${s.project_type ?? "project"}${s.company ? ` at ${s.company}` : ""}.`,
      s.budget ? `Based on the ${s.budget} budget you shared, here is your invoice:` : "Here is your invoice:",
      "",
      "Amount: $______",
      "Payment link: ______",
      "",
      "Reply to this email with any questions.",
      "",
      "— Ethan, Genesis",
    ].join("\n");
    return `mailto:${s.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Contact Submissions</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Latest 200 inquiries. Click a row to see the full message, AI classification, and send an invoice.
            {rows ? <> Showing {filtered.length} of {rows.length}.</> : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search submissions…"
              className="w-56 pl-8"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !rows ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No submissions match.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const isOpen = expanded.has(s.id);
                  return (
                    <Fragment key={s.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => toggleRow(s.id)}
                      >
                        <TableCell>
                          <div className="font-medium text-foreground">{s.name}</div>
                          <div className="font-mono text-xs text-muted-foreground">{s.email}</div>
                          {s.test_mode ? (
                            <Badge variant="outline" className="mt-1 text-[10px]">test</Badge>
                          ) : null}
                        </TableCell>
                        <TableCell>{s.company ?? "—"}</TableCell>
                        <TableCell>
                          {s.project_type ? <Badge variant="outline">{s.project_type}</Badge> : "—"}
                        </TableCell>
                        <TableCell>{s.budget ?? "—"}</TableCell>
                        <TableCell>
                          {s.priority_suggestion ? (
                            <Badge
                              variant={
                                s.priority_suggestion === "critical" || s.priority_suggestion === "high"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {s.priority_suggestion}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={s.status === "replied" ? "default" : "secondary"}>{s.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                      {isOpen ? (
                        <TableRow key={`${s.id}-detail`} className="bg-muted/20">
                          <TableCell colSpan={7} className="p-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <div className="text-xs font-semibold uppercase text-muted-foreground">Contact</div>
                                <div className="text-sm">
                                  <div><span className="text-muted-foreground">Email:</span> <a href={`mailto:${s.email}`} className="text-primary hover:underline">{s.email}</a></div>
                                  {s.phone ? (
                                    <div><span className="text-muted-foreground">Phone:</span> <a href={`tel:${s.phone}`} className="text-primary hover:underline">{s.phone}</a></div>
                                  ) : null}
                                  {s.company ? <div><span className="text-muted-foreground">Company:</span> {s.company}</div> : null}
                                  {s.origin ? <div><span className="text-muted-foreground">Origin:</span> <span className="font-mono text-xs">{s.origin}</span></div> : null}
                                </div>
                                <div className="text-xs font-semibold uppercase text-muted-foreground pt-2">Message</div>
                                <div className="whitespace-pre-wrap rounded border border-border bg-background p-3 text-sm">
                                  {s.message}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="text-xs font-semibold uppercase text-muted-foreground">AI Classification</div>
                                <div className="text-sm space-y-1">
                                  <div><span className="text-muted-foreground">Topic:</span> {s.topic ?? "—"}</div>
                                  <div><span className="text-muted-foreground">Sentiment:</span> {s.sentiment ?? "—"}</div>
                                  <div><span className="text-muted-foreground">Priority:</span> {s.priority_suggestion ?? "—"}</div>
                                  {s.intent_summary ? (
                                    <div className="pt-1">
                                      <div className="text-muted-foreground">Intent:</div>
                                      <div className="rounded border border-border bg-background p-2 text-xs">{s.intent_summary}</div>
                                    </div>
                                  ) : null}
                                </div>
                                {s.metadata && Object.keys(s.metadata).length > 0 ? (
                                  <>
                                    <div className="text-xs font-semibold uppercase text-muted-foreground pt-2">Metadata</div>
                                    <pre className="overflow-x-auto rounded border border-border bg-background p-2 text-[11px] leading-relaxed">
{JSON.stringify(s.metadata, null, 2)}
                                    </pre>
                                  </>
                                ) : null}
                                <div className="flex flex-wrap gap-2 pt-3">
                                  <Button asChild size="sm" variant="outline">
                                    <a href={`mailto:${s.email}`}>Reply</a>
                                  </Button>
                                  <Button asChild size="sm" variant="ghost">
                                    <a href={buildInvoiceMailto(s)}>Email Invoice (manual)</a>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={savingId === s.id || s.status === "replied"}
                                    onClick={() => void setStatus(s.id, "replied")}
                                  >
                                    Mark Replied
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={savingId === s.id || s.status === "archived"}
                                    onClick={() => void setStatus(s.id, "archived")}
                                  >
                                    Archive
                                  </Button>
                                </div>
                                {s.replied_at ? (
                                  <div className="text-xs text-muted-foreground pt-1">
                                    Replied {formatDistanceToNow(new Date(s.replied_at), { addSuffix: true })}
                                  </div>
                                ) : null}
                                <SubmissionPaymentHistory submission={s} />
                                <SubmissionInvoicePanel submission={s} />
                              </div>
                            </div>
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

/* --------------------- Stripe Invoice for a Submission ------------------- */

interface PlatformInvoiceRow {
  id: string;
  stripe_invoice_id: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  number: string | null;
  amount_due_cents: number;
  amount_paid_cents: number;
  currency: string;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  voided_at: string | null;
  sent_at: string | null;
  environment: string;
  created_at: string;
}

const stripeEnv: "sandbox" | "live" =
  (import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined)?.startsWith("pk_live_")
    ? "live"
    : "sandbox";

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "paid") return "default";
  if (status === "void" || status === "uncollectible") return "destructive";
  if (status === "open" || status === "sent" || status === "finalized") return "secondary";
  return "outline";
}

interface PaymentHistoryResult {
  email: string | null;
  stripe_customer_ids: string[] | null;
  invoices: Array<{
    id: string;
    submission_id: string | null;
    customer_email: string;
    stripe_customer_id: string | null;
    stripe_invoice_id: string | null;
    hosted_invoice_url: string | null;
    invoice_pdf: string | null;
    number: string | null;
    description: string | null;
    amount_due_cents: number;
    amount_paid_cents: number;
    currency: string;
    status: string;
    created_at: string;
    paid_at: string | null;
    environment: string;
  }>;
  totals: {
    invoices?: number;
    paid_count?: number;
    paid_cents?: number;
    outstanding_cents?: number;
  };
}

function SubmissionPaymentHistory({ submission }: { submission: AdminSubmissionRow }) {
  const [data, setData] = useState<PaymentHistoryResult | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: res, error } = await supabase.rpc("admin_submission_payment_history", {
      p_submission_id: submission.id,
    });
    if (error) toast.error("Could not load payment history", { description: error.message });
    else setData(res as unknown as PaymentHistoryResult);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission.id]);

  const fmt = (c: number, cur = "usd") => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: cur.toUpperCase(),
      }).format((c || 0) / 100);
    } catch {
      return `$${((c || 0) / 100).toFixed(2)}`;
    }
  };

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 mt-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <CreditCard className="h-4 w-4 text-primary" />
          Payment history
          {data?.stripe_customer_ids && data.stripe_customer_ids.length > 0 && (
            <Badge variant="outline" className="text-[10px]">
              linked Stripe customer
            </Badge>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="h-7 gap-1">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </Button>
      </div>

      {data && data.invoices.length > 0 && (
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="rounded bg-background/50 px-2 py-1">
            <div className="text-muted-foreground">Invoices</div>
            <div className="font-semibold text-foreground">{data.totals.invoices ?? 0}</div>
          </div>
          <div className="rounded bg-background/50 px-2 py-1">
            <div className="text-muted-foreground">Paid</div>
            <div className="font-semibold text-emerald-400">{fmt(data.totals.paid_cents ?? 0)}</div>
          </div>
          <div className="rounded bg-background/50 px-2 py-1">
            <div className="text-muted-foreground">Outstanding</div>
            <div className="font-semibold text-amber-400">{fmt(data.totals.outstanding_cents ?? 0)}</div>
          </div>
          <div className="rounded bg-background/50 px-2 py-1">
            <div className="text-muted-foreground">Stripe customers</div>
            <div className="font-mono text-[10px] text-foreground truncate">
              {data.stripe_customer_ids?.[0] || "—"}
            </div>
          </div>
        </div>
      )}

      {data && data.invoices.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          No prior invoices for {data.email || submission.email}. The next invoice will create a
          Stripe customer that future submissions from this email will reuse.
        </p>
      ) : data ? (
        <Table className="mt-2">
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Env</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Open</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.invoices.map((iv) => (
              <TableRow key={iv.id}>
                <TableCell className="text-xs">
                  <div className="text-foreground">{iv.number || iv.stripe_invoice_id || iv.id.slice(0, 8)}</div>
                  {iv.description && (
                    <div className="text-muted-foreground line-clamp-1">{iv.description}</div>
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  <div className="text-foreground">{fmt(iv.amount_due_cents, iv.currency)}</div>
                  {iv.amount_paid_cents > 0 && (
                    <div className="text-emerald-400">paid {fmt(iv.amount_paid_cents, iv.currency)}</div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(iv.status)}>{iv.status}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">{iv.environment}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(iv.created_at), { addSuffix: true })}
                </TableCell>
                <TableCell className="text-right">
                  {iv.hosted_invoice_url ? (
                    <a
                      href={iv.hosted_invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  );
}

function SubmissionInvoicePanel({ submission }: { submission: AdminSubmissionRow }) {
  const [invoices, setInvoices] = useState<PlatformInvoiceRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const runInvoiceAction = async (
    inv: PlatformInvoiceRow,
    action: "void" | "refund" | "resend",
  ) => {
    let amountCents: number | undefined;
    if (action === "void") {
      if (!window.confirm(`Void invoice ${inv.number ?? inv.stripe_invoice_id}? The customer will no longer be able to pay it.`)) {
        return;
      }
    } else if (action === "resend") {
      if (!window.confirm(`Resend invoice ${inv.number ?? inv.stripe_invoice_id} email to the prospect via Stripe?`)) {
        return;
      }
    } else {
      const fullDollars = (inv.amount_paid_cents / 100).toFixed(2);
      const input = window.prompt(
        `Refund amount in ${inv.currency.toUpperCase()} (max $${fullDollars}). Leave blank for full refund.`,
        fullDollars,
      );
      if (input === null) return;
      const trimmed = input.trim();
      if (trimmed.length > 0) {
        const parsed = Number.parseFloat(trimmed);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          toast.error("Invalid refund amount");
          return;
        }
        amountCents = Math.round(parsed * 100);
      }
    }

    setActingId(inv.id);
    const { data, error } = await supabase.functions.invoke("admin-invoice-action", {
      body: { invoiceId: inv.id, action, amountCents },
    });
    setActingId(null);

    if (error || (data as { error?: string } | null)?.error) {
      const msg =
        (data as { error?: string } | null)?.error ||
        error?.message ||
        "Action failed";
      toast.error(msg);
      return;
    }
    toast.success(
      action === "void"
        ? "Invoice voided"
        : action === "resend"
          ? "Invoice email resent"
          : "Refund issued",
    );
    void load();
  };

  // Plan-driven invoice. When a plan is picked, description/amount/line items
  // come from the catalog so the invoice cannot drift from what we'll assign.
  // "custom" lets the admin enter a one-off price (legacy behavior).
  // Initial value is auto-suggested from the submission's budget / metadata
  // so the panel opens pre-filled with the most likely tier.
  const suggestion = useMemo(() => suggestPlanForSubmission(submission), [submission]);
  const [planValue, setPlanValue] = useState<string>(suggestion?.plan.value ?? "custom");
  const selectedPlan: PlanCatalogEntry | null = useMemo(
    () => (planValue === "custom" ? null : getPlan(planValue)),
    [planValue],
  );

  const [amount, setAmount] = useState<string>(() => suggestAmount(submission));
  const [description, setDescription] = useState<string>(
    `Genesis — ${submission.project_type ?? "project"}${submission.company ? ` for ${submission.company}` : ""}`,
  );
  const [dueDays, setDueDays] = useState<string>("14");

  // Tracks whether the admin has manually edited the amount. Once they have,
  // we stop overwriting it when they switch plans — the override sticks.
  const [amountOverridden, setAmountOverridden] = useState(false);

  // When ON, we also call admin_set_org_plan_by_email after the invoice is
  // created so the assignment lands in the customer's org. Defaults ON for
  // any plan that's actually invoiceable.
  const [assignPlan, setAssignPlan] = useState(true);
  const [assigningPlan, setAssigningPlan] = useState(false);

  // Sync the form fields whenever the plan picker changes so the admin
  // sees what will actually be billed before pressing Send. Skip the amount
  // sync once the admin has overridden it manually.
  useEffect(() => {
    if (!selectedPlan) return;
    if (!amountOverridden) {
      setAmount((planTotalCents(selectedPlan) / 100).toFixed(2));
    }
    setDescription(
      `${selectedPlan.label} plan — ${submission.company ?? submission.name}`,
    );
  }, [selectedPlan, submission.company, submission.name, amountOverridden]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("platform_invoices")
      .select(
        "id, stripe_invoice_id, hosted_invoice_url, invoice_pdf, number, amount_due_cents, amount_paid_cents, currency, status, due_date, paid_at, voided_at, sent_at, environment, created_at",
      )
      .eq("submission_id", submission.id)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error(error.message ?? "Failed to load invoices");
      return;
    }
    setInvoices((data ?? []) as PlatformInvoiceRow[]);
  };

  useEffect(() => {
    void load();
    // Realtime: refresh when this submission's invoice rows change.
    const channel = supabase
      .channel(`platform_invoices:${submission.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_invoices", filter: `submission_id=eq.${submission.id}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission.id]);

  // Shared helper — assign or remove the plan on whatever org owns this
  // submission's email. Used both from the "Assign plan" toggle in the
  // invoice form and the standalone Reassign / Remove controls below.
  const setPlanForCustomer = async (plan: string): Promise<boolean> => {
    setAssigningPlan(true);
    const { data, error } = await supabase.rpc("admin_set_org_plan_by_email", {
      p_email: submission.email,
      p_plan: plan,
    });
    setAssigningPlan(false);
    if (error) {
      toast.error(error.message ?? "Failed to update plan");
      return false;
    }
    if (!data) {
      toast.message("No customer account found for this email yet — invoice still sent.");
      return false;
    }
    return true;
  };

  const handleCreate = async () => {
    let lineItems: { description: string; amount_cents: number; quantity?: number }[];
    if (selectedPlan) {
      // If the admin manually overrode the amount, ignore the plan's preset
      // line items and bill exactly what they typed (single line item).
      if (amountOverridden) {
        const dollars = parseFloat(amount);
        if (!isFinite(dollars) || dollars < 0.5) {
          toast.error("Enter an amount of at least $0.50");
          return;
        }
        lineItems = [{
          description: description || `${selectedPlan.label} plan (custom amount)`,
          amount_cents: Math.round(dollars * 100),
          quantity: 1,
        }];
      } else {
        lineItems = planLineItems(selectedPlan);
        if (lineItems.length === 0) {
          toast.error("This plan has no billable amount.");
          return;
        }
      }
    } else {
      const dollars = parseFloat(amount);
      if (!isFinite(dollars) || dollars < 0.5) {
        toast.error("Enter an amount of at least $0.50");
        return;
      }
      lineItems = [{ description, amount_cents: Math.round(dollars * 100), quantity: 1 }];
    }

    setCreating(true);
    const { data, error } = await supabase.functions.invoke("create-submission-invoice", {
      body: {
        submissionId: submission.id,
        description,
        dueDays: parseInt(dueDays, 10) || 14,
        environment: stripeEnv,
        send: true,
        lineItems,
        ...(selectedPlan && assignPlan && selectedPlan.invoiceable
          ? { grantPlan: selectedPlan.value }
          : {}),
      },
    });
    setCreating(false);
    if (error || (data as { error?: string })?.error) {
      toast.error((data as { error?: string })?.error ?? error?.message ?? "Failed to create invoice");
      return;
    }
    toast.success("Invoice created and sent");

    // Optionally assign the plan to the customer's org. Best-effort — if the
    // user hasn't signed up yet, the helper returns null and we just notify.
    if (selectedPlan && assignPlan && selectedPlan.invoiceable) {
      const ok = await setPlanForCustomer(selectedPlan.value);
      if (ok) toast.success(`Assigned ${selectedPlan.label} plan to ${submission.email}`);
    }

    setShowForm(false);
    void load();
  };

  return (
    <div className="space-y-2 pt-3 border-t border-border mt-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase text-muted-foreground">
          Stripe Invoice {stripeEnv === "sandbox" ? <Badge variant="outline" className="ml-2 text-[10px]">test mode</Badge> : null}
        </div>
        <div className="flex gap-2">
          <Select
            disabled={assigningPlan}
            onValueChange={(v) => {
              if (v === "__remove__") void setPlanForCustomer("free").then((ok) => ok && toast.success("Plan removed (set to Free)"));
              else void setPlanForCustomer(v).then((ok) => ok && toast.success(`Assigned ${getPlan(v)?.label ?? v}`));
            }}
          >
            <SelectTrigger className="h-8 w-[170px] text-xs">
              <SelectValue placeholder={assigningPlan ? "Updating…" : "Assign / remove plan"} />
            </SelectTrigger>
            <SelectContent>
              {PLAN_CATALOG.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
              <SelectItem value="__remove__">Remove plan (Free)</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : invoices && invoices.length > 0 ? "+ New Invoice" : "Create Invoice"}
          </Button>
        </div>
      </div>

      {showForm ? (
        <div className="space-y-2 rounded border border-border bg-background p-3">
          {suggestion ? (
            <div className="space-y-2 rounded bg-primary/10 px-3 py-2 text-xs text-foreground">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={planBadgeVariant(suggestion.plan.value)} className="capitalize">
                  Suggested: {suggestion.plan.label}
                </Badge>
                <span className="text-muted-foreground">
                  ${(planTotalCents(suggestion.plan) / 100).toFixed(0)} · {suggestion.reason}
                </span>
                {planValue !== suggestion.plan.value ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-6 px-2 text-xs"
                    onClick={() => {
                      setPlanValue(suggestion.plan.value);
                      setAmountOverridden(false);
                    }}
                  >
                    Apply suggestion
                  </Button>
                ) : (
                  <span className="ml-auto text-[11px] text-muted-foreground">Applied</span>
                )}
              </div>
              <SuggestionSignals submission={submission} source={suggestion.source} />
            </div>
          ) : (
            <div className="space-y-2 rounded border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">No plan suggestion</p>
              <SuggestionSignals submission={submission} source={null} />
              <p className="text-[11px]">
                None of <code className="rounded bg-muted px-1">interested_plan</code>,{" "}
                <code className="rounded bg-muted px-1">budget</code>, or{" "}
                <code className="rounded bg-muted px-1">project_type</code> matched a known plan tier.
              </p>
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-[180px_1fr_120px_100px]">
            <Select value={planValue} onValueChange={(v) => { setPlanValue(v); setAmountOverridden(false); }}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Use plan…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom amount</SelectItem>
                {PLAN_CATALOG.filter((p) => p.invoiceable).map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label} — ${(planTotalCents(p) / 100).toFixed(0)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
            />
            <Input
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setAmountOverridden(true); }}
              placeholder="Amount USD"
              inputMode="decimal"
              title={selectedPlan ? "Editing this overrides the plan's default amount" : undefined}
            />
            <Input
              value={dueDays}
              onChange={(e) => setDueDays(e.target.value)}
              placeholder="Due days"
              inputMode="numeric"
            />
          </div>

          {selectedPlan ? (
            <div className="rounded bg-muted/40 p-2 text-xs space-y-1">
              <div className="font-medium">{selectedPlan.label} — {selectedPlan.tagline}</div>
              {planLineItems(selectedPlan).map((li, i) => (
                <div key={i} className="flex justify-between text-muted-foreground">
                  <span>{li.description}</span>
                  <span className="tabular-nums">${(li.amount_cents / 100).toFixed(2)}</span>
                </div>
              ))}
              <label className="flex items-center gap-2 pt-1 text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={assignPlan}
                  onChange={(e) => setAssignPlan(e.target.checked)}
                  className="accent-primary"
                />
                Also assign this plan to {submission.email} after invoice is sent
              </label>
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button onClick={() => void handleCreate()} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send invoice"}
            </Button>
          </div>
        </div>
      ) : null}

      {loading && !invoices ? (
        <div className="text-xs text-muted-foreground">Loading invoices…</div>
      ) : !invoices || invoices.length === 0 ? (
        <div className="text-xs text-muted-foreground">No invoices yet.</div>
      ) : (
        <div className="space-y-1.5">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-wrap items-center gap-2 rounded border border-border bg-background p-2 text-sm"
            >
              <Badge variant={statusVariant(inv.status)}>{inv.status}</Badge>
              <span className="font-mono text-xs text-muted-foreground">{inv.number ?? inv.stripe_invoice_id}</span>
              <span className="tabular-nums">
                ${(inv.amount_due_cents / 100).toFixed(2)} {inv.currency.toUpperCase()}
              </span>
              {inv.amount_paid_cents > 0 ? (
                <span className="text-xs text-muted-foreground">
                  paid ${(inv.amount_paid_cents / 100).toFixed(2)}
                </span>
              ) : null}
              {inv.environment === "sandbox" ? (
                <Badge variant="outline" className="text-[10px]">test</Badge>
              ) : null}
              <span className="ml-auto flex gap-2">
                {inv.hosted_invoice_url ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer">
                      Payment link
                    </a>
                  </Button>
                ) : null}
                {inv.invoice_pdf ? (
                  <Button asChild size="sm" variant="outline" title="Download invoice PDF">
                    <a
                      href={inv.invoice_pdf}
                      download={`invoice-${inv.number ?? inv.stripe_invoice_id ?? inv.id}.pdf`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Download className="h-3 w-3" />
                      PDF
                    </a>
                  </Button>
                ) : null}
                {inv.status !== "void" && inv.status !== "paid" && inv.status !== "refunded" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={actingId === inv.id}
                    onClick={() => void runInvoiceAction(inv, "resend")}
                    title="Resend the Stripe-hosted invoice email to the prospect"
                  >
                    {actingId === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Resend email"}
                  </Button>
                ) : null}
                {inv.status !== "void" && inv.status !== "paid" && inv.status !== "refunded" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={actingId === inv.id}
                    onClick={() => void runInvoiceAction(inv, "void")}
                  >
                    {actingId === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Void"}
                  </Button>
                ) : null}
                {inv.amount_paid_cents > 0 && inv.status !== "refunded" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-amber-400 hover:text-amber-300"
                    disabled={actingId === inv.id}
                    onClick={() => void runInvoiceAction(inv, "refund")}
                  >
                    {actingId === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refund"}
                  </Button>
                ) : null}
              </span>
              <div className="w-full text-[11px] text-muted-foreground">
                Created {formatDistanceToNow(new Date(inv.created_at), { addSuffix: true })}
                {inv.paid_at ? <> · paid {formatDistanceToNow(new Date(inv.paid_at), { addSuffix: true })}</> : null}
                {inv.due_date && !inv.paid_at ? <> · due {new Date(inv.due_date).toLocaleDateString()}</> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Renders which submission metadata fields the suggestion engine considered,
 * highlighting the one that drove the chosen plan (when there is a match).
 */
function SuggestionSignals({
  submission,
  source,
}: {
  submission: AdminSubmissionRow;
  source: "interested_plan" | "budget" | "project_type" | null;
}) {
  const interestedPlan =
    (typeof submission.metadata?.["interested_plan"] === "string"
      ? (submission.metadata["interested_plan"] as string)
      : typeof submission.metadata?.["plan"] === "string"
        ? (submission.metadata["plan"] as string)
        : null) ?? null;

  const fields: Array<{
    key: "interested_plan" | "budget" | "project_type";
    label: string;
    value: string | null;
  }> = [
    { key: "interested_plan", label: "interested_plan", value: interestedPlan },
    { key: "budget", label: "budget", value: submission.budget ?? null },
    { key: "project_type", label: "project_type", value: submission.project_type ?? null },
  ];

  return (
    <div className="flex flex-wrap gap-1.5">
      {fields.map((f) => {
        const matched = source === f.key;
        const empty = !f.value;
        return (
          <span
            key={f.key}
            className={
              matched
                ? "inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/15 px-2 py-0.5 text-[11px] text-foreground"
                : empty
                  ? "inline-flex items-center gap-1 rounded border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground/70"
                  : "inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
            }
            title={matched ? "This field drove the suggestion" : empty ? "Not provided" : "Considered, no match"}
          >
            <code className="font-mono text-[10px]">{f.label}</code>
            <span className="text-foreground/80">{empty ? "—" : f.value}</span>
            {matched ? <span className="text-primary">✓ used</span> : null}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Heuristic: pick the most appropriate plan from PLAN_CATALOG for a given
 * submission, based on (in priority order):
 *   1. an explicit `interested_plan` / `plan` hint stored in metadata (from
 *      pricing-page CTAs that pre-select a tier)
 *   2. the prospect's selected budget range
 *   3. a soft signal from project_type (enterprise-style projects → pro)
 * Returns the plan catalog entry the admin should default to, plus a short
 * human-readable reason. Returns null when no signal is strong enough — the
 * panel falls back to the legacy "custom" amount in that case.
 */
function suggestPlanForSubmission(
  s: AdminSubmissionRow,
): { plan: PlanCatalogEntry; reason: string; source: "interested_plan" | "budget" | "project_type" } | null {
  const metaPlan =
    typeof s.metadata?.["interested_plan"] === "string"
      ? (s.metadata["interested_plan"] as string)
      : typeof s.metadata?.["plan"] === "string"
        ? (s.metadata["plan"] as string)
        : null;
  if (metaPlan) {
    const normalized = metaPlan.toLowerCase().replace(/[\s-]+/g, "_");
    const isFullOwnership =
      normalized.includes("full_ownership") ||
      normalized === "ownership_full" ||
      normalized === "full";
    const key = isFullOwnership ? "full_ownership" : normalized;
    const p = getPlan(key);
    if (p && p.invoiceable) return { plan: p, reason: "Prospect picked this plan on the site", source: "interested_plan" };
  }

  const b = (s.budget ?? "").toLowerCase();
  const matchByBudget = (): PlanCatalogEntry | null => {
    if (!b) return null;
    if (b.includes("enterprise") || b.includes("100k") || b.includes("50k")) {
      return getPlan("enterprise");
    }
    if (b.includes("7k") || b.includes("7,000") || b.includes("full ownership")) {
      return getPlan("full_ownership");
    }
    if (b.includes("14") || b.includes("10k") || b.includes("10,000") || b.includes("20k")) {
      return getPlan("pro");
    }
    if (b.includes("5k") || b.includes("5,000") || b.includes("3k") || b.includes("2.5k") || b.includes("2500")) {
      return getPlan("growth");
    }
    if (b.includes("1k") || b.includes("1,000") || b.includes("500")) {
      return getPlan("starter");
    }
    return null;
  };

  const fromBudget = matchByBudget();
  if (fromBudget && fromBudget.invoiceable) {
    return { plan: fromBudget, reason: `Matched budget "${s.budget}"`, source: "budget" };
  }

  const pt = (s.project_type ?? "").toLowerCase();
  if (pt.includes("full ownership") || pt.includes("full_ownership") || pt.includes("source code") || pt.includes("buyout")) {
    const p = getPlan("full_ownership");
    if (p) return { plan: p, reason: `Project type "${s.project_type}" suggests Full Ownership`, source: "project_type" };
  }
  if (pt.includes("enterprise") || pt.includes("white") || pt.includes("custom")) {
    const p = getPlan("enterprise");
    if (p) return { plan: p, reason: `Project type "${s.project_type}" suggests enterprise`, source: "project_type" };
  }
  if (pt.includes("crm") || pt.includes("sales")) {
    const p = getPlan("growth");
    if (p) return { plan: p, reason: `Project type "${s.project_type}" suggests growth`, source: "project_type" };
  }

  return null;
}

// Best-effort default amount based on the budget label the prospect picked.
// Used as a fallback when no plan can be matched.
function suggestAmount(s: AdminSubmissionRow): string {
  const suggested = suggestPlanForSubmission(s);
  if (suggested) return (planTotalCents(suggested.plan) / 100).toFixed(2);
  const b = (s.budget ?? "").toLowerCase();
  if (b.includes("14")) return "14000";
  if (b.includes("10k") || b.includes("10,000")) return "10000";
  if (b.includes("5k") || b.includes("5,000")) return "5000";
  if (b.includes("2.5k") || b.includes("2500")) return "2500";
  if (b.includes("1k") || b.includes("1,000")) return "1000";
  return "";
}

/* --------------------------- Template Audit Panel ------------------------ */

interface TemplateAuditRow {
  id: string;
  organization_id: string | null;
  organization_name: string | null;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_is_platform_admin: boolean;
  old_template: string | null;
  new_template: string | null;
  action: "changed" | "denied";
  reason: string | null;
  source: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function TemplateAuditPanel() {
  const [rows, setRows] = useState<TemplateAuditRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "changed" | "denied">("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_template_audit", { p_limit: 200 });
    setLoading(false);
    if (error) {
      toast.error(error.message ?? "Failed to load audit log");
      return;
    }
    setRows(((data ?? []) as unknown) as TemplateAuditRow[]);
  };

  useEffect(() => {
    void load();
    // Realtime — any new audit row pops in for live security monitoring.
    const channel = supabase
      .channel("template_assignment_audit_log:all")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "template_assignment_audit_log" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.action !== filter) return false;
      if (!q) return true;
      return (
        (r.organization_name ?? "").toLowerCase().includes(q) ||
        (r.actor_email ?? "").toLowerCase().includes(q) ||
        (r.old_template ?? "").toLowerCase().includes(q) ||
        (r.new_template ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, filter, search]);

  const counts = useMemo(() => {
    if (!rows) return { changed: 0, denied: 0 };
    return rows.reduce(
      (acc, r) => {
        if (r.action === "changed") acc.changed += 1;
        else if (r.action === "denied") acc.denied += 1;
        return acc;
      },
      { changed: 0, denied: 0 },
    );
  }, [rows]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" /> Template Assignment Audit
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Every successful template change and every denied attempt across all organizations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="default">{counts.changed} changed</Badge>
            <Badge variant="destructive">{counts.denied} denied</Badge>
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter by org, actor email, or template…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="changed">Changed only</SelectItem>
              <SelectItem value="denied">Denied only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading && !rows ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading audit log…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No audit entries match your filters.
          </div>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">When</TableHead>
                  <TableHead className="w-[110px]">Action</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Template change</TableHead>
                  <TableHead className="w-[140px]">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} className={r.action === "denied" ? "bg-destructive/5" : undefined}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.action === "denied" ? "destructive" : "default"}>
                        {r.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">{r.organization_name ?? "—"}</div>
                      {r.organization_id ? (
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {r.organization_id.slice(0, 8)}…
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{r.actor_email ?? <span className="text-muted-foreground">unknown</span>}</div>
                      {r.actor_is_platform_admin ? (
                        <Badge variant="outline" className="text-[10px] mt-0.5">
                          <Crown className="h-2.5 w-2.5 mr-1" /> platform admin
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="font-mono text-xs">{r.old_template ?? "—"}</span>
                      <span className="mx-2 text-muted-foreground">→</span>
                      <span className="font-mono text-xs font-semibold">{r.new_template ?? "—"}</span>
                      {r.reason ? (
                        <div className="text-[11px] text-destructive mt-0.5">{r.reason}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.source ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
