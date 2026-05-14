import { useEffect, useState, useCallback } from "react";
import { Mail, Bot, UserPlus, MessageSquare, Activity as ActivityIcon, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { formatDistanceToNow } from "date-fns";

type ActivityKind = "lead" | "message" | "reply" | "won";

interface ActivityItem {
  id: string;
  type: ActivityKind;
  description: string;
  timestamp: string;
}

const ICONS: Record<ActivityKind, typeof Mail> = {
  lead: UserPlus,
  message: Mail,
  reply: MessageSquare,
  won: Trophy,
};

const COLORS: Record<ActivityKind, string> = {
  lead: "bg-success/10 text-success",
  message: "bg-primary/10 text-primary",
  reply: "bg-info/10 text-info",
  won: "bg-success/15 text-success",
};

export function ActivityFeed() {
  const { organization } = useAuth();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    try {
      const [leads, messages, replies] = await Promise.all([
        supabase
          .from("leads")
          .select("id, name, company, created_at")
          .eq("organization_id", organization.id)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("messages")
          .select("id, subject, content, type, created_at")
          .eq("organization_id", organization.id)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("replies")
          .select("id, content, created_at")
          .eq("organization_id", organization.id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      const all: ActivityItem[] = [];

      for (const l of leads.data ?? []) {
        all.push({
          id: `l-${l.id}`,
          type: "lead",
          description: `New lead: ${l.name}${l.company ? ` from ${l.company}` : ""}`,
          timestamp: l.created_at,
        });
      }
      for (const m of messages.data ?? []) {
        if (m.type === "lead_won") {
          all.push({
            id: `m-${m.id}`,
            type: "won",
            description: m.subject || "Lead marked as won",
            timestamp: m.created_at,
          });
          continue;
        }
        const label =
          m.type === "ai_generated"
            ? "AI sent message"
            : m.type === "sms"
              ? "SMS sent"
              : "Email sent";
        const detail = m.subject || (m.content ? m.content.slice(0, 60) : "");
        all.push({
          id: `m-${m.id}`,
          type: "message",
          description: detail ? `${label}: ${detail}` : label,
          timestamp: m.created_at,
        });
      }
      for (const r of replies.data ?? []) {
        all.push({
          id: `r-${r.id}`,
          type: "reply",
          description: `New reply: ${r.content.slice(0, 70)}`,
          timestamp: r.created_at,
        });
      }

      all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setItems(all.slice(0, 12));
    } catch (err) {
      console.warn("ActivityFeed: failed to load", err);
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
        <Bot className="h-4 w-4 text-muted-foreground" />
      </div>

      {loading ? (
        <div className="divide-y divide-border">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3 p-4">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-2 w-1/4 animate-pulse rounded bg-muted/70" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <ActivityIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">No activity yet</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">
            Add leads, send messages, or run a campaign and you'll see live updates here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {items.map((activity) => {
            const Icon = ICONS[activity.type];
            const color = COLORS[activity.type];
            return (
              <div key={activity.id} className="flex items-start gap-3 p-4">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground line-clamp-2">{activity.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
