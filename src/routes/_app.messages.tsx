import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Bot, Loader2, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

export const Route = createFileRoute("/_app/messages")({
  component: MessagesPage,
  head: () => ({
    meta: [
      { title: "Vireon — Messages" },
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
  preview: string;
  status: MessageStatus;
  sentiment: Sentiment | null;
  created_at: string;
  leadName: string;
  leadCompany: string | null;
}

const typeIcons: Record<MessageType, typeof Mail> = {
  email: Mail,
  sms: Phone,
  ai_generated: Bot,
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

function asMessageType(t: string): MessageType {
  return t === "email" || t === "sms" || t === "ai_generated" ? t : "email";
}
function asMessageStatus(s: string): MessageStatus {
  return s === "draft" || s === "sent" || s === "delivered" || s === "opened" || s === "replied" || s === "bounced"
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
              preview: m.content.slice(0, 200),
              status: asMessageStatus(m.status),
              sentiment: asSentiment(m.sentiment),
              created_at: m.created_at,
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Messages</h1>
        <p className="text-sm text-muted-foreground">All outreach and replies</p>
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
              <div
                key={msg.id}
                className="flex items-start gap-4 p-4 transition-colors hover:bg-accent/30"
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
                  </div>
                  {msg.subject && <p className="text-sm text-foreground/80">{msg.subject}</p>}
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{msg.preview}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-xs text-muted-foreground">{timeAgo(msg.created_at)}</span>
                  <Badge
                    variant={statusVariants[msg.status]}
                    className="capitalize text-[10px]"
                  >
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
