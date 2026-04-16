import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Plus,
  Send,
  Eye,
  MousePointer,
  Users,
  TrendingUp,
  MoreHorizontal,
  FileText,
  Clock,
  BarChart3,
} from "lucide-react";

export const Route = createFileRoute("/_app/email-marketing")({
  component: EmailMarketingPage,
  head: () => ({
    meta: [
      { title: "Vireon — Email Marketing" },
      { name: "description", content: "Email campaigns, templates, and analytics" },
    ],
  }),
});

const demoCampaigns = [
  {
    id: "1",
    name: "Spring Promo — 20% Off All Plans",
    status: "sent" as const,
    sentAt: "Apr 10, 2026",
    recipients: 2340,
    opened: 1287,
    clicked: 342,
    openRate: "55.0%",
    clickRate: "14.6%",
  },
  {
    id: "2",
    name: "New Feature Announcement — AI Scheduling",
    status: "sent" as const,
    sentAt: "Apr 5, 2026",
    recipients: 2340,
    opened: 1521,
    clicked: 456,
    openRate: "65.0%",
    clickRate: "19.5%",
  },
  {
    id: "3",
    name: "Case Study — How TechCorp 3x'd Sales",
    status: "scheduled" as const,
    sentAt: "Apr 18, 2026 9:00 AM",
    recipients: 2340,
    opened: 0,
    clicked: 0,
    openRate: "—",
    clickRate: "—",
  },
  {
    id: "4",
    name: "Monthly Newsletter — April 2026",
    status: "draft" as const,
    sentAt: "—",
    recipients: 0,
    opened: 0,
    clicked: 0,
    openRate: "—",
    clickRate: "—",
  },
];

const demoTemplates = [
  { name: "Welcome Series", category: "Onboarding", uses: 156 },
  { name: "Feature Update", category: "Product", uses: 89 },
  { name: "Re-engagement", category: "Retention", uses: 67 },
  { name: "Promotional Offer", category: "Sales", uses: 234 },
];

function EmailMarketingPage() {
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Email Marketing</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create campaigns, manage templates, and track performance
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              Templates
            </Button>
            <Button variant="command" className="gap-2">
              <Plus className="h-4 w-4" />
              New Campaign
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-5 gap-4">
          {[
            { label: "Subscribers", value: "2,340", icon: Users, color: "text-primary" },
            { label: "Avg Open Rate", value: "58.2%", icon: Eye, color: "text-success" },
            { label: "Avg Click Rate", value: "16.8%", icon: MousePointer, color: "text-warning" },
            { label: "Sent This Month", value: "4,680", icon: Send, color: "text-foreground" },
            { label: "Growth", value: "+12.4%", icon: TrendingUp, color: "text-success" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <stat.icon className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
              <p className={`mt-1 text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Campaigns */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Campaigns</h2>
            {demoCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="group rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/20"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground">{campaign.name}</h3>
                      <Badge
                        variant={
                          campaign.status === "sent"
                            ? "default"
                            : campaign.status === "scheduled"
                              ? "secondary"
                              : "outline"
                        }
                        className="text-xs"
                      >
                        {campaign.status === "sent" && <Send className="mr-1 h-2.5 w-2.5" />}
                        {campaign.status === "scheduled" && <Clock className="mr-1 h-2.5 w-2.5" />}
                        {campaign.status === "draft" && <FileText className="mr-1 h-2.5 w-2.5" />}
                        {campaign.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {campaign.status === "scheduled" ? `Scheduled: ${campaign.sentAt}` : campaign.status === "sent" ? `Sent: ${campaign.sentAt}` : "Not sent yet"}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>

                {campaign.status === "sent" && (
                  <div className="mt-4 grid grid-cols-4 gap-4 border-t border-border pt-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Recipients</p>
                      <p className="text-sm font-semibold text-foreground">{campaign.recipients.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Opened</p>
                      <p className="text-sm font-semibold text-foreground">{campaign.openRate}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Clicked</p>
                      <p className="text-sm font-semibold text-foreground">{campaign.clickRate}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Clicks</p>
                      <p className="text-sm font-semibold text-foreground">{campaign.clicked}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Right panel */}
          <div className="space-y-6">
            {/* Templates */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Templates</h3>
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  <Plus className="h-3 w-3" /> New
                </Button>
              </div>
              <div className="space-y-2">
                {demoTemplates.map((template) => (
                  <div key={template.name} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{template.name}</p>
                      <p className="text-xs text-muted-foreground">{template.category} · {template.uses} uses</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs">Use</Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick stats */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Deliverability</h3>
              <div className="space-y-3">
                {[
                  { label: "Delivery Rate", value: "98.7%", color: "bg-success" },
                  { label: "Bounce Rate", value: "1.3%", color: "bg-destructive" },
                  { label: "Spam Rate", value: "0.02%", color: "bg-warning" },
                  { label: "Unsubscribe", value: "0.4%", color: "bg-muted-foreground" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${item.color}`} />
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                    </div>
                    <span className="text-xs font-medium text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Lists */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Lists</h3>
              <div className="space-y-2">
                {[
                  { name: "All Subscribers", count: 2340 },
                  { name: "Active Leads", count: 1456 },
                  { name: "Customers", count: 342 },
                  { name: "Cold Leads", count: 542 },
                ].map((list) => (
                  <div key={list.name} className="flex items-center justify-between rounded-lg p-2">
                    <span className="text-sm text-foreground">{list.name}</span>
                    <span className="text-xs text-muted-foreground">{list.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
