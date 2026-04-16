import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  Video,
  MapPin,
  User,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Copy,
} from "lucide-react";

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarPage,
  head: () => ({
    meta: [
      { title: "Vireon — Calendar" },
      { name: "description", content: "Appointment booking and calendar management" },
    ],
  }),
});

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const demoAppointments = [
  {
    id: "1",
    title: "Discovery Call — Sarah Chen",
    time: "9:00 AM – 9:30 AM",
    type: "video" as const,
    status: "confirmed" as const,
    lead: "Sarah Chen",
    company: "TechCorp",
    day: 16,
  },
  {
    id: "2",
    title: "Demo — Marcus Williams",
    time: "11:00 AM – 12:00 PM",
    type: "video" as const,
    status: "confirmed" as const,
    lead: "Marcus Williams",
    company: "Digital Growth Agency",
    day: 16,
  },
  {
    id: "3",
    title: "Follow-up — Jessica Torres",
    time: "2:00 PM – 2:30 PM",
    type: "phone" as const,
    status: "pending" as const,
    lead: "Jessica Torres",
    company: "ScaleUp Inc",
    day: 17,
  },
  {
    id: "4",
    title: "Onboarding — Alex Rivera",
    time: "10:00 AM – 11:00 AM",
    type: "in-person" as const,
    status: "confirmed" as const,
    lead: "Alex Rivera",
    company: "Velocity Sales",
    day: 18,
  },
];

const bookingLinks = [
  { name: "Discovery Call", duration: "30 min", link: "vireon.app/book/discovery", bookings: 47 },
  { name: "Product Demo", duration: "60 min", link: "vireon.app/book/demo", bookings: 23 },
  { name: "Strategy Session", duration: "45 min", link: "vireon.app/book/strategy", bookings: 12 },
];

function CalendarPage() {
  const today = 16;

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage appointments, booking links, and availability
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Share Booking Page
            </Button>
            <Button variant="command" className="gap-2">
              <Plus className="h-4 w-4" />
              New Appointment
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Calendar Grid */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
            {/* Month nav */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">April 2026</h2>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {daysOfWeek.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for offset (April 2026 starts on Wednesday) */}
              {[0, 1].map((i) => (
                <div key={`empty-${i}`} className="aspect-square rounded-lg" />
              ))}
              {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => {
                const hasAppt = demoAppointments.some((a) => a.day === day);
                const isToday = day === today;
                return (
                  <div
                    key={day}
                    className={`aspect-square rounded-lg border p-1.5 text-xs transition-colors cursor-pointer hover:border-primary/30 ${
                      isToday
                        ? "border-primary bg-primary/10 font-bold text-primary"
                        : "border-transparent text-foreground"
                    }`}
                  >
                    <span>{day}</span>
                    {hasAppt && (
                      <div className="mt-0.5 flex gap-0.5">
                        {demoAppointments
                          .filter((a) => a.day === day)
                          .map((a) => (
                            <div
                              key={a.id}
                              className={`h-1.5 w-1.5 rounded-full ${
                                a.status === "confirmed" ? "bg-success" : "bg-warning"
                              }`}
                            />
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Today's appointments */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Today's Appointments</h3>
              <div className="space-y-3">
                {demoAppointments
                  .filter((a) => a.day === today)
                  .map((appt) => (
                    <div
                      key={appt.id}
                      className="rounded-lg border border-border bg-muted/50 p-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{appt.title}</p>
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {appt.time}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            {appt.type === "video" ? (
                              <Video className="h-3 w-3" />
                            ) : appt.type === "in-person" ? (
                              <MapPin className="h-3 w-3" />
                            ) : (
                              <User className="h-3 w-3" />
                            )}
                            {appt.company}
                          </div>
                        </div>
                        <Badge variant={appt.status === "confirmed" ? "default" : "secondary"} className="text-xs">
                          {appt.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Booking Links */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Booking Links</h3>
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  <Plus className="h-3 w-3" /> New
                </Button>
              </div>
              <div className="space-y-3">
                {bookingLinks.map((link) => (
                  <div key={link.name} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{link.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {link.duration} · {link.bookings} bookings
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="mt-1 truncate text-xs text-primary">{link.link}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">This Week</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Booked", value: "12" },
                  { label: "Completed", value: "8" },
                  { label: "No-shows", value: "1" },
                  { label: "Pending", value: "3" },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <p className="text-lg font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
