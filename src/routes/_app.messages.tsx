import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Bot } from "lucide-react";

export const Route = createFileRoute("/_app/messages")({
  component: MessagesPage,
  head: () => ({
    meta: [
      { title: "Vireon — Messages" },
      { name: "description", content: "View all outreach messages and replies" },
    ],
  }),
});

interface Message {
  id: string;
  leadName: string;
  leadCompany: string;
  type: "email" | "sms" | "ai_generated";
  subject?: string;
  preview: string;
  status: "sent" | "delivered" | "opened" | "replied" | "bounced";
  time: string;
  sentiment?: "positive" | "negative" | "neutral";
}

const mockMessages: Message[] = [
  { id: "1", leadName: "Sarah Chen", leadCompany: "TechFlow", type: "email", subject: "Quick intro — AI solutions", preview: "Hi Sarah, I noticed TechFlow is scaling fast...", status: "opened", time: "10 min ago" },
  { id: "2", leadName: "Alex Thompson", leadCompany: "Innovate AI", type: "email", subject: "Re: Demo request", preview: "Thanks for reaching out! We'd love to see a demo.", status: "replied", time: "25 min ago", sentiment: "positive" },
  { id: "3", leadName: "Marcus Rivera", leadCompany: "Acme Corp", type: "ai_generated", subject: "Follow-up", preview: "Hi Marcus, just following up on my previous message...", status: "sent", time: "1 hr ago" },
  { id: "4", leadName: "Priya Patel", leadCompany: "NexGen", type: "sms", preview: "Hi Priya, reminder about our call tomorrow at 3pm.", status: "delivered", time: "2 hr ago" },
  { id: "5", leadName: "James Park", leadCompany: "BigCo", type: "email", subject: "Re: Partnership", preview: "We're not interested at this time.", status: "replied", time: "3 hr ago", sentiment: "negative" },
  { id: "6", leadName: "David Kim", leadCompany: "CloudScale", type: "email", subject: "Proposal attached", preview: "David, as discussed, here's the proposal with pricing.", status: "opened", time: "4 hr ago" },
];

const typeIcons = { email: Mail, sms: Phone, ai_generated: Bot };
const statusVariants: Record<Message["status"], "info" | "secondary" | "success" | "warning" | "destructive"> = {
  sent: "secondary", delivered: "info", opened: "warning", replied: "success", bounced: "destructive",
};

function MessagesPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Messages</h1>
        <p className="text-sm text-muted-foreground">All outreach and replies</p>
      </div>
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {mockMessages.map((msg) => {
          const Icon = typeIcons[msg.type];
          return (
            <div key={msg.id} className="flex items-start gap-4 p-4 transition-colors hover:bg-accent/30">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{msg.leadName}</span>
                  <span className="text-xs text-muted-foreground">· {msg.leadCompany}</span>
                  {msg.type === "ai_generated" && <Badge variant="info" className="text-[10px] px-1.5 py-0">AI</Badge>}
                </div>
                {msg.subject && <p className="text-sm text-foreground/80">{msg.subject}</p>}
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{msg.preview}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="text-xs text-muted-foreground">{msg.time}</span>
                <Badge variant={statusVariants[msg.status]} className="capitalize text-[10px]">{msg.status}</Badge>
                {msg.sentiment && (
                  <Badge variant={msg.sentiment === "positive" ? "success" : msg.sentiment === "negative" ? "destructive" : "secondary"} className="text-[10px]">{msg.sentiment}</Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
