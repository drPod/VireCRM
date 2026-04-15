import { createFileRoute } from "@tanstack/react-router";
import { LeadCard, type Lead } from "@/components/crm/LeadCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Filter, Plus, SortAsc } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/leads")({
  component: LeadsPage,
  head: () => ({
    meta: [
      { title: "AI CRM — Leads" },
      { name: "description", content: "Manage and score your leads" },
    ],
  }),
});

const allLeads: Lead[] = [
  { id: "1", name: "Sarah Chen", email: "sarah@techflow.io", company: "TechFlow", status: "new", score: 85, nextAction: "Send intro email" },
  { id: "2", name: "Marcus Rivera", email: "marcus@acme.co", company: "Acme Corp", status: "new", score: 72, phone: "+1 555-0123" },
  { id: "3", name: "Emily Watson", email: "emily@startupx.com", company: "StartupX", status: "contacted", score: 68, nextAction: "Follow up in 2 days" },
  { id: "4", name: "James Park", email: "james@bigco.net", company: "BigCo", status: "contacted", score: 55 },
  { id: "5", name: "Alex Thompson", email: "alex@innovate.ai", company: "Innovate AI", status: "qualified", score: 91, nextAction: "Book demo call" },
  { id: "6", name: "Priya Patel", email: "priya@nexgen.io", company: "NexGen", status: "qualified", score: 78, phone: "+1 555-0456" },
  { id: "7", name: "David Kim", email: "david@cloudscale.com", company: "CloudScale", status: "negotiation", score: 88, nextAction: "Send proposal" },
  { id: "8", name: "Lisa Zhang", email: "lisa@dataworks.co", company: "DataWorks", status: "won", score: 95 },
  { id: "9", name: "Tom Harris", email: "tom@webdev.co", company: "WebDev Co", status: "new", score: 42 },
  { id: "10", name: "Anika Gupta", email: "anika@finflow.io", company: "FinFlow", status: "contacted", score: 77, nextAction: "Send case study" },
];

const statusFilters = ["all", "new", "contacted", "qualified", "negotiation", "won", "lost"] as const;

function LeadsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = allLeads.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(search.toLowerCase()) ||
      lead.email.toLowerCase().includes(search.toLowerCase()) ||
      (lead.company?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground">{allLeads.length} total leads in pipeline</p>
        </div>
        <Button variant="command" size="sm">
          <Plus className="h-4 w-4" />
          Add Lead
        </Button>
      </div>

      {/* Filters */}
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

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            No leads found matching your criteria
          </div>
        )}
      </div>
    </div>
  );
}
