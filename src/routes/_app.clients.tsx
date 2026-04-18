import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Users,
  Loader2,
  Copy,
  ExternalLink,
  Sparkles,
  TrendingUp,
  DollarSign,
  UserPlus,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { CreateClientDialog } from "@/components/crm/CreateClientDialog";
import { ResetClientPasswordDialog } from "@/components/crm/ResetClientPasswordDialog";
import { ClientNotesCell } from "@/components/crm/ClientNotesCell";

export const Route = createFileRoute("/_app/clients")({
  component: ClientsPage,
  head: () => ({
    meta: [
      { title: "Clients — Vireon" },
      { name: "description", content: "Manage your reseller client organizations" },
    ],
  }),
});

interface ClientOrg {
  id: string;
  name: string;
  brand_name: string | null;
  slug: string;
  plan: string;
  created_at: string;
  member_count: number;
  lead_count: number;
  last_activity: string;
  reseller_plan_name: string | null;
  monthly_price_cents: number | null;
  markup_cents: number | null;
  currency: string | null;
  subscription_status: string | null;
  notes: string | null;
}

function formatCents(cents: number | null | undefined, currency = "USD") {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function ClientsPage() {
  const { organization, role } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const isOwner = role?.role === "owner";
  const isReseller = !!(organization as { is_reseller?: boolean } | null)?.is_reseller;

  useEffect(() => {
    if (!organization?.id) return;
    if (!isOwner || !isReseller) {
      setLoading(false);
      return;
    }
    void loadClients();
  }, [organization?.id, isOwner, isReseller]);

  const loadClients = async () => {
    if (!organization?.id) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("get_reseller_clients", {
      p_reseller_id: organization.id,
    });
    if (error) {
      toast.error("Failed to load clients: " + error.message);
    } else if (data) {
      setClients(data as ClientOrg[]);
    }
    setLoading(false);
  };

  const signupUrl =
    typeof window !== "undefined" && organization
      ? `${window.location.origin}/r/${organization.slug}/signup`
      : "";

  const copySignupLink = () => {
    void navigator.clipboard.writeText(signupUrl);
    toast.success("Signup link copied to clipboard");
  };

  if (!isOwner) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-3 text-sm font-semibold text-foreground">
            Owners only
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Only organization owners can manage reseller clients.
          </p>
        </div>
      </div>
    );
  }

  if (!isReseller) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-8 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary" />
          <h3 className="mt-3 text-base font-semibold text-foreground">
            Become a reseller
          </h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Enable reseller mode to onboard your own clients under your branded CRM.
            Each client gets their own isolated workspace.
          </p>
          <Button
            variant="command"
            className="mt-4"
            onClick={() => navigate({ to: "/settings" })}
          >
            Enable in Settings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Clients
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage the organizations signed up under your reseller account
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="gap-2">
            <Link to="/clients/payouts">
              <DollarSign className="h-4 w-4" />
              Payouts
            </Link>
          </Button>
          <Button
            variant="command"
            onClick={() => setCreateOpen(true)}
            className="gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Create Client
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Clients" value={String(clients.length)} icon={Building2} />
        <StatCard
          label="Total Users"
          value={String(clients.reduce((sum, c) => sum + Number(c.member_count), 0))}
          icon={Users}
        />
        <StatCard
          label="Total Leads"
          value={String(clients.reduce((sum, c) => sum + Number(c.lead_count), 0))}
          icon={TrendingUp}
        />
        <StatCard
          label="Monthly Markup"
          value={formatCents(
            clients.reduce(
              (sum, c) =>
                c.subscription_status === "active" || c.subscription_status === "trialing"
                  ? sum + Number(c.markup_cents ?? 0)
                  : sum,
              0,
            ),
            clients.find((c) => c.currency)?.currency ?? "USD",
          )}
          icon={DollarSign}
        />
      </div>

      {/* Signup link */}
      <div className="mb-6 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-2">
          <ExternalLink className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Your client signup link
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Share this branded link. New signups create their own isolated org under your account.
        </p>
        <div className="flex gap-2">
          <input
            readOnly
            value={signupUrl}
            className="h-10 flex-1 rounded-lg border border-input bg-input px-3 text-sm text-foreground font-mono outline-none"
          />
          <Button variant="outline" onClick={copySignupLink} className="gap-2">
            <Copy className="h-4 w-4" />
            Copy
          </Button>
        </div>
      </div>

      {/* Clients list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : clients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <h3 className="mt-4 text-sm font-semibold text-foreground">
            No clients yet
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Create a client account directly, or share your signup link above.
          </p>
          <Button
            variant="command"
            onClick={() => setCreateOpen(true)}
            className="mt-4 gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Create your first client
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/30">
              <tr className="text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3 text-right">Markup / mo</th>
                <th className="px-4 py-3">Members</th>
                <th className="px-4 py-3">Leads</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3">Last Activity</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const isActive =
                  c.subscription_status === "active" ||
                  c.subscription_status === "trialing";
                return (
                  <tr
                    key={c.id}
                  className="border-b border-border last:border-0 hover:bg-muted/20"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm text-foreground">
                      {c.brand_name || c.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Joined {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {c.reseller_plan_name ? (
                      <div className="flex flex-col gap-1">
                        <Badge
                          variant={isActive ? "default" : "secondary"}
                          className="w-fit"
                        >
                          {c.reseller_plan_name}
                        </Badge>
                        {c.subscription_status && !isActive && (
                          <span className="text-[10px] text-muted-foreground capitalize">
                            {c.subscription_status.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                    ) : (
                      <Badge variant="outline" className="capitalize">
                        {c.plan} · no plan
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-foreground tabular-nums">
                    {c.markup_cents != null && c.markup_cents > 0 ? (
                      <span className={isActive ? "text-emerald-500" : "text-muted-foreground"}>
                        {formatCents(c.markup_cents, c.currency ?? "USD")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {Number(c.member_count)}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {Number(c.lead_count)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <ClientNotesCell
                      clientId={c.id}
                      clientName={c.brand_name || c.name}
                      initialNotes={c.notes}
                      onSaved={(newNotes) =>
                        setClients((prev) =>
                          prev.map((row) =>
                            row.id === c.id ? { ...row, notes: newNotes } : row,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(c.last_activity), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() =>
                        setResetTarget({
                          id: c.id,
                          name: c.brand_name || c.name,
                        })
                      }
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      Reset password
                    </Button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreateClientDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={loadClients}
      />

      <ResetClientPasswordDialog
        open={!!resetTarget}
        onOpenChange={(o) => !o && setResetTarget(null)}
        clientOrgId={resetTarget?.id ?? null}
        clientName={resetTarget?.name ?? null}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
    </div>
  );
}
