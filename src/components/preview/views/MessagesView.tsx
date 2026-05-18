import { useState } from "react";
import {
  Bot,
  Inbox,
  Instagram,
  Mail,
  MessageCircle,
  Paperclip,
  Pause,
  Send,
  Sparkles,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { THREADS, type Channel, type Thread } from "../data/messages";

function ChannelIcon({ channel, className }: { channel: Channel; className?: string }) {
  const Icon =
    channel === "email"
      ? Mail
      : channel === "sms"
        ? MessageCircle
        : channel === "instagram"
          ? Instagram
          : MessageCircle;
  return <Icon className={className ?? "h-3 w-3"} />;
}

function statusBadge(status: Thread["status"]) {
  switch (status) {
    case "hot":
      return { label: "Hot", cls: "bg-[oklch(0.7_0.18_50)]/15 text-[oklch(0.7_0.18_50)]" };
    case "interested":
      return { label: "Interested", cls: "bg-success/15 text-success" };
    case "objection":
      return { label: "Objection", cls: "bg-destructive/10 text-destructive/80" };
    case "out-of-office":
      return { label: "OOO", cls: "bg-muted text-muted-foreground" };
    default:
      return { label: "Neutral", cls: "bg-muted text-muted-foreground" };
  }
}

export function MessagesView() {
  const [activeId, setActiveId] = useState(THREADS[0]?.id ?? "");
  const active = THREADS.find((t) => t.id === activeId) ?? THREADS[0];

  return (
    <div data-tour="messages" className="grid h-[calc(100vh-220px)] min-h-[560px] grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)] scroll-mt-24">
      <Card className="flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Inbox</h3>
            <Badge variant="outline" className="text-[10px]">
              {THREADS.filter((t) => t.unread).length} unread
            </Badge>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {THREADS.map((t) => {
            const isActive = t.id === active.id;
            const status = statusBadge(t.status);
            return (
              <button
                key={t.id}
                type="button"
                data-preview-allow="true"
                onClick={() => setActiveId(t.id)}
                className={`flex w-full flex-col gap-1 border-b border-border/40 px-4 py-3 text-left transition-colors duration-150 ${
                  isActive ? "bg-primary/10" : "hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-[oklch(0.65_0.16_320)]/30 text-[10px] font-semibold text-foreground">
                      {t.initials}
                    </div>
                    <p className={`truncate text-sm ${t.unread ? "font-semibold text-foreground" : "text-foreground/80"}`}>
                      {t.name}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{t.lastTime}</span>
                </div>
                <p className="ml-9 truncate text-xs text-muted-foreground">{t.preview}</p>
                <div className="ml-9 flex items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${status.cls}`}>
                    {status.label}
                  </span>
                  <ChannelIcon channel={t.channel} className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">{t.company}</span>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-[oklch(0.65_0.16_320)]/30 text-xs font-semibold text-foreground">
              {active.initials}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{active.name}</p>
              <p className="text-xs text-muted-foreground">
                {active.company} · {active.channel}
              </p>
            </div>
          </div>
          <TooltipProvider delayDuration={150}>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 cursor-not-allowed opacity-70"
                    aria-disabled="true"
                    onClick={(e) => e.preventDefault()}
                  >
                    <Tag className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Tag</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sign up to triage with custom tags.</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 cursor-not-allowed opacity-70"
                    aria-disabled="true"
                    onClick={(e) => e.preventDefault()}
                  >
                    <Pause className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Pause sequence</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sign up to manage active outreach sequences.</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto bg-muted/10 p-5">
          {active.messages.map((m) => {
            const isYou = m.sender === "you";
            const isAi = m.sender === "ai";
            return (
              <div
                key={m.id}
                className={`flex ${isYou ? "justify-end" : "justify-start"} ${isAi ? "justify-center" : ""}`}
              >
                {isAi ? (
                  <div className="max-w-[80%] rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      <Sparkles className="h-3 w-3" /> AI suggestion
                    </div>
                    <p className="text-xs text-foreground/90">{m.body}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{m.time}</p>
                  </div>
                ) : (
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                      isYou
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-card text-foreground"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                    <p
                      className={`mt-1 text-[10px] ${
                        isYou ? "text-primary-foreground/70" : "text-muted-foreground"
                      }`}
                    >
                      {m.time}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-border/60 p-4">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                <Bot className="h-3 w-3" /> AI drafted reply
              </div>
              <span className="text-[10px] text-muted-foreground">Match your voice · 94%</span>
            </div>
            <p className="text-sm text-foreground">
              Thursday works — locking in 10am ET. I'll loop in our solutions engineer for the integration questions your COO flagged. Calendar invite incoming.
            </p>
            <div className="mt-3 flex items-center justify-between">
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 cursor-not-allowed opacity-70"
                      aria-disabled="true"
                      onClick={(e) => e.preventDefault()}
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Attach</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Sign up to attach proposals + decks.</TooltipContent>
                </Tooltip>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="cursor-not-allowed opacity-70"
                        aria-disabled="true"
                        onClick={(e) => e.preventDefault()}
                      >
                        Regenerate
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Sign up to regenerate AI drafts.</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="command"
                        size="sm"
                        className="gap-1.5 cursor-not-allowed opacity-70"
                        aria-disabled="true"
                        onClick={(e) => e.preventDefault()}
                      >
                        <Send className="h-3.5 w-3.5" />
                        Send
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Sign up to send real replies.</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
