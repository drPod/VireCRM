import { Bot, Instagram, Mail, MessageCircle, MessageSquare, Sparkles } from "lucide-react";

const THREADS = [
  {
    name: "Sarah Chen",
    company: "Apex Logistics",
    channel: "SMS",
    icon: MessageSquare,
    preview: "Yes, Friday 2pm works — send the calendar invite.",
    time: "2m",
    unread: 2,
    active: true,
  },
  {
    name: "Marcus Webb",
    company: "Northwind Energy",
    channel: "Email",
    icon: Mail,
    preview: "Pricing looks good. One question on the white-label terms…",
    time: "12m",
    unread: 1,
    active: false,
  },
  {
    name: "Priya Patel",
    company: "BlueRiver Tech",
    channel: "WhatsApp",
    icon: MessageCircle,
    preview: "Could you re-share the case study from last week?",
    time: "1h",
    unread: 0,
    active: false,
  },
  {
    name: "Helix DM",
    company: "Helix Manufacturing",
    channel: "Instagram",
    icon: Instagram,
    preview: "Saw your post. Open to a quick call?",
    time: "3h",
    unread: 0,
    active: false,
  },
];

export function InboxMock() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-0 divide-x divide-border/60">
      <ul className="space-y-1 p-3">
        {THREADS.map((t) => (
          <li
            key={t.name}
            className={`rounded-lg border px-3 py-2.5 transition-colors ${
              t.active
                ? "border-primary/40 bg-primary/8"
                : "border-transparent hover:border-border/60 hover:bg-card/60"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    t.active ? "bg-primary/15 text-primary" : "bg-muted/60 text-muted-foreground"
                  }`}
                >
                  <t.icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">{t.name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{t.company}</p>
                </div>
              </div>
              <span className="shrink-0 text-[10px] text-muted-foreground">{t.time}</span>
            </div>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">{t.preview}</p>
            <div className="mt-1 flex items-center justify-between">
              <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                {t.channel}
              </span>
              {t.unread > 0 ? (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground">
                  {t.unread}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Sarah Chen</p>
            <p className="text-[10px] text-muted-foreground">SMS · Apex Logistics</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
            <Sparkles className="h-3 w-3" /> Hot · 94
          </span>
        </div>
        <div className="flex-1 space-y-3 p-4">
          <Bubble side="them" text="Quick — does the energy rate quote still hold?" />
          <Bubble side="me" text="Yes — locked through Friday at 4pm." muted />
          <Bubble side="them" text="Yes, Friday 2pm works — send the calendar invite." />
        </div>
        <div className="border-t border-border/60 p-3">
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/8 px-3 py-2 text-xs">
            <Bot className="h-3.5 w-3.5 text-primary" />
            <span className="flex-1 text-foreground">
              AI drafted: <span className="text-muted-foreground">"Locking in Friday 2pm.
              Invite incoming…"</span>
            </span>
            <span className="rounded-md border border-primary/30 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              Send
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({ side, text, muted = false }: { side: "me" | "them"; text: string; muted?: boolean }) {
  const isMe = side === "me";
  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
          isMe
            ? muted
              ? "bg-muted/50 text-foreground"
              : "bg-primary text-primary-foreground"
            : "bg-card border border-border/60 text-foreground"
        }`}
      >
        {text}
      </div>
    </div>
  );
}
