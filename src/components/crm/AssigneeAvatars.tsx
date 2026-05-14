/**
 * Stacked avatar bubbles for one or more assignees, with overflow indicator.
 * Used on lead cards and inside the lead detail drawer header.
 */
export interface AssigneeLite {
  user_id: string;
  full_name: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// Deterministic background color per user so the same person always renders
// with the same bubble color across the app.
const PALETTE = [
  "bg-primary/20 text-primary",
  "bg-success/20 text-success",
  "bg-warning/20 text-warning",
  "bg-info/20 text-info",
  "bg-destructive/20 text-destructive",
  "bg-secondary text-foreground",
];

function colorFor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length]!;
}

export function AssigneeAvatars({
  assignees,
  size = "sm",
  max = 3,
  className = "",
}: {
  assignees: AssigneeLite[];
  size?: "sm" | "md";
  max?: number;
  className?: string;
}) {
  if (!assignees.length) return null;
  const dim = size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";
  const visible = assignees.slice(0, max);
  const overflow = assignees.length - visible.length;

  return (
    <div className={`flex items-center -space-x-1.5 ${className}`}>
      {visible.map((a) => (
        <div
          key={a.user_id}
          title={a.full_name}
          className={`${dim} ${colorFor(
            a.user_id,
          )} flex items-center justify-center rounded-full border-2 border-card font-semibold ring-0`}
        >
          {initials(a.full_name)}
        </div>
      ))}
      {overflow > 0 && (
        <div
          title={assignees
            .slice(max)
            .map((a) => a.full_name)
            .join(", ")}
          className={`${dim} flex items-center justify-center rounded-full border-2 border-card bg-muted font-semibold text-muted-foreground`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
