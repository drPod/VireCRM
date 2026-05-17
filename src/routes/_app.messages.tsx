import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, Phone, Bot, Loader2, MessageSquare, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

export const Route = createFileRoute("/_app/messages")({
  component: MessagesPage,
  head: () => ({
    meta: [
      { title: "Majix — Messages" },
      { name: "description", content: "View all outreach messages and replies" },
    ],
  }),
});

type MessageType = "email" | "sms" | "ai_generated";
type MessageStatus = "draft" | "sent" | "delivered" | "opened" | "replied" | "bounced";
type Sentiment = "positive" | "negative" | "neutral";

interface MessageRow {
  id: string;
  type: MessageType;
  subject: string | null;
  content: string;
  preview: string;
  status: MessageStatus;
  sentiment: Sentiment | null;
  created_at: string;
  leadId: string | null;
  leadName: string;
  leadCompany: string | null;
}

interface ReplyRow {
  id: string;
  channel: string;
  content: string;
  sentiment: Sentiment | null;
  created_at: string;
}

const typeIcons: Record<MessageType, typeof Mail> = {
  email: Mail,
  sms: Phone,
  ai_generated: Bot,
};

const typeLabels: Record<MessageType, string> = {
  email: "Email",
  sms: "SMS",
  ai_generated: "AI draft",
};

const statusVariants: Record<
  MessageStatus,
  "info" | "secondary" | "success" | "warning" | "destructive"
> = {
  draft: "secondary",
  sent: "secondary",
  delivered: "info",
  opened: "warning",
  replied: "success",
  bounced: "destructive",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function asMessageType(t: string): MessageType {
  return t === "email" || t === "sms" || t === "ai_generated" ? t : "email";
}
function asMessageStatus(s: string): MessageStatus {
  return s === "draft" ||
    s === "sent" ||
    s === "delivered" ||
    s === "opened" ||
    s === "replied" ||
    s === "bounced"
    ? s
    : "draft";
}
function asSentiment(s: string | null): Sentiment | null {
  return s === "positive" || s === "negative" || s === "neutral" ? s : null;
}

function MessagesPage() {
  const { organization } = useAuth();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MessageRow | null>(null);
  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);

  useEffect(() => {
    if (!organization?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("messages")
        .select(
          "id, type, subject, content, status, sentiment, created_at, lead_id, leads(name, company)",
        )
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (cancelled) return;
      if (!error && data) {
        setMessages(
          data.map((m) => {
            const lead = m.leads as { name: string; company: string | null } | null;
            return {
              id: m.id,
              type: asMessageType(m.type),
              subject: m.subject,
              content: m.content,
              preview: m.content.slice(0, 200),
              status: asMessageStatus(m.status),
              sentiment: asSentiment(m.sentiment),
              created_at: m.created_at,
              leadId: m.lead_id,
              leadName: lead?.name ?? "Unknown lead",
              leadCompany: lead?.company ?? null,
            };
          }),
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [organization?.id]);

  // Load replies whenever a message is opened.
  useEffect(() => {
    if (!selected) {
      setReplies([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setRepliesLoading(true);
      // Pull replies linked either to this specific message or to the same lead
      // (lots of providers attach replies to the lead, not the original message id).
      const filters: string[] = [`message_id.eq.${selected.id}`];
      if (selected.leadId) filters.push(`lead_id.eq.${selected.leadId}`);

      const { data, error } = await supabase
        .from("replies")
        .select("id, channel, content, sentiment, created_at")
        .or(filters.join(","))
        .order("created_at", { ascending: true })
        .limit(50);

      if (cancelled) return;
      if (!error && data) {
        setReplies(
          data.map((r) => ({
            id: r.id,
            channel: r.channel,
            content: r.content,
            sentiment: asSentiment(r.sentiment),
            created_at: r.created_at,
          })),
        );
      } else {
        setReplies([]);
      }
      setRepliesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const SelectedIcon = selected ? typeIcons[selected.type] : Mail;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Messages</h1>
        <p className="text-sm text-muted-foreground">
          All outreach and replies — click any message to read the full thread.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : messages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-3 text-sm font-semibold text-foreground">No messages yet</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Outreach you send to leads will appear here, along with their replies.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {messages.map((msg) => {
            const Icon = typeIcons[msg.type];
            return (
              <button
                key={msg.id}
                type="button"
                onClick={() => setSelected(msg)}
                className="flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-accent/30 focus:outline-none focus-visible:bg-accent/40"
                aria-label={`Open message to ${msg.leadName}`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{msg.leadName}</span>
                    {msg.leadCompany && (
                      <span className="text-xs text-muted-foreground">· {msg.leadCompany}</span>
                    )}
                    {msg.type === "ai_generated" && (
                      <Badge variant="info" className="text-[10px] px-1.5 py-0">
                        AI
                      </Badge>
                    )}
                    {msg.status === "draft" && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        Draft
                      </Badge>
                    )}
                  </div>
                  {msg.subject && <p className="text-sm text-foreground/80">{msg.subject}</p>}
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{msg.preview}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-xs text-muted-foreground">{timeAgo(msg.created_at)}</span>
                  <Badge variant={statusVariants[msg.status]} className="capitalize text-[10px]">
                    {msg.status}
                  </Badge>
                  {msg.sentiment && (
                    <Badge
                      variant={
                        msg.sentiment === "positive"
                          ? "success"
                          : msg.sentiment === "negative"
                            ? "destructive"
                            : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {msg.sentiment}
                    </Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                    <SelectedIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="truncate">
                      {selected.subject ||
                        (selected.status === "draft" ? "Untitled draft" : "Message")}
                    </DialogTitle>
                    <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
                      <span className="text-foreground">{selected.leadName}</span>
                      {selected.leadCompany && (
                        <span className="text-muted-foreground">· {selected.leadCompany}</span>
                      )}
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{typeLabels[selected.type]}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">
                        {formatFullDate(selected.created_at)}
                      </span>
                    </DialogDescription>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  <Badge
                    variant={statusVariants[selected.status]}
                    className="capitalize text-[10px]"
                  >
                    {selected.status}
                  </Badge>
                  {selected.sentiment && (
                    <Badge
                      variant={
                        selected.sentiment === "positive"
                          ? "success"
                          : selected.sentiment === "negative"
                            ? "destructive"
                            : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {selected.sentiment}
                    </Badge>
                  )}
                </div>
              </DialogHeader>

              <ScrollArea className="max-h-[60vh] pr-3">
                <div className="space-y-5">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" />
                      {selected.status === "draft" ? "Draft" : "Outreach"}
                    </div>
                    <div className="rounded-lg border border-border bg-secondary/30 p-4 text-sm text-foreground whitespace-pre-wrap break-words">
                      {selected.content}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Replies {replies.length > 0 && <span>({replies.length})</span>}
                    </div>
                    {repliesLoading ? (
                      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading replies…
                      </div>
                    ) : replies.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
                        No replies yet. We'll surface them here as soon as the lead responds.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {replies.map((reply) => (
                          <div
                            key={reply.id}
                            className="rounded-lg border border-border bg-card p-3"
                          >
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-[10px] capitalize">
                                  {reply.channel}
                                </Badge>
                                {reply.sentiment && (
                                  <Badge
                                    variant={
                                      reply.sentiment === "positive"
                                        ? "success"
                                        : reply.sentiment === "negative"
                                          ? "destructive"
                                          : "secondary"
                                    }
                                    className="text-[10px]"
                                  >
                                    {reply.sentiment}
                                  </Badge>
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                {formatFullDate(reply.created_at)}
                              </span>
                            </div>
                            <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                              {reply.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
