import { Bot, CheckCircle2, Clock, Mail, MessageSquare, Phone } from "lucide-react";

const SEQUENCE = [
  {
    channel: "Email",
    icon: Mail,
    when: "Day 0 · 12s after form submit",
    state: "sent" as const,
    preview:
      "Hi Sarah — saw you grabbed the energy savings guide. Want me to send over the 3 plans that match your zip?",
  },
  {
    channel: "SMS",
    icon: MessageSquare,
    when: "Day 1 · 9:08 AM",
    state: "sent" as const,
    preview: "Quick nudge — the rate I quoted holds until Friday. Want to lock it in?",
  },
  {
    channel: "Call task",
    icon: Phone,
    when: "Day 3 · routed to Marcus",
    state: "scheduled" as const,
    preview: "Hand-off only — AI confirmed reply intent score 0.82",
  },
];

export function FollowUpMock() {
  return (
    <div className="space-y-3 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sequence — Energy / Warm leads
          </p>
          <p className="mt-1 text-base font-semibold text-foreground">Sarah Chen · Apex Logistics</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
          <Bot className="h-3 w-3" /> AI on autopilot
        </span>
      </div>

      <ol className="relative space-y-2 border-l border-border/70 pl-5">
        {SEQUENCE.map((step) => (
          <li key={step.channel} className="relative">
            <span
              aria-hidden="true"
              className={`absolute -left-[27px] top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                step.state === "sent"
                  ? "border-success/50 bg-success/15 text-success"
                  : "border-primary/40 bg-primary/10 text-primary"
              }`}
            >
              <step.icon className="h-2.5 w-2.5" />
            </span>
            <div className="rounded-lg border border-border/60 bg-card/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{step.channel}</p>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {step.when}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{step.preview}</p>
              <div className="mt-2 flex items-center gap-1 text-[10px] uppercase tracking-wide">
                {step.state === "sent" ? (
                  <span className="inline-flex items-center gap-1 text-success">
                    <CheckCircle2 className="h-3 w-3" /> Delivered
                  </span>
                ) : (
                  <span className="text-primary">Scheduled</span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-3 gap-2 pt-1">
        <Stat label="Reply rate" value="38%" />
        <Stat label="Avg follow-ups" value="2.4" />
        <Stat label="Time to first send" value="12s" />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-bold text-foreground">{value}</p>
    </div>
  );
}
