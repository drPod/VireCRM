import { Mail, Phone, Calendar, Bot, UserPlus } from "lucide-react";

interface Activity {
  id: string;
  type: "email" | "call" | "meeting" | "ai_action" | "new_lead";
  description: string;
  time: string;
}

const iconMap = {
  email: Mail,
  call: Phone,
  meeting: Calendar,
  ai_action: Bot,
  new_lead: UserPlus,
};

const colorMap = {
  email: "bg-primary/10 text-primary",
  call: "bg-success/10 text-success",
  meeting: "bg-warning/10 text-warning",
  ai_action: "bg-info/10 text-info",
  new_lead: "bg-accent text-accent-foreground",
};

const mockActivities: Activity[] = [
  { id: "1", type: "ai_action", description: "AI scored 45 new leads", time: "2 min ago" },
  { id: "2", type: "email", description: "Outreach sent to Sarah Chen", time: "15 min ago" },
  { id: "3", type: "new_lead", description: "Marcus Rivera added from LinkedIn", time: "32 min ago" },
  { id: "4", type: "ai_action", description: "AI classified 12 replies", time: "1 hr ago" },
  { id: "5", type: "meeting", description: "Call booked with Alex Thompson", time: "2 hr ago" },
  { id: "6", type: "email", description: "Follow-up sent to cold leads batch", time: "3 hr ago" },
  { id: "7", type: "call", description: "Demo call completed with Acme Corp", time: "4 hr ago" },
];

export function ActivityFeed() {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border p-4">
        <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
      </div>
      <div className="divide-y divide-border">
        {mockActivities.map((activity) => {
          const Icon = iconMap[activity.type];
          const color = colorMap[activity.type];
          return (
            <div key={activity.id} className="flex items-start gap-3 p-4">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{activity.description}</p>
                <p className="text-xs text-muted-foreground">{activity.time}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
