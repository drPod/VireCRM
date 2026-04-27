import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MessageSquare,
  Mail,
  Phone,
  Facebook,
  Instagram,
  Globe,
  Search,
  Send,
  Loader2,
  Sparkles,
  Inbox,
  CheckCircle2,
  Clock,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/conversations")({
  component: ConversationsPage,
  head: () => ({
    meta: [
      { title: "Genesis — Conversations" },
      {
        name: "description",
        content: "Unified inbox for SMS, email, social and webchat conversations with leads.",
      },
    ],
  }),
});

type Channel = "sms" | "email" | "facebook" | "instagram" | "whatsapp" | "webchat";
type Status = "open" | "snoozed" | "closed";

interface Conversation {
  id: string;
  channel: Channel;
  subject: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  unread_count: number;
  status: Status;
  lead_id: string | null;
  leads: { name: string; email: string | null; company: string | null } | null;
}

interface ConversationMessage {
  id: string;
  direction: "inbound" | "outbound";
  sender: string | null;
  body: string;
  sent_at: string;
}

const CHANNEL_META: Record<Channel, { icon: typeof Mail; label: string; color: string }> = {
  sms: { icon: Phone, label: "SMS", color: "text-emerald-400" },
  email: { icon: Mail, label: "Email", color: "text-primary" },
  facebook: { icon: Facebook, label: "Facebook", color: "text-blue-400" },
  instagram: { icon: Instagram, label: "Instagram", color: "text-pink-400" },
  whatsapp: { icon: MessageSquare, label: "WhatsApp", color: "text-emerald-500" },
  webchat: { icon: Globe, label: "Webchat", color: "text-orange-400" },
};

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

function ConversationsPage() {
  const { organization, user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | Channel>("all");
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [leadOptions, setLeadOptions] = useState<{ id: string; name: string }[]>([]);
  const [newLeadId, setNewLeadId] = useState<string>("");
  const [newChannel, setNewChannel] = useState<Channel>("email");
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [creating, setCreating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("conversations")
      .select(
        "id, channel, subject, last_message_preview, last_message_at, unread_count, status, lead_id, leads(name, email, company)",
      )
      .eq("organization_id", organization.id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(100);
    setConversations((data || []) as unknown as Conversation[]);
    setLoading(false);
  }, [organization?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Realtime — new messages and conversation updates
  useEffect(() => {
    if (!organization?.id) return;
    const channel = supabase
      .channel(`conversations_${organization.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `organization_id=eq.${organization.id}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_messages",
          filter: `organization_id=eq.${organization.id}`,
        },
        (payload) => {
          const msg = payload.new as ConversationMessage & { conversation_id: string };
          if (msg.conversation_id === activeId) {
            setMessages((prev) => [...prev, msg]);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [organization?.id, activeId, refresh]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingMessages(true);
      const { data, error } = await supabase
        .from("conversation_messages")
        .select("id, direction, sender, body, sent_at")
        .eq("conversation_id", activeId)
        .order("sent_at", { ascending: true })
        .limit(200);
      if (error) {
        toast.error("Failed to load messages", { description: error.message });
      }
      if (!cancelled) {
        setMessages((data || []) as ConversationMessage[]);
        // Mark as read (best-effort; ignore if RLS blocks)
        void supabase.from("conversations").update({ unread_count: 0 }).eq("id", activeId);
        // Optimistically reflect locally
        setConversations((prev) =>
          prev.map((c) => (c.id === activeId ? { ...c, unread_count: 0 } : c)),
        );
        setLoadingMessages(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const filtered = useMemo(() => {
    let result = conversations;
    if (filter === "unread") result = result.filter((c) => c.unread_count > 0);
    else if (filter !== "all") result = result.filter((c) => c.channel === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.leads?.name.toLowerCase().includes(q) ||
          c.subject?.toLowerCase().includes(q) ||
          c.last_message_preview?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [conversations, filter, search]);

  const active = conversations.find((c) => c.id === activeId) || null;

  const sendMessage = async () => {
    if (!draft.trim() || !active || !organization?.id) return;
    setSending(true);
    const body = draft.trim();
    setDraft("");
    const { error } = await supabase.from("conversation_messages").insert({
      conversation_id: active.id,
      organization_id: organization.id,
      direction: "outbound",
      sender: user?.email || "You",
      body,
    });
    if (error) {
      toast.error("Failed to send");
      setDraft(body);
    } else {
      await supabase
        .from("conversations")
        .update({
          last_message_preview: body.slice(0, 120),
          last_message_at: new Date().toISOString(),
        })
        .eq("id", active.id);
    }
    setSending(false);
  };

  const closeConversation = async () => {
    if (!active) return;
    await supabase.from("conversations").update({ status: "closed" }).eq("id", active.id);
    toast.success("Conversation closed");
  };

  const stats = useMemo(() => {
    const open = conversations.filter((c) => c.status === "open").length;
    const unread = conversations.reduce((s, c) => s + c.unread_count, 0);
    return { open, unread, total: conversations.length };
  }, [conversations]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card/50 px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Conversations</h1>
          <p className="text-xs text-muted-foreground">
            {stats.open} open · {stats.unread} unread · {stats.total} total
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Sparkles className="h-3.5 w-3.5" /> AI suggest reply
          </Button>
          <Button variant="command" size="sm">
            <Plus className="h-3.5 w-3.5" /> New
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: channel filter rail */}
        <div className="hidden w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-card/30 py-3 md:flex">
          <FilterIcon
            icon={Inbox}
            label="All"
            active={filter === "all"}
            onClick={() => setFilter("all")}
            count={conversations.length}
          />
          <FilterIcon
            icon={MessageSquare}
            label="Unread"
            active={filter === "unread"}
            onClick={() => setFilter("unread")}
            count={stats.unread}
          />
          <div className="my-1 h-px w-8 bg-border" />
          {(Object.keys(CHANNEL_META) as Channel[]).map((ch) => {
            const meta = CHANNEL_META[ch];
            const count = conversations.filter((c) => c.channel === ch).length;
            return (
              <FilterIcon
                key={ch}
                icon={meta.icon}
                label={meta.label}
                active={filter === ch}
                onClick={() => setFilter(ch)}
                count={count}
              />
            );
          })}
        </div>

        {/* Middle: conversation list */}
        <div className="flex w-full max-w-sm shrink-0 flex-col border-r border-border">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations…"
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Inbox className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium text-foreground">
                  {conversations.length === 0 ? "No conversations yet" : "No matches"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {conversations.length === 0
                    ? "When leads message you, they'll show up here."
                    : "Try a different filter or search."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((c) => {
                  const meta = CHANNEL_META[c.channel];
                  const Icon = meta.icon;
                  const isActive = c.id === activeId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setActiveId(c.id)}
                      className={`group flex w-full gap-3 px-3 py-3 text-left transition-colors ${
                        isActive ? "bg-accent" : "hover:bg-accent/40"
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary ${meta.color}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {c.leads?.name || "Unknown"}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {timeAgo(c.last_message_at)}
                          </span>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.last_message_preview || c.subject || "No messages"}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                            {meta.label}
                          </Badge>
                          {c.unread_count > 0 && (
                            <Badge className="h-4 min-w-4 px-1 text-[9px]">{c.unread_count}</Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right: thread view */}
        <div className="flex flex-1 flex-col">
          {!active ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/30" />
              <p className="mt-3 text-sm font-medium text-foreground">Select a conversation</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Pick a thread from the list to view messages and reply across any channel.
              </p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="flex items-center justify-between border-b border-border bg-card/30 px-5 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary ${
                      CHANNEL_META[active.channel].color
                    }`}
                  >
                    {(() => {
                      const Icon = CHANNEL_META[active.channel].icon;
                      return <Icon className="h-4 w-4" />;
                    })()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {active.leads?.name || "Unknown"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {active.leads?.email || active.leads?.company || "—"} ·{" "}
                      {CHANNEL_META[active.channel].label}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge
                    variant={
                      active.status === "open"
                        ? "default"
                        : active.status === "snoozed"
                          ? "warning"
                          : "secondary"
                    }
                    className="text-[10px] capitalize"
                  >
                    {active.status === "open" ? (
                      <>
                        <Clock className="mr-1 h-3 w-3" /> Open
                      </>
                    ) : active.status === "closed" ? (
                      <>
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Closed
                      </>
                    ) : (
                      "Snoozed"
                    )}
                  </Badge>
                  {active.status !== "closed" && (
                    <Button variant="ghost" size="sm" onClick={closeConversation}>
                      Close
                    </Button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
                {loadingMessages ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="py-12 text-center text-xs text-muted-foreground">
                    No messages in this thread yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${
                          m.direction === "outbound" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                            m.direction === "outbound"
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-foreground"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          <p
                            className={`mt-1 text-[10px] ${
                              m.direction === "outbound"
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            }`}
                          >
                            {new Date(m.sent_at).toLocaleString(undefined, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Composer */}
              <div className="border-t border-border bg-card/30 p-4">
                <div className="flex gap-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        void sendMessage();
                      }
                    }}
                    placeholder={`Reply via ${CHANNEL_META[active.channel].label}… (⌘/Ctrl+Enter to send)`}
                    className="min-h-[60px] resize-none text-sm"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!draft.trim() || sending}
                    variant="command"
                    className="h-auto self-end"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterIcon({
  icon: Icon,
  label,
  active,
  onClick,
  count,
}: {
  icon: typeof Mail;
  label: string;
  active: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      title={`${label} (${count})`}
      className={`relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
