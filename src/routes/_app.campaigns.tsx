import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Plus, Users, Send, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_app/campaigns")({
  component: CampaignsPage,
  head: () => ({
    meta: [
      { title: "AI CRM — Campaigns" },
      { name: "description", content: "Manage automated outreach campaigns" },
    ],
  }),
});

interface Campaign {
  id: string; name: string; objective: string;
  status: "active" | "paused" | "completed" | "draft";
  leads: number; sent: number; replies: number; conversionRate: number;
}

const mockCampaigns: Campaign[] = [
  { id: "1", name: "Q1 SaaS Outreach", objective: "Engage 500 SaaS decision-makers", status: "active", leads: 500, sent: 342, replies: 67, conversionRate: 19.6 },
  { id: "2", name: "Hot Leads Follow-up", objective: "Re-engage leads with score > 80", status: "active", leads: 85, sent: 85, replies: 31, conversionRate: 36.5 },
  { id: "3", name: "Conference Attendees", objective: "Post-event outreach", status: "completed", leads: 200, sent: 200, replies: 48, conversionRate: 24.0 },
  { id: "4", name: "Product Launch", objective: "Announce new features", status: "draft", leads: 1200, sent: 0, replies: 0, conversionRate: 0 },
  { id: "5", name: "Win-back Campaign", objective: "Re-engage lost leads from Q4", status: "paused", leads: 150, sent: 75, replies: 8, conversionRate: 10.7 },
];

const statusVariants: Record<Campaign["status"], "success" | "warning" | "secondary" | "info"> = {
  active: "success", paused: "warning", completed: "secondary", draft: "info",
};

function CampaignsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campaigns</h1>
          <p className="text-sm text-muted-foreground">Automated outreach sequences</p>
        </div>
        <Button variant="command" size="sm"><Plus className="h-4 w-4" />New Campaign</Button>
      </div>
      <div className="space-y-4">
        {mockCampaigns.map((c) => (
          <div key={c.id} className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{c.name}</h3>
              <Badge variant={statusVariants[c.status]} className="capitalize">{c.status}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{c.objective}</p>
            <div className="mt-4 grid grid-cols-4 gap-4">
              {[
                { icon: Users, val: c.leads, label: "Leads" },
                { icon: Send, val: c.sent, label: "Sent" },
                { icon: Zap, val: c.replies, label: "Replies" },
                { icon: BarChart3, val: `${c.conversionRate}%`, label: "Conversion" },
              ].map((m) => (
                <div key={m.label} className="flex items-center gap-2">
                  <m.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{m.val}</p>
                    <p className="text-[10px] text-muted-foreground">{m.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
