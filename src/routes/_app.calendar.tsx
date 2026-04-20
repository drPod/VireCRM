import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Clock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  CalendarDays,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Link } from "@tanstack/react-router";
import { NewTaskDialog } from "@/components/crm/NewTaskDialog";

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarPage,
  head: () => ({
    meta: [
      { title: "Vireon — Calendar" },
      { name: "description", content: "Appointment booking and calendar management" },
    ],
  }),
});

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarTask {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  status: string;
  priority: string;
  lead_id: string | null;
}

const priorityColor = (p: string) => {
  if (p === "high") return "bg-destructive";
  if (p === "low") return "bg-muted-foreground";
  return "bg-warning";
};

function CalendarPage() {
  const { organization } = useAuth();
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const monthStart = cursor;
  const monthEnd = useMemo(
    () => new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999),
    [cursor],
  );

  useEffect(() => {
    if (!organization?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,description,due_date,status,priority,lead_id")
        .eq("organization_id", organization.id)
        .not("due_date", "is", null)
        .gte("due_date", monthStart.toISOString())
        .lte("due_date", monthEnd.toISOString())
        .order("due_date", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.warn("calendar load failed", error);
        setTasks([]);
      } else {
        setTasks((data ?? []) as CalendarTask[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [organization?.id, monthStart, monthEnd, reloadKey]);

  const today = new Date();
  const isCurrentMonth =
    cursor.getMonth() === today.getMonth() && cursor.getFullYear() === today.getFullYear();
  const todayDay = today.getDate();

  const tasksByDay = useMemo(() => {
    const map = new Map<number, CalendarTask[]>();
    for (const t of tasks) {
      const d = new Date(t.due_date).getDate();
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(t);
    }
    return map;
  }, [tasks]);

  const todayTasks = isCurrentMonth ? tasksByDay.get(todayDay) ?? [] : [];

  const monthLabel = cursor.toLocaleString("en-US", { month: "long", year: "numeric" });
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const firstWeekday = monthStart.getDay(); // 0 = Sun

  const weekStats = useMemo(() => {
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    const weekTasks = tasks.filter((t) => {
      const d = new Date(t.due_date);
      return d >= startOfWeek && d < endOfWeek;
    });
    return {
      booked: weekTasks.length,
      completed: weekTasks.filter((t) => t.status === "done").length,
      pending: weekTasks.filter((t) => t.status === "todo").length,
      inProgress: weekTasks.filter((t) => t.status === "in_progress").length,
    };
  }, [tasks, today]);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tasks scheduled for your team — pulled live from your CRM
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/leads">
              <Button variant="outline" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Open Leads
              </Button>
            </Link>
            <Button
              variant="command"
              className="gap-2"
              onClick={() => setNewTaskOpen(true)}
              disabled={!organization?.id}
            >
              <Plus className="h-4 w-4" />
              New Task
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{monthLabel}</h2>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
                  }
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    const d = new Date();
                    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
                  }}
                >
                  <CalendarDays className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {daysOfWeek.map((d) => (
                <div
                  key={d}
                  className="py-2 text-center text-xs font-medium text-muted-foreground"
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstWeekday }, (_, i) => (
                <div key={`empty-${i}`} className="aspect-square rounded-lg" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const dayTasks = tasksByDay.get(day) ?? [];
                const isToday = isCurrentMonth && day === todayDay;
                return (
                  <div
                    key={day}
                    className={`aspect-square rounded-lg border p-1.5 text-xs transition-colors hover:border-primary/30 ${
                      isToday
                        ? "border-primary bg-primary/10 font-bold text-primary"
                        : "border-transparent text-foreground"
                    }`}
                  >
                    <span>{day}</span>
                    {dayTasks.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-0.5">
                        {dayTasks.slice(0, 3).map((t) => (
                          <div
                            key={t.id}
                            className={`h-1.5 w-1.5 rounded-full ${priorityColor(t.priority)}`}
                          />
                        ))}
                        {dayTasks.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{dayTasks.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-foreground">
                {isCurrentMonth ? "Today's Tasks" : "Tasks this month"}
              </h3>
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : todayTasks.length === 0 && tasks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    No scheduled tasks{isCurrentMonth ? " today" : " this month"}.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-xs"
                    onClick={() => setNewTaskOpen(true)}
                    disabled={!organization?.id}
                  >
                    Schedule a follow-up
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {(isCurrentMonth ? todayTasks : tasks.slice(0, 5)).map((t) => (
                    <div
                      key={t.id}
                      className="rounded-lg border border-border bg-muted/50 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {t.title}
                          </p>
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(t.due_date).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                        <Badge
                          variant={t.status === "done" ? "default" : "secondary"}
                          className="text-xs shrink-0"
                        >
                          {t.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">This Week</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Scheduled", value: weekStats.booked },
                  { label: "Completed", value: weekStats.completed },
                  { label: "In progress", value: weekStats.inProgress },
                  { label: "Pending", value: weekStats.pending },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <p className="text-lg font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
              <h3 className="text-sm font-semibold text-foreground">Booking links</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Public booking pages are coming soon. For now, manage tasks per lead from the Leads view.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
