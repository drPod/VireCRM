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
  Sparkles,
  Mail,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Link } from "@tanstack/react-router";
import { NewTaskDialog } from "@/components/crm/NewTaskDialog";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import { completeTaskWithAiFn } from "@/functions/complete-task.functions";
import { sendTransactionalEmail } from "@/lib/email/send";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarPage,
  head: () => ({
    meta: [
      { title: "Genesis — Calendar" },
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

interface CalendarOutreach {
  id: string;
  subject: string | null;
  content: string;
  status: string;
  created_at: string;
  lead_id: string | null;
  type: string;
}

const priorityColor = (p: string) => {
  if (p === "high") return "bg-destructive";
  if (p === "low") return "bg-muted-foreground";
  return "bg-warning";
};

function CalendarPage() {
  const { organization, role } = useAuth();
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [outreach, setOutreach] = useState<CalendarOutreach[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [dialogDefaultDate, setDialogDefaultDate] = useState<Date | undefined>(undefined);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const completeTask = useAuthedServerFn(completeTaskWithAiFn);
  const isOwner = role?.role === "owner";
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const handleCompleteWithAi = async (taskId: string) => {
    setCompletingId(taskId);
    try {
      const result = await completeTask({
        data: { taskId },
      });

      if (result.lead?.email) {
        try {
          await sendTransactionalEmail({
            templateName: "review-request",
            recipientEmail: result.lead.email,
            templateData: {
              brandName: result.brandName,
              customerName: result.lead.name.split(" ")[0],
              senderName: result.senderName,
              customMessage: result.draft.body,
            },
            fromName: result.brandName,
            replyTo: result.supportEmail ?? undefined,
          });
          toast.success(`Email sent to ${result.lead.name} — task marked done`);
        } catch (sendErr) {
          const msg = sendErr instanceof Error ? sendErr.message : "Email failed";
          toast.warning(`Task marked done, but email send failed: ${msg}`);
        }
      } else {
        toast.success(
          result.lead
            ? `Draft saved on ${result.lead.name} (no email on file). Task marked done.`
            : "Task marked done with AI draft.",
        );
      }
      setReloadKey((k) => k + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to complete task";
      toast.error(msg);
    } finally {
      setCompletingId(null);
    }
  };

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
      const [tasksRes, outreachRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("id,title,description,due_date,status,priority,lead_id")
          .eq("organization_id", organization.id)
          .not("due_date", "is", null)
          .gte("due_date", monthStart.toISOString())
          .lte("due_date", monthEnd.toISOString())
          .order("due_date", { ascending: true }),
        supabase
          .from("messages")
          .select("id,subject,content,status,created_at,lead_id,type")
          .eq("organization_id", organization.id)
          .gte("created_at", monthStart.toISOString())
          .lte("created_at", monthEnd.toISOString())
          .order("created_at", { ascending: true }),
      ]);
      if (cancelled) return;
      if (tasksRes.error) {
        console.warn("calendar tasks load failed", tasksRes.error);
        setTasks([]);
      } else {
        setTasks((tasksRes.data ?? []) as CalendarTask[]);
      }
      if (outreachRes.error) {
        console.warn("calendar outreach load failed", outreachRes.error);
        setOutreach([]);
      } else {
        setOutreach((outreachRes.data ?? []) as CalendarOutreach[]);
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

  const outreachByDay = useMemo(() => {
    const map = new Map<number, CalendarOutreach[]>();
    for (const o of outreach) {
      const d = new Date(o.created_at).getDate();
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(o);
    }
    return map;
  }, [outreach]);

  // Default selected day = today if viewing current month, else first of month
  useEffect(() => {
    setSelectedDay(isCurrentMonth ? todayDay : 1);
  }, [cursor, isCurrentMonth, todayDay]);

  const activeDay = selectedDay ?? (isCurrentMonth ? todayDay : 1);
  const dayTasks = tasksByDay.get(activeDay) ?? [];
  const dayOutreach = outreachByDay.get(activeDay) ?? [];

  const monthLabel = cursor.toLocaleString("en-US", { month: "long", year: "numeric" });
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const firstWeekday = monthStart.getDay();

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
    const weekOutreach = outreach.filter((o) => {
      const d = new Date(o.created_at);
      return d >= startOfWeek && d < endOfWeek;
    });
    return {
      booked: weekTasks.length,
      completed: weekTasks.filter((t) => t.status === "done").length,
      pending: weekTasks.filter((t) => t.status === "todo").length,
      outreach: weekOutreach.length,
    };
  }, [tasks, outreach, today]);

  const openNewTaskForDay = (day: number) => {
    const d = new Date(cursor.getFullYear(), cursor.getMonth(), day, 9, 0, 0, 0);
    setDialogDefaultDate(d);
    setNewTaskOpen(true);
  };

  const selectedDateLabel = new Date(
    cursor.getFullYear(),
    cursor.getMonth(),
    activeDay,
  ).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tasks &amp; outreach scheduled for your team — click any day to add an event
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
              onClick={() => {
                setDialogDefaultDate(
                  new Date(cursor.getFullYear(), cursor.getMonth(), activeDay, 9, 0, 0, 0),
                );
                setNewTaskOpen(true);
              }}
              disabled={!organization?.id}
            >
              <Plus className="h-4 w-4" />
              New Event
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
                  aria-label="Previous month"
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
                    setSelectedDay(d.getDate());
                  }}
                  aria-label="Today"
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
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {daysOfWeek.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstWeekday }, (_, i) => (
                <div key={`empty-${i}`} className="aspect-square rounded-lg" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const cellTasks = tasksByDay.get(day) ?? [];
                const cellOutreach = outreachByDay.get(day) ?? [];
                const totalDots = cellTasks.length + cellOutreach.length;
                const isToday = isCurrentMonth && day === todayDay;
                const isSelected = day === activeDay;
                return (
                  <button
                    type="button"
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    onDoubleClick={() => openNewTaskForDay(day)}
                    className={`aspect-square rounded-lg border p-1.5 text-left text-xs transition-colors hover:border-primary/50 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                      isSelected
                        ? "border-primary bg-primary/15 font-semibold text-primary"
                        : isToday
                          ? "border-primary/60 bg-primary/5 font-bold text-primary"
                          : "border-transparent text-foreground"
                    }`}
                    aria-label={`${day} — ${cellTasks.length} tasks, ${cellOutreach.length} outreach`}
                  >
                    <span>{day}</span>
                    {totalDots > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-0.5">
                        {cellTasks.slice(0, 3).map((t) => (
                          <div
                            key={t.id}
                            className={`h-1.5 w-1.5 rounded-full ${priorityColor(t.priority)}`}
                          />
                        ))}
                        {cellOutreach.slice(0, 2).map((o) => (
                          <div key={o.id} className="h-1.5 w-1.5 rounded-full bg-primary" />
                        ))}
                        {totalDots > 5 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{totalDots - 5}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" /> High priority task
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" /> Medium task
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" /> Low task
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Outreach email
              </span>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{selectedDateLabel}</h3>
                  <p className="text-[11px] text-muted-foreground">
                    {dayTasks.length} task{dayTasks.length === 1 ? "" : "s"} · {dayOutreach.length}{" "}
                    outreach
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => openNewTaskForDay(activeDay)}
                  disabled={!organization?.id}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : dayTasks.length === 0 && dayOutreach.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center">
                  <p className="text-xs text-muted-foreground">Nothing scheduled.</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-xs"
                    onClick={() => openNewTaskForDay(activeDay)}
                    disabled={!organization?.id}
                  >
                    Schedule something
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {dayTasks.map((t) => (
                    <div key={t.id} className="rounded-lg border border-border bg-muted/50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(t.due_date).toLocaleString(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                            <span
                              className={`ml-1 h-1.5 w-1.5 rounded-full ${priorityColor(t.priority)}`}
                            />
                            <span className="capitalize">{t.priority}</span>
                          </div>
                        </div>
                        <Badge
                          variant={t.status === "done" ? "default" : "secondary"}
                          className="shrink-0 text-xs"
                        >
                          {t.status.replace("_", " ")}
                        </Badge>
                      </div>
                      {isOwner && t.status !== "done" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 w-full gap-2 text-xs"
                          onClick={() => handleCompleteWithAi(t.id)}
                          disabled={completingId === t.id}
                        >
                          {completingId === t.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          {completingId === t.id ? "AI working…" : "Complete with AI"}
                        </Button>
                      )}
                    </div>
                  ))}

                  {dayOutreach.map((o) => (
                    <div
                      key={o.id}
                      className="rounded-lg border border-primary/30 bg-primary/5 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                            <Mail className="h-3.5 w-3.5 text-primary" />
                            {o.subject || "Outreach email"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(o.created_at).toLocaleString(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-xs capitalize">
                          {o.status}
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
                  { label: "Pending", value: weekStats.pending },
                  { label: "Outreach", value: weekStats.outreach },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <p className="text-lg font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
              <h3 className="text-sm font-semibold text-foreground">Connected to outreach</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Every email sent from a lead drawer or auto-outreach run shows up here
                automatically. Click any day to add a task or call —{" "}
                <span className="font-semibold">Complete with AI</span> drafts and sends the
                follow-up email in one click.
              </p>
            </div>
          </div>
        </div>
      </div>
      {organization?.id && (
        <NewTaskDialog
          open={newTaskOpen}
          onOpenChange={(o) => {
            setNewTaskOpen(o);
            if (!o) setDialogDefaultDate(undefined);
          }}
          organizationId={organization.id}
          defaultDate={dialogDefaultDate}
          onCreated={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
