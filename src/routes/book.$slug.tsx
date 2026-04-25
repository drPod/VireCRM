import { createFileRoute, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getPublicCalendarFn,
  getAvailableSlotsFn,
  bookPublicAppointmentFn,
  type PublicCalendar,
} from "@/functions/appointments.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, Loader2, CheckCircle2, ChevronLeft, ChevronRight, Clock } from "lucide-react";
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
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{ starts_at: string; ends_at: string } | null>(null);

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

  const loadSlots = useCallback(async () => {
    if (!calendar) return;
    setLoadingSlots(true);
    try {
      const res = await getAvailableSlotsFn({
        data: {
          calendarId: calendar.id,
          from: weekStart.toISOString(),
          to: weekEnd.toISOString(),
        },
      });
      setSlots(res.slots);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [calendar, weekStart, weekEnd]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

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

  const handleBook = async () => {
    if (!calendar || !selectedSlot) return;
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
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
          <h1 className="text-xl font-semibold">Booking link not found</h1>
          <p className="text-sm text-muted-foreground mt-1">
            This calendar may have been disabled or the link may be incorrect.
          </p>
        </Card>
      </div>
    );
  }

  if (confirmed) {
    const start = new Date(confirmed.starts_at);
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          </div>
          <h1 className="text-xl font-semibold">You're booked!</h1>
          <p className="text-sm text-muted-foreground">
            {start.toLocaleString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            A confirmation has been added to {calendar.organization_name}'s calendar.
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
  };
  const goNextWeek = () => {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + 7);
    setWeekStart(d);
    setSelectedSlot(null);
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <Card className="p-6">
          <div className="flex items-center gap-3">
            {calendar.brand_logo ? (
              <img
                src={calendar.brand_logo}
                alt={calendar.organization_name}
                className="h-10 w-10 rounded-lg object-contain"
              />
            ) : (
              <span
                className="flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold text-white"
                style={{ background: calendar.color || "var(--primary)" }}
              >
                {calendar.organization_name.charAt(0).toUpperCase()}
              </span>
            )}
            <div>
              <p className="text-xs text-muted-foreground">{calendar.organization_name}</p>
              <h1 className="text-xl font-semibold">{calendar.name}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                <Clock className="inline h-3 w-3 mr-1" />
                {calendar.slot_duration_minutes} minutes
              </p>
            </div>
          </div>
        </Card>

        {/* Slot picker */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Pick a time (UTC)</h2>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={goPrevWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} —{" "}
                {new Date(weekEnd.getTime() - 1).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <Button size="sm" variant="ghost" onClick={goNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {loadingSlots ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {Array.from(slotsByDay.entries()).map(([day, daySlots]) => {
                const date = new Date(`${day}T00:00:00Z`);
                return (
                  <div key={day} className="space-y-1">
                    <div className="text-center">
                      <p className="text-[10px] uppercase text-muted-foreground">
                        {date.toLocaleDateString(undefined, { weekday: "short" })}
                      </p>
                      <p className="text-sm font-medium">{date.getUTCDate()}</p>
                    </div>
                    <div className="space-y-1 max-h-80 overflow-y-auto">
                      {daySlots.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground text-center py-2">—</p>
                      ) : (
                        daySlots.map((s) => {
                          const isSelected = selectedSlot === s;
                          return (
                            <button
                              key={s}
                              onClick={() => setSelectedSlot(s)}
                              className={`w-full rounded-md border px-1 py-1.5 text-[11px] transition-colors ${
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
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Booking form */}
        {selectedSlot && (
          <Card className="p-4 space-y-3">
            <h2 className="text-sm font-semibold">Your details</h2>
            <p className="text-xs text-muted-foreground">
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="jane@company.com"
                />
              </div>
            </div>
            <div>
              <Label>Phone (optional)</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>What would you like to discuss? (optional)</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <Button
              variant="command"
              onClick={handleBook}
              disabled={submitting}
              className="w-full"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Confirm booking
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
