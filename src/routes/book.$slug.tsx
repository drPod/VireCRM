import { createFileRoute, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getPublicCalendarFn,
  getAvailableSlotsFn,
  bookPublicAppointmentFn,
  verifyCalendarPasswordFn,
  type PublicCalendar,
} from "@/functions/appointments.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarDays,
  Loader2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/book/$slug")({
  component: PublicBookingPage,
  head: () => ({
    meta: [
      { title: "Book a meeting" },
      { name: "description", content: "Pick a time that works for you" },
    ],
  }),
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function PublicBookingPage() {
  const { slug } = useParams({ from: "/book/$slug" });
  const [calendar, setCalendar] = useState<PublicCalendar | null>(null);
  const [loadingCal, setLoadingCal] = useState(true);
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  });
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{ starts_at: string; ends_at: string } | null>(null);

  // Password gate
  const [passwordInput, setPasswordInput] = useState("");
  const [unlockedPassword, setUnlockedPassword] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const userTz = useMemo(
    () => (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC"),
    [],
  );

  // Load calendar
  useEffect(() => {
    setLoadingCal(true);
    getPublicCalendarFn({ data: { slug } })
      .then((c) => setCalendar(c))
      .catch(() => setCalendar(null))
      .finally(() => setLoadingCal(false));
  }, [slug]);

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + 7);
    return d;
  }, [weekStart]);

  const isLocked = !!calendar?.requires_password && !unlockedPassword;

  const loadSlots = useCallback(async () => {
    if (!calendar) return;
    if (calendar.requires_password && !unlockedPassword) return;
    setLoadingSlots(true);
    try {
      const res = await getAvailableSlotsFn({
        data: {
          calendarId: calendar.id,
          from: weekStart.toISOString(),
          to: weekEnd.toISOString(),
          password: unlockedPassword || undefined,
        },
      });
      setSlots(res.slots);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [calendar, weekStart, weekEnd, unlockedPassword]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  // Group slots by the viewer's local day
  const slotsByDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setUTCDate(d.getUTCDate() + i);
      map.set(d.toISOString().slice(0, 10), []);
    }
    for (const s of slots) {
      const key = s.slice(0, 10);
      const list = map.get(key);
      if (list) list.push(s);
    }
    return map;
  }, [slots, weekStart]);

  // Auto-select first day with availability when slots change
  useEffect(() => {
    if (selectedDay && slotsByDay.get(selectedDay)?.length) return;
    const firstWith = Array.from(slotsByDay.entries()).find(([, v]) => v.length > 0);
    setSelectedDay(firstWith ? firstWith[0] : null);
  }, [slotsByDay, selectedDay]);

  const handleUnlock = async () => {
    if (!calendar || !passwordInput.trim()) return;
    setVerifying(true);
    try {
      await verifyCalendarPasswordFn({
        data: { calendarId: calendar.id, password: passwordInput.trim() },
      });
      setUnlockedPassword(passwordInput.trim());
      setPasswordInput("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Incorrect password");
    } finally {
      setVerifying(false);
    }
  };

  const validateForm = () => {
    const next: { name?: string; email?: string } = {};
    if (!form.name.trim()) next.name = "Please enter your name";
    if (!form.email.trim()) next.email = "Please enter your email";
    else if (!EMAIL_RE.test(form.email.trim())) next.email = "That email looks invalid";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleBook = async () => {
    if (!calendar || !selectedSlot) return;
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const res = await bookPublicAppointmentFn({
        data: {
          calendarId: calendar.id,
          starts_at: selectedSlot,
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          notes: form.notes.trim() || undefined,
          password: unlockedPassword || undefined,
        },
      });
      setConfirmed({ starts_at: res.starts_at, ends_at: res.ends_at });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Booking failed");
      void loadSlots();
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingCal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!calendar) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h1 className="text-xl font-semibold">Booking link unavailable</h1>
          <p className="text-sm text-muted-foreground mt-2">
            This calendar may have been disabled or the link may be incorrect. Reach out to the
            person who shared the link with you.
          </p>
        </Card>
      </div>
    );
  }

  if (confirmed) {
    const start = new Date(confirmed.starts_at);
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">You're booked!</h1>
            <p className="text-sm text-muted-foreground">
              {start.toLocaleString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            A confirmation has been sent to your email.
          </p>
        </Card>
      </div>
    );
  }

  const goPrevWeek = () => {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() - 7);
    if (d.getTime() < new Date().setUTCHours(0, 0, 0, 0)) return;
    setWeekStart(d);
    setSelectedSlot(null);
    setSelectedDay(null);
  };
  const goNextWeek = () => {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + 7);
    setWeekStart(d);
    setSelectedSlot(null);
    setSelectedDay(null);
  };

  const canGoPrev = weekStart.getTime() > new Date().setUTCHours(0, 0, 0, 0);
  const daysList = Array.from(slotsByDay.entries());
  const activeDaySlots = selectedDay ? slotsByDay.get(selectedDay) || [] : [];

  return (
    <div className="min-h-screen bg-background py-6 px-4 sm:py-10">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-3">
            {calendar.brand_logo ? (
              <img
                src={calendar.brand_logo}
                alt={calendar.organization_name}
                className="h-11 w-11 rounded-lg object-contain"
              />
            ) : (
              <span
                className="flex h-11 w-11 items-center justify-center rounded-lg text-lg font-bold text-primary-foreground"
                style={{ background: calendar.color || "var(--primary)" }}
              >
                {calendar.organization_name.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{calendar.organization_name}</p>
              <h1 className="text-lg sm:text-xl font-semibold truncate">{calendar.name}</h1>
              <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {calendar.slot_duration_minutes} minutes
                </span>
                <span aria-hidden>·</span>
                <span className="truncate">{userTz}</span>
                {calendar.requires_password && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Private
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
        </Card>

        {/* Password gate */}
        {isLocked ? (
          <Card className="p-6 space-y-3 max-w-md mx-auto">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Password required</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              This booking link is private. Enter the password you were given to see available
              times.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleUnlock();
              }}
              className="space-y-3"
            >
              <Input
                type="password"
                autoFocus
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Access password"
              />
              <Button
                type="submit"
                variant="command"
                disabled={verifying || !passwordInput.trim()}
                className="w-full"
              >
                {verifying && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Unlock
              </Button>
            </form>
          </Card>
        ) : (
          <>
            {/* Slot picker */}
            <Card className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Pick a time</h2>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={goPrevWeek}
                    disabled={!canGoPrev}
                    aria-label="Previous week"
                    className="h-8 w-8"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground min-w-[110px] text-center tabular-nums">
                    {weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} —{" "}
                    {new Date(weekEnd.getTime() - 1).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={goNextWeek}
                    aria-label="Next week"
                    className="h-8 w-8"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {loadingSlots ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : slots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CalendarDays className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">No available times this week</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Try the next week using the arrows above.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Day strip — horizontal scroll on mobile, even row on desktop */}
                  <div className="-mx-1 overflow-x-auto">
                    <div className="flex gap-1.5 px-1 sm:grid sm:grid-cols-7 sm:gap-2">
                      {daysList.map(([day, daySlots]) => {
                        const date = new Date(`${day}T00:00:00Z`);
                        const isActive = selectedDay === day;
                        const hasSlots = daySlots.length > 0;
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => hasSlots && setSelectedDay(day)}
                            disabled={!hasSlots}
                            className={`flex shrink-0 flex-col items-center rounded-lg border px-3 py-2 transition-colors min-w-[64px] sm:min-w-0 ${
                              isActive
                                ? "border-primary bg-primary/10 text-foreground"
                                : hasSlots
                                  ? "border-border hover:bg-secondary text-foreground"
                                  : "border-border/50 text-muted-foreground/60 cursor-not-allowed"
                            }`}
                          >
                            <span className="text-[10px] uppercase tracking-wide">
                              {date.toLocaleDateString(undefined, { weekday: "short" })}
                            </span>
                            <span className="text-base font-semibold tabular-nums">
                              {date.getUTCDate()}
                            </span>
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              {hasSlots
                                ? `${daySlots.length} slot${daySlots.length > 1 ? "s" : ""}`
                                : "—"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Time grid for selected day */}
                  {selectedDay && activeDaySlots.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {new Date(`${selectedDay}T00:00:00Z`).toLocaleDateString(undefined, {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                        {activeDaySlots.map((s) => {
                          const isSelected = selectedSlot === s;
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setSelectedSlot(s)}
                              className={`rounded-md border px-2 py-2 text-sm transition-colors tabular-nums ${
                                isSelected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border hover:bg-secondary"
                              }`}
                            >
                              {new Date(s).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Booking form */}
            {selectedSlot && (
              <Card className="p-4 sm:p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold">Your details</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Booking{" "}
                      <span className="font-medium text-foreground">
                        {new Date(selectedSlot).toLocaleString(undefined, {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedSlot(null)}
                    className="h-8 -mt-1"
                  >
                    <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                    Change
                  </Button>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="bk-name">Name</Label>
                    <Input
                      id="bk-name"
                      value={form.name}
                      onChange={(e) => {
                        setForm({ ...form, name: e.target.value });
                        if (errors.name) setErrors({ ...errors, name: undefined });
                      }}
                      placeholder="Jane Doe"
                      aria-invalid={!!errors.name}
                    />
                    {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bk-email">Email</Label>
                    <Input
                      id="bk-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => {
                        setForm({ ...form, email: e.target.value });
                        if (errors.email) setErrors({ ...errors, email: undefined });
                      }}
                      placeholder="jane@company.com"
                      aria-invalid={!!errors.email}
                    />
                    {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bk-phone">
                    Phone <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="bk-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+1 555 123 4567"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bk-notes">
                    What would you like to discuss?{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Textarea
                    id="bk-notes"
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="A short context helps us prepare."
                  />
                </div>
                <Button
                  variant="command"
                  onClick={handleBook}
                  disabled={submitting}
                  className="w-full"
                  size="lg"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Confirm booking
                </Button>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
