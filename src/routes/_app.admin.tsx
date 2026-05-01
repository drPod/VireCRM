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
import { Crown, Loader2, ShieldAlert, RefreshCw, Search, Building2, Users, Inbox, FileText, ChevronRight, ChevronDown, CreditCard, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { INDUSTRY_TEMPLATES, type IndustryKey } from "@/lib/industry-templates";
import { PlatformAdminPanel } from "@/components/crm/PlatformAdminPanel";

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

const PLAN_LABELS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "free", label: "Free" },
  { value: "starter", label: "Starter" },
  { value: "growth", label: "Growth" },
  { value: "pro", label: "Pro" },
  { value: "enterprise", label: "Enterprise" },
  { value: "ownership", label: "Ownership (host)" },
];

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

      <Tabs defaultValue="orgs" className="w-full">
        <TabsList>
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
        </TabsList>

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
      </Tabs>
    </div>
  );
}

/* -------------------------- Organizations Panel -------------------------- */

function OrganizationsPanel() {
  const [rows, setRows] = useState<AdminOrgRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

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
        (r.industry_template ?? "").toLowerCase().includes(q),
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>All Organizations</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Assign industry templates and inspect every customer org.
            {rows ? <> Showing {filtered.length} of {rows.length}.</> : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search orgs…"
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
          <p className="py-6 text-center text-sm text-muted-foreground">No organizations match.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Org</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((org) => {
                  const tpl = org.industry_template
                    ? INDUSTRY_TEMPLATES[org.industry_template as IndustryKey]
                    : undefined;
                  return (
                    <TableRow key={org.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">{org.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{org.slug}</div>
                        {org.is_reseller ? (
                          <Badge variant="secondary" className="mt-1 text-[10px]">Reseller</Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{org.plan ?? "—"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={org.industry_template ?? "general"}
                          onValueChange={(v) => void handleIndustryChange(org.id, v)}
                          disabled={savingId === org.id}
                        >
                          <SelectTrigger className="w-44">
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
                      <TableCell className="text-right tabular-nums">{org.lead_count}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(org.created_at), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
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

function SubmissionInvoicePanel({ submission }: { submission: AdminSubmissionRow }) {
  const [invoices, setInvoices] = useState<PlatformInvoiceRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState<string>(() => suggestAmount(submission));
  const [description, setDescription] = useState<string>(
    `Genesis — ${submission.project_type ?? "project"}${submission.company ? ` for ${submission.company}` : ""}`,
  );
  const [dueDays, setDueDays] = useState<string>("14");

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

  const handleCreate = async () => {
    const dollars = parseFloat(amount);
    if (!isFinite(dollars) || dollars < 0.5) {
      toast.error("Enter an amount of at least $0.50");
      return;
    }
    const cents = Math.round(dollars * 100);
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("create-submission-invoice", {
      body: {
        submissionId: submission.id,
        description,
        dueDays: parseInt(dueDays, 10) || 14,
        environment: stripeEnv,
        send: true,
        lineItems: [{ description, amount_cents: cents, quantity: 1 }],
      },
    });
    setCreating(false);
    if (error || (data as { error?: string })?.error) {
      toast.error((data as { error?: string })?.error ?? error?.message ?? "Failed to create invoice");
      return;
    }
    toast.success("Invoice created and sent");
    setShowForm(false);
    void load();
  };

  return (
    <div className="space-y-2 pt-3 border-t border-border mt-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase text-muted-foreground">
          Stripe Invoice {stripeEnv === "sandbox" ? <Badge variant="outline" className="ml-2 text-[10px]">test mode</Badge> : null}
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : invoices && invoices.length > 0 ? "+ New Invoice" : "Create Invoice"}
        </Button>
      </div>

      {showForm ? (
        <div className="grid gap-2 rounded border border-border bg-background p-3 sm:grid-cols-[1fr_120px_100px_auto]">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
          />
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount USD"
            inputMode="decimal"
          />
          <Input
            value={dueDays}
            onChange={(e) => setDueDays(e.target.value)}
            placeholder="Due days"
            inputMode="numeric"
          />
          <Button onClick={() => void handleCreate()} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
          </Button>
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
                  <Button asChild size="sm" variant="ghost">
                    <a href={inv.invoice_pdf} target="_blank" rel="noreferrer">
                      PDF
                    </a>
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

// Best-effort default amount based on the budget label the prospect picked.
function suggestAmount(s: AdminSubmissionRow): string {
  const b = (s.budget ?? "").toLowerCase();
  if (b.includes("14")) return "14000";
  if (b.includes("10k") || b.includes("10,000")) return "10000";
  if (b.includes("5k") || b.includes("5,000")) return "5000";
  if (b.includes("2.5k") || b.includes("2500")) return "2500";
  if (b.includes("1k") || b.includes("1,000")) return "1000";
  return "";
}
