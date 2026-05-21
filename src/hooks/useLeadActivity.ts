import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "@/components/crm/LeadCard";
import type { ActivityItem } from "@/components/crm/ActivityEntry";

/**
 * Fetches the merged activity timeline (messages + replies + tasks) for a
 * lead. Re-runs whenever the lead changes OR when the caller bumps
 * `refetchKey` (e.g. after sending an email so the new entry appears).
 */
export function useLeadActivity(lead: Lead | null, refetchKey: number) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  useEffect(() => {
    if (!lead) return;
    setLoadingActivity(true);
    Promise.all([
      supabase
        .from("messages")
        .select("id, subject, content, created_at, status, type, sentiment")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("replies")
        .select("id, content, created_at, channel, sentiment")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("tasks")
        .select("id, title, description, created_at, status, priority")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]).then(([messagesRes, repliesRes, tasksRes]) => {
      const items: ActivityItem[] = [];

      messagesRes.data?.forEach((m) =>
        items.push({
          id: m.id,
          type: m.type === "lead_won" ? "won" : "email",
          title: m.subject || (m.type === "lead_won" ? "Lead marked as won" : "Outreach email"),
          content: m.content,
          date: m.created_at,
          status: m.status,
          sentiment: m.sentiment,
        }),
      );

      repliesRes.data?.forEach((r) =>
        items.push({
          id: r.id,
          type: "reply",
          title: `Reply via ${r.channel}`,
          content: r.content,
          date: r.created_at,
          sentiment: r.sentiment,
        }),
      );

      tasksRes.data?.forEach((t) =>
        items.push({
          id: t.id,
          type: "task",
          title: t.title,
          content: t.description || "",
          date: t.created_at,
          status: t.status,
        }),
      );

      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setActivities(items);
      setLoadingActivity(false);
    });
  }, [lead, refetchKey]);

  return { activities, loadingActivity };
}
