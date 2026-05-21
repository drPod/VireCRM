import { Loader2 } from "lucide-react";
import { ActivityEntry, type ActivityItem } from "./ActivityEntry";

/**
 * Activity timeline panel for `LeadDetailDrawer`. Pure presentational —
 * fetching lives in `useLeadActivity`.
 */
export function LeadActivityTab({
  activities,
  loading,
}: {
  activities: ActivityItem[];
  loading: boolean;
}) {
  return (
    <div className="pt-4">
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : activities.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No activity yet for this lead.
        </div>
      ) : (
        <div className="relative space-y-0">
          {/* Timeline line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

          {activities.map((item) => (
            <ActivityEntry key={`${item.type}-${item.id}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
