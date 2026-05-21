/**
 * GettingStartedChecklist — sidebar widget that tracks five core onboarding
 * actions. Auto-marks items complete when the user navigates to the matching
 * route for the first time.
 *
 * State is persisted to profiles.checklist_items_completed (text[]) and
 * profiles.checklist_dismissed_at. Both columns are added by migration
 * 20260521000003_checklist_columns.sql — not yet in the generated types, so
 * Supabase update calls use `as never` casts per repo convention.
 */
import { useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { CheckCircle2, Circle, X, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const CHECKLIST_ITEMS = [
  { id: "first-lead", label: "Add your first lead", route: "/leads" },
  { id: "workflow", label: "Set up a workflow", route: "/workflows" },
  { id: "command-chat", label: "Try Command Chat", route: "/command-chat" },
  { id: "branding", label: "Customize your branding", route: "/settings" },
  { id: "invite", label: "Invite a team member", route: "/settings" },
] as const;

type ChecklistItemId = (typeof CHECKLIST_ITEMS)[number]["id"];

interface GettingStartedChecklistProps {
  userId: string;
  completedItems: string[];
  dismissedAt: string | null;
}

export function GettingStartedChecklist({
  userId,
  completedItems: initialCompleted,
  dismissedAt: initialDismissedAt,
}: GettingStartedChecklistProps) {
  const location = useLocation();
  const [completed, setCompleted] = useState<string[]>(initialCompleted);
  const [dismissedAt, setDismissedAt] = useState<string | null>(initialDismissedAt);

  // Sync props → local state when parent provides fresh data (e.g. after
  // AuthProvider reloads profile). Two separate effects so each dep array is
  // minimal and neither clobbers in-flight optimistic updates from the other.
  useEffect(() => { setCompleted(initialCompleted); }, [initialCompleted]);
  useEffect(() => { setDismissedAt(initialDismissedAt); }, [initialDismissedAt]);

  // userId ref so the DB write callbacks below always see the current value
  // without needing it in effect deps.
  const userIdRef = useRef(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  const dismiss = async () => {
    const now = new Date().toISOString();
    setDismissedAt(now);
    await supabase
      .from("profiles")
      .update({ checklist_dismissed_at: now } as never)
      .eq("user_id", userIdRef.current);
  };

  // Auto-complete any uncompleted item whose route matches the current path.
  // Uses a functional setCompleted updater so this effect never needs markComplete
  // or `completed` in its deps — no stale-closure risk.
  useEffect(() => {
    const currentPath = location.pathname;
    const matchingItem = CHECKLIST_ITEMS.find((item) => item.route === currentPath);
    if (!matchingItem) return;

    setCompleted((prev) => {
      if (prev.includes(matchingItem.id)) return prev;
      const next = [...prev, matchingItem.id];
      void supabase
        .from("profiles")
        .update({ checklist_items_completed: next } as never)
        .eq("user_id", userIdRef.current);
      return next;
    });
  }, [location.pathname]);

  if (dismissedAt) return null;

  const completedCount = completed.length;
  const total = CHECKLIST_ITEMS.length;

  return (
    <div className="mx-2 mb-3 rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-3">
      <div className="mb-2.5 flex items-center gap-2">
        <Rocket className="h-3.5 w-3.5 shrink-0 text-sidebar-primary" aria-hidden />
        <span className="flex-1 text-xs font-semibold text-sidebar-foreground">
          Getting Started
        </span>
        <span className="rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-sidebar-foreground/70">
          {completedCount}/{total}
        </span>
        <button
          type="button"
          aria-label="Dismiss getting started checklist"
          onClick={dismiss}
          className="rounded p-0.5 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <ul className="space-y-1.5">
        {CHECKLIST_ITEMS.map((item) => {
          const done = completed.includes(item.id);
          return (
            <li key={item.id} className="flex items-center gap-2">
              {done ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" aria-hidden />
              ) : (
                <Circle className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/30" aria-hidden />
              )}
              <span
                className={cn(
                  "text-xs leading-snug transition-colors",
                  done ? "text-sidebar-foreground/40 line-through" : "text-sidebar-foreground/75",
                )}
              >
                {item.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
