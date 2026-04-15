import { useState, useEffect } from "react";
import { LeadCard, type Lead } from "./LeadCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Loader2 } from "lucide-react";

const stages = [
  { key: "new" as const, label: "New" },
  { key: "contacted" as const, label: "Contacted" },
  { key: "qualified" as const, label: "Qualified" },
  { key: "negotiation" as const, label: "Negotiation" },
  { key: "won" as const, label: "Won" },
];

export function PipelineView() {
  const { organization } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organization?.id) return;

    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("leads")
        .select("*")
        .eq("organization_id", organization.id)
        .order("score", { ascending: false });

      if (data) {
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
          }))
        );
      }
      setLoading(false);
    };

    fetch();
  }, [organization?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const stageLeads = leads.filter((l) => l.status === stage.key);
        return (
          <div key={stage.key} className="w-72 shrink-0">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{stage.label}</h3>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 text-xs font-medium text-secondary-foreground">
                {stageLeads.length}
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
