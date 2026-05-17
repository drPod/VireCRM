import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import {
  listCalendarsFn,
  upsertCalendarFn,
  deleteCalendarFn,
  listAppointmentsFn,
  cancelAppointmentFn,
  type CalendarRow,
  type AppointmentRow,
  type Availability,
  type Weekday,
} from "@/functions/appointments.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  CalendarDays,
  Plus,
  Loader2,
  Copy,
  Trash2,
  ExternalLink,
  Clock,
  Users,
  X,
  Lock,
  Power,
  PowerOff,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/appointments")({
  component: AppointmentsPage,
  head: () => ({
    meta: [
      { title: "Majix — Appointments" },
      { name: "description", content: "Calendars, availability, and bookings" },
    ],
  }),
});

const WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

function defaultAvailability(): Availability {
  const win = () => ({ id: crypto.randomUUID(), start: "09:00", end: "17:00" });
  return {
    mon: [win()],
    tue: [win()],
    wed: [win()],
    thu: [win()],
    fri: [win()],
    sat: [],
    sun: [],
  };
}

function AppointmentsPage() {
  const { organization } = useAuth();
  const orgId = organization?.id;

  const listCals = useAuthedServerFn(listCalendarsFn);
  const upsertCal = useAuthedServerFn(upsertCalendarFn);
  const deleteCal = useAuthedServerFn(deleteCalendarFn);
  const listAppts = useAuthedServerFn(listAppointmentsFn);
  const cancelAppt = useAuthedServerFn(cancelAppointmentFn);

  const [calendars, setCalendars] = useState<CalendarRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorState, setEditorState] = useState<
    (Partial<CalendarRow> & { access_password?: string; clear_password?: boolean }) | null
  >(null);

  const refresh = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [cals, appts] = await Promise.all([
        listCals({ data: { organizationId: orgId } }),
        listAppts({ data: { organizationId: orgId } }),
      ]);
      setCalendars(cals);
      setAppointments(appts);
      if (!selectedId && cals.length) setSelectedId(cals[0].id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [orgId, listCals, listAppts, selectedId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = useMemo(
    () => calendars.find((c) => c.id === selectedId) || null,
    [calendars, selectedId],
  );

  const calAppointments = useMemo(
    () => (selected ? appointments.filter((a) => a.calendar_id === selected.id) : []),
    [appointments, selected],
  );

  const upcoming = useMemo(
    () =>
      calAppointments.filter(
        (a) => a.status !== "cancelled" && new Date(a.starts_at).getTime() >= Date.now(),
      ),
    [calAppointments],
  );

  const past = useMemo(
    () =>
      calAppointments.filter(
        (a) => a.status === "cancelled" || new Date(a.starts_at).getTime() < Date.now(),
      ),
    [calAppointments],
  );

  const openNew = () => {
    setEditorState({
      name: "30-minute meeting",
      slug: `book-${Math.random().toString(36).slice(2, 7)}`,
      color: "#a855f7",
      slot_duration_minutes: 30,
      buffer_minutes: 0,
      is_active: true,
      availability: defaultAvailability(),
    });
    setEditorOpen(true);
  };

  const openEdit = (cal: CalendarRow) => {
    setEditorState({ ...cal });
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!orgId || !editorState) return;
    if (!editorState.name || !editorState.slug) {
      toast.error("Name and slug are required");
      return;
    }
    try {
      // access_password rules:
      //   - undefined → leave existing password unchanged
      //   - clear_password set → empty string clears it
      //   - non-empty string → set/replace
      let access_password: string | undefined;
      if (editorState.clear_password) {
        access_password = "";
      } else if (editorState.access_password && editorState.access_password.length > 0) {
        access_password = editorState.access_password;
      }
      await upsertCal({
        data: {
          organizationId: orgId,
          id: editorState.id,
          name: editorState.name,
          slug: editorState.slug,
          color: editorState.color || null,
          is_active: editorState.is_active ?? true,
          slot_duration_minutes: editorState.slot_duration_minutes ?? 30,
          buffer_minutes: editorState.buffer_minutes ?? 0,
          availability: (editorState.availability as Availability) || defaultAvailability(),
          access_password,
        },
      });
      toast.success("Calendar saved");
      setEditorOpen(false);
      setEditorState(null);
      void refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const handleDelete = async (cal: CalendarRow) => {
    if (!orgId) return;
    if (!confirm(`Delete "${cal.name}"? Existing bookings stay but the link stops working.`))
      return;
    try {
      await deleteCal({ data: { organizationId: orgId, id: cal.id } });
      if (selectedId === cal.id) setSelectedId(null);
      void refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const handleCancel = async (a: AppointmentRow) => {
    if (!orgId) return;
    if (!confirm(`Cancel appointment "${a.title}"?`)) return;
    try {
      await cancelAppt({ data: { organizationId: orgId, id: a.id } });
      void refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const handleToggleActive = async (cal: CalendarRow) => {
    if (!orgId) return;
    try {
      await upsertCal({
        data: {
          organizationId: orgId,
          id: cal.id,
          name: cal.name,
          slug: cal.slug,
          color: cal.color,
          is_active: !cal.is_active,
          slot_duration_minutes: cal.slot_duration_minutes,
          buffer_minutes: cal.buffer_minutes,
          availability: cal.availability,
        },
      });
      toast.success(cal.is_active ? "Booking link disabled" : "Booking link enabled");
      void refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const bookingUrl = (slug: string) =>
    `${typeof window !== "undefined" ? window.location.origin : ""}/book/${slug}`;

  const copyLink = (slug: string) => {
    if (typeof navigator === "undefined") return;
    void navigator.clipboard.writeText(bookingUrl(slug));
    toast.success("Booking link copied");
  };

  const updateAvailabilityDay = (day: Weekday, windows: { start: string; end: string }[]) => {
    setEditorState((prev) =>
      prev
        ? {
            ...prev,
            availability: {
              ...((prev.availability as Availability) || defaultAvailability()),
              [day]: windows,
            },
          }
        : prev,
    );
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 p-4">
      {/* Calendars list */}
      <Card className="w-72 shrink-0 flex flex-col p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Calendars
          </h2>
          <Button size="sm" variant="command" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> New
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
            </div>
          ) : calendars.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8 px-2">
              Create your first calendar to share a booking link with leads.
            </p>
          ) : (
            calendars.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full text-left rounded-lg border p-2.5 transition-colors ${
                  selectedId === c.id
                    ? "border-primary/60 bg-primary/5"
                    : "border-border hover:bg-secondary/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ background: c.color || "var(--primary)" }}
                  />
                  <span className="text-sm font-medium truncate flex-1">{c.name}</span>
                  {!c.is_active && (
                    <Badge variant="secondary" className="text-[10px]">
                      Off
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground truncate">
                  {c.slot_duration_minutes}m · /book/{c.slug}
                </p>
              </button>
            ))
          )}
        </div>
      </Card>

      {/* Detail */}
      <div className="flex-1 min-w-0 overflow-y-auto space-y-4">
        {!selected ? (
          <Card className="p-12 text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-semibold">Pick or create a calendar</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Each calendar has its own availability rules and a public booking link your leads can
              use to schedule a meeting.
            </p>
          </Card>
        ) : (
          <>
            {/* Header */}
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: selected.color || "var(--primary)" }}
                    />
                    <h1 className="text-lg font-semibold truncate">{selected.name}</h1>
                    <Badge variant={selected.is_active ? "default" : "secondary"}>
                      {selected.is_active ? "Active" : "Disabled"}
                    </Badge>
                    {selected.has_access_password && (
                      <Badge variant="outline" className="gap-1 border-warning text-warning">
                        <Lock className="h-3 w-3" /> Password
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      <Clock className="inline h-3 w-3 mr-1" />
                      {selected.slot_duration_minutes}-minute slots
                      {selected.buffer_minutes > 0 && ` · ${selected.buffer_minutes}m buffer`}
                    </span>
                    <span>·</span>
                    <code className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">
                      /book/{selected.slug}
                    </code>
                    {!selected.is_active && (
                      <span className="text-warning">
                        · link rejects new bookings until re-enabled
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant={selected.is_active ? "outline" : "command"}
                    onClick={() => handleToggleActive(selected)}
                    title={selected.is_active ? "Disable booking link" : "Enable booking link"}
                  >
                    {selected.is_active ? (
                      <>
                        <PowerOff className="h-3.5 w-3.5" /> Disable
                      </>
                    ) : (
                      <>
                        <Power className="h-3.5 w-3.5" /> Enable
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyLink(selected.slug)}
                    disabled={!selected.is_active}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy link
                  </Button>
                  <a
                    href={bookingUrl(selected.slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Preview
                  </a>
                  <Button size="sm" variant="outline" onClick={() => openEdit(selected)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(selected)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>

            {/* Upcoming bookings */}
            <Card className="p-4 space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Upcoming bookings ({upcoming.length})
              </h2>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No upcoming bookings yet. Share your link to start collecting them.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {upcoming.map((a) => (
                    <BookingRow key={a.id} appt={a} onCancel={() => handleCancel(a)} />
                  ))}
                </div>
              )}
            </Card>

            {/* Past / cancelled */}
            {past.length > 0 && (
              <Card className="p-4 space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground">
                  Past & cancelled ({past.length})
                </h2>
                <div className="space-y-1.5 opacity-75">
                  {past.slice(0, 30).map((a) => (
                    <BookingRow key={a.id} appt={a} muted />
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Editor */}
      <Dialog open={editorOpen} onOpenChange={(v) => !v && setEditorOpen(false)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editorState?.id ? "Edit calendar" : "New calendar"}</DialogTitle>
            <DialogDescription>
              Set the slot length, weekly availability, and a slug used in the public booking link.
            </DialogDescription>
          </DialogHeader>
          {editorState && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={editorState.name || ""}
                    onChange={(e) => setEditorState({ ...editorState, name: e.target.value })}
                    placeholder="30-minute intro call"
                  />
                </div>
                <div>
                  <Label>Slug (URL)</Label>
                  <Input
                    value={editorState.slug || ""}
                    onChange={(e) =>
                      setEditorState({
                        ...editorState,
                        slug: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, "-")
                          .replace(/-+/g, "-"),
                      })
                    }
                    placeholder="intro-call"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Slot duration (min)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={480}
                    value={editorState.slot_duration_minutes || 30}
                    onChange={(e) =>
                      setEditorState({
                        ...editorState,
                        slot_duration_minutes: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Buffer (min)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={240}
                    value={editorState.buffer_minutes || 0}
                    onChange={(e) =>
                      setEditorState({
                        ...editorState,
                        buffer_minutes: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Color</Label>
                  <Input
                    type="color"
                    value={editorState.color || "#a855f7"}
                    onChange={(e) => setEditorState({ ...editorState, color: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editorState.is_active ?? true}
                  onCheckedChange={(v) => setEditorState({ ...editorState, is_active: v })}
                />
                <Label>Active (link accepts bookings)</Label>
              </div>

              {/* Access password */}
              <div className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label className="flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5" /> Access password (optional)
                    </Label>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      When set, visitors must enter this password before they can see slots or book.{" "}
                      {editorState.id && editorState.has_access_password
                        ? "A password is currently set."
                        : "No password is currently set."}
                    </p>
                  </div>
                  {editorState.id && editorState.has_access_password && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setEditorState({
                          ...editorState,
                          clear_password: !editorState.clear_password,
                          access_password: "",
                        })
                      }
                    >
                      {editorState.clear_password ? "Keep password" : "Remove password"}
                    </Button>
                  )}
                </div>
                {!editorState.clear_password && (
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={editorState.access_password ?? ""}
                    onChange={(e) =>
                      setEditorState({ ...editorState, access_password: e.target.value })
                    }
                    placeholder={
                      editorState.id && editorState.has_access_password
                        ? "Leave blank to keep current password"
                        : "Type a password to gate this booking link"
                    }
                  />
                )}
                {editorState.clear_password && (
                  <p className="text-[11px] text-warning">
                    Password will be removed on save — link becomes public.
                  </p>
                )}
              </div>

              {/* Availability editor */}
              <div className="space-y-2">
                <Label>Weekly availability (UTC)</Label>
                <div className="space-y-2 rounded-lg border border-border p-3">
                  {WEEKDAYS.map(({ key, label }) => {
                    const windows =
                      ((editorState.availability as Availability) || defaultAvailability())[key] ||
                      [];
                    return (
                      <div key={key} className="flex items-start gap-2">
                        <span className="w-10 pt-1.5 text-xs font-medium text-muted-foreground">
                          {label}
                        </span>
                        <div className="flex-1 space-y-1.5">
                          {windows.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-1.5">Unavailable</p>
                          ) : (
                            windows.map((w, i) => (
                              <div key={w.id} className="flex items-center gap-1.5">
                                <Input
                                  type="time"
                                  value={w.start}
                                  className="h-8 w-24"
                                  onChange={(e) => {
                                    const next = [...windows];
                                    next[i] = { ...next[i], start: e.target.value };
                                    updateAvailabilityDay(key, next);
                                  }}
                                />
                                <span className="text-xs text-muted-foreground">to</span>
                                <Input
                                  type="time"
                                  value={w.end}
                                  className="h-8 w-24"
                                  onChange={(e) => {
                                    const next = [...windows];
                                    next[i] = { ...next[i], end: e.target.value };
                                    updateAvailabilityDay(key, next);
                                  }}
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={() =>
                                    updateAvailabilityDay(
                                      key,
                                      windows.filter((win) => win.id !== w.id),
                                    )
                                  }
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            onClick={() =>
                              updateAvailabilityDay(key, [
                                ...windows,
                                { id: crypto.randomUUID(), start: "09:00", end: "17:00" },
                              ])
                            }
                          >
                            <Plus className="h-3 w-3 mr-1" /> Add window
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Times are in UTC. Slots fall on the slot duration grid within each window.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button variant="command" onClick={handleSave}>
              Save calendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BookingRow({
  appt,
  onCancel,
  muted,
}: {
  appt: AppointmentRow;
  onCancel?: () => void;
  muted?: boolean;
}) {
  const start = new Date(appt.starts_at);
  const end = new Date(appt.ends_at);
  return (
    <div
      className={`flex items-center justify-between rounded-lg border border-border p-2.5 text-sm ${
        muted ? "" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{appt.title}</p>
        <p className="text-[11px] text-muted-foreground truncate">
          {start.toLocaleString()} —{" "}
          {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          {appt.lead?.email && ` · ${appt.lead.email}`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge
          variant={
            appt.status === "cancelled"
              ? "secondary"
              : appt.status === "confirmed"
                ? "default"
                : "info"
          }
          className="text-[10px]"
        >
          {appt.status}
        </Badge>
        {onCancel && appt.status !== "cancelled" && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
