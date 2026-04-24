import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LeadCard, type Lead } from "@/components/crm/LeadCard";
import { AddLeadDialog } from "@/components/crm/AddLeadDialog";
import { ImportLeadsDialog } from "@/components/crm/ImportLeadsDialog";
import { AutoFindLeadsDialog } from "@/components/crm/AutoFindLeadsDialog";
import { ImportApolloListDialog } from "@/components/crm/ImportApolloListDialog";
import { LeadDetailDrawer } from "@/components/crm/LeadDetailDrawer";
import { ExportLeadsButton } from "@/components/crm/ExportLeadsButton";
import { Search, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

type LeadsAction = "add" | "import" | "auto-find";
type LeadsSearch = { q?: string; action?: LeadsAction; ai_desc?: string; ai_industry?: string };

export const Route = createFileRoute("/_app/leads")({
  component: LeadsPage,
  validateSearch: (search: Record<string, unknown>): LeadsSearch => {
    const out: LeadsSearch = {};
    if (typeof search.q === "string" && search.q.length > 0) out.q = search.q;
    if (search.action === "add" || search.action === "import" || search.action === "auto-find") {
      out.action = search.action;
    }
    if (typeof search.ai_desc === "string" && search.ai_desc.length > 0) {
      out.ai_desc = search.ai_desc.slice(0, 1000);
    }
    if (typeof search.ai_industry === "string" && search.ai_industry.length > 0) {
      out.ai_industry = search.ai_industry.slice(0, 200);
    }
    return out;
  },
  head: () => ({
    meta: [
      { title: "Genesis — Leads" },
      { name: "description", content: "Manage and score your leads" },
    ],
  }),
});

const statusFilters = ["all", "new", "contacted", "qualified", "negotiation", "won", "lost"] as const;

function LeadsPage() {
  const { organization } = useAuth();
  const navigate = useNavigate();
  const { q, action, ai_desc, ai_industry } = Route.useSearch();
  const [search, setSearch] = useState(q ?? "");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [autoFindOpen, setAutoFindOpen] = useState(false);
  // Captured once when the AI Advisor deep-links us in, so the dialog gets
  // pre-filled even after we strip the URL params.
  const [aiPrefill, setAiPrefill] = useState<{ desc?: string; industry?: string }>({});

  // Sync search input when URL ?q= changes (e.g., navigating from AI Advisor)
  useEffect(() => {
    if (q !== undefined) setSearch(q);
  }, [q]);

  // Auto-open dialogs from ?action= and clear the param so refresh doesn't reopen.
  useEffect(() => {
    if (action === "add") {
      setAddOpen(true);
      navigate({ to: "/leads", search: (prev: LeadsSearch) => ({ ...prev, action: undefined }), replace: true });
    } else if (action === "import") {
      setImportOpen(true);
      navigate({ to: "/leads", search: (prev: LeadsSearch) => ({ ...prev, action: undefined }), replace: true });
    } else if (action === "auto-find") {
      setAiPrefill({ desc: ai_desc, industry: ai_industry });
      setAutoFindOpen(true);
      navigate({
        to: "/leads",
        search: (prev: LeadsSearch) => ({
          ...prev,
          action: undefined,
          ai_desc: undefined,
          ai_industry: undefined,
        }),
        replace: true,
      });
    }
  }, [action, ai_desc, ai_industry, navigate]);

  const handleLeadAdded = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!organization?.id) return;

    const fetchLeads = async () => {
      setLoading(true);
      let query = supabase
        .from("leads")
        .select("*", { count: "exact" })
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (search.trim()) {
        // Sanitize search input: strip PostgREST metacharacters and limit length
        const sanitized = search.trim().slice(0, 200).replace(/[,.()"'\\]/g, "");
        if (sanitized) {
          query = query.or(
            `name.ilike.%${sanitized}%,email.ilike.%${sanitized}%,company.ilike.%${sanitized}%`
          );
        }
      }

      const [{ data, count, error }, profilesRes] = await Promise.all([
        query,
        supabase
          .from("profiles")
          .select("user_id, full_name")
          .eq("organization_id", organization.id),
      ]);

      const nameByUserId = new Map<string, string>();
      profilesRes.data?.forEach((p) => {
        if (p.user_id) nameByUserId.set(p.user_id, p.full_name ?? "Unnamed");
      });

      if (!error && data) {
        setLeads(
          data.map((l) => ({
            id: l.id,
            name: l.name,
            email: l.email ?? "",
            phone: l.phone ?? undefined,
            company: l.company ?? undefined,
            status: l.status as Lead["status"],
            score: l.score ?? 0,
            nextAction: l.next_action ?? undefined,
            lastContact: l.last_contact ?? undefined,
            annualKwh: l.annual_kwh ?? null,
            contractEndDate: l.contract_end_date ?? null,
            currentSupplier: l.current_supplier ?? null,
            assignedTo: (l as { assigned_to?: string | null }).assigned_to ?? null,
            assigneeName: (l as { assigned_to?: string | null }).assigned_to
              ? nameByUserId.get((l as { assigned_to: string }).assigned_to) ?? null
              : null,
          }))
        );
        setTotalCount(count ?? data.length);
      }
      setLoading(false);
    };

    fetchLeads();
  }, [organization?.id, statusFilter, search, refreshKey]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground">{totalCount} total leads in pipeline</p>
        </div>
        <div className="flex gap-2">
          <ExportLeadsButton leads={leads} />
          <ImportApolloListDialog onLeadsImported={handleLeadAdded} />
          <AutoFindLeadsDialog
            onLeadsImported={handleLeadAdded}
            open={autoFindOpen}
            onOpenChange={(v) => {
              setAutoFindOpen(v);
              if (!v) setAiPrefill({});
            }}
            initialDescription={aiPrefill.desc}
            initialIndustry={aiPrefill.industry}
          />
          <ImportLeadsDialog
            onLeadsImported={handleLeadAdded}
            open={importOpen}
            onOpenChange={setImportOpen}
          />
          <AddLeadDialog
            onLeadAdded={handleLeadAdded}
            open={addOpen}
            onOpenChange={setAddOpen}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads..."
            className="h-9 w-full rounded-lg border border-input bg-input pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex gap-1.5">
          {statusFilters.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                statusFilter === s
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onClick={() => {
                setSelectedLead(lead);
                setDrawerOpen(true);
              }}
            />
          ))}
          {leads.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              No leads found matching your criteria
            </div>
          )}
        </div>
      )}

      <LeadDetailDrawer
        lead={selectedLead}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onUpdated={handleLeadAdded}
      />
    </div>
  );
}
