import { LeadCard, type Lead } from "./LeadCard";

const stages = [
  { key: "new" as const, label: "New", count: 0 },
  { key: "contacted" as const, label: "Contacted", count: 0 },
  { key: "qualified" as const, label: "Qualified", count: 0 },
  { key: "negotiation" as const, label: "Negotiation", count: 0 },
  { key: "won" as const, label: "Won", count: 0 },
];

const mockLeads: Lead[] = [
  { id: "1", name: "Sarah Chen", email: "sarah@techflow.io", company: "TechFlow", status: "new", score: 85, nextAction: "Send intro email" },
  { id: "2", name: "Marcus Rivera", email: "marcus@acme.co", company: "Acme Corp", status: "new", score: 72, phone: "+1 555-0123" },
  { id: "3", name: "Emily Watson", email: "emily@startupx.com", company: "StartupX", status: "contacted", score: 68, nextAction: "Follow up in 2 days" },
  { id: "4", name: "James Park", email: "james@bigco.net", company: "BigCo", status: "contacted", score: 55, lastContact: "Yesterday" },
  { id: "5", name: "Alex Thompson", email: "alex@innovate.ai", company: "Innovate AI", status: "qualified", score: 91, nextAction: "Book demo call" },
  { id: "6", name: "Priya Patel", email: "priya@nexgen.io", company: "NexGen", status: "qualified", score: 78, phone: "+1 555-0456" },
  { id: "7", name: "David Kim", email: "david@cloudscale.com", company: "CloudScale", status: "negotiation", score: 88, nextAction: "Send proposal" },
  { id: "8", name: "Lisa Zhang", email: "lisa@dataworks.co", company: "DataWorks", status: "won", score: 95 },
];

export function PipelineView() {
  const stagesWithCounts = stages.map((stage) => ({
    ...stage,
    count: mockLeads.filter((l) => l.status === stage.key).length,
  }));

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stagesWithCounts.map((stage) => {
        const stageLeads = mockLeads.filter((l) => l.status === stage.key);
        return (
          <div key={stage.key} className="w-72 shrink-0">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{stage.label}</h3>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 text-xs font-medium text-secondary-foreground">
                {stage.count}
              </span>
            </div>
            <div className="space-y-3">
              {stageLeads.map((lead) => (
                <LeadCard key={lead.id} lead={lead} />
              ))}
              {stageLeads.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  No leads
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
