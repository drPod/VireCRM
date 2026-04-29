/**
 * AI Follow-up Inbox — review queue for AI-drafted next-step messages.
 *
 * - Owner/manager/creator can approve, edit, dismiss, or mark sent.
 * - "Generate batch" runs the suggest-followup edge fn in batch mode for
 *   leads idle >= 7 days; results land here as `pending`.
 * - Inline editing keeps reviewers in flow without opening a dialog.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Sparkles, Check, X, Send, RefreshCw, Edit3 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface Suggestion {
  id: string;
  lead_id: string;
  subject: string | null;
  message: string;
  reasoning: string | null;
  status: "pending" | "approved" | "dismissed" | "sent";
  source: string;
  channel: string;
  created_at: string;
  model: string | null;
}

interface LeadLite { id: string; name: string; email: string | null; company: string | null }

export const Route = createFileRoute("/_app/followup-inbox")({
  component: FollowupInbox,
});

const STATUS_TABS: { key: Suggestion["status"] | "all"; label: string }[] = [
  { key: "pending", label: "Pending review" },
  { key: "approved", label: "Approved" },
  { key: "sent", label: "Sent" },
  { key: "dismissed", label: "Dismissed" },
  { key: "all", label: "All" },
];

function FollowupInbox() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Suggestion["status"] | "all">("pending");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [leads, setLeads] = useState<Record<string, LeadLite>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edited, setEdited] = useState<{ subject: string; message: string }>({ subject: "", message: "" });

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("lead_followup_suggestions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (tab !== "all") q = q.eq("status", tab);
    const { data, error } = await q;
    if (error) {
      toast.error(`Failed to load: ${error.message}`);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as Suggestion[];
    setItems(list);
    // Hydrate lead names
    const leadIds = Array.from(new Set(list.map((s) => s.lead_id)));
    if (leadIds.length) {
      const { data: leadRows } = await supabase
        .from("leads")
        .select("id, name, email, company")
        .in("id", leadIds);
      setLeads(Object.fromEntries((leadRows ?? []).map((l) => [l.id, l as LeadLite])));
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const generateBatch = async () => {
    if (!user) return;
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("suggest-followup", {
      body: { mode: "batch", days_idle: 7 },
    });
    setRunning(false);
    if (error) {
      // Surface 402 / 429 nicely
      const msg = (error as { message?: string }).message ?? "Failed to generate";
      if (msg.includes("402")) toast.error("AI credits exhausted — add credits to continue.");
      else if (msg.includes("429")) toast.error("Rate limited. Please retry in a moment.");
      else toast.error(msg);
      return;
    }
    const created = (data as { created?: number; processed?: number })?.created ?? 0;
    const processed = (data as { processed?: number })?.processed ?? 0;
    toast.success(`Generated ${created} suggestions from ${processed} stale leads`);
    void load();
  };

  const updateStatus = async (id: string, status: Suggestion["status"]) => {
    const patch: Record<string, unknown> = { status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() };
    if (status === "sent") patch.sent_at = new Date().toISOString();
    const { error } = await supabase.from("lead_followup_suggestions").update(patch as never).eq("id", id);
    if (error) {
      toast.error(`Update failed: ${error.message}`);
      return;
    }
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    if (tab !== "all" && tab !== status) {
      setItems((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const startEdit = (s: Suggestion) => {
    setEditingId(s.id);
    setEdited({ subject: s.subject ?? "", message: s.message });
  };

  const saveEdit = async (id: string) => {
    const { error } = await supabase
      .from("lead_followup_suggestions")
      .update({ subject: edited.subject, message: edited.message } as never)
      .eq("id", id);
    if (error) {
      toast.error(`Save failed: ${error.message}`);
      return;
    }
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, subject: edited.subject, message: edited.message } : s)));
    setEditingId(null);
    toast.success("Saved");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Follow-up Inbox
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and approve AI-drafted next-step messages before they go out.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={generateBatch} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
            Generate batch
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((t) => (
          <Button
            key={t.key}
            size="sm"
            variant={tab === t.key ? "default" : "outline"}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card className="py-16 text-center">
          <p className="text-sm text-muted-foreground">No {tab === "all" ? "" : tab} suggestions.</p>
          <p className="text-xs text-muted-foreground mt-1">Click "Generate batch" to draft suggestions for stale leads.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((s) => {
            const lead = leads[s.lead_id];
            const isEditing = editingId === s.id;
            return (
              <Card key={s.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {lead?.name ?? "Unknown lead"}
                      {lead?.company && <span className="text-muted-foreground"> · {lead.company}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {lead?.email ?? "no email"} · {new Date(s.created_at).toLocaleString()} · {s.source} · {s.model}
                    </div>
                  </div>
                  <Badge variant="outline" className="capitalize">{s.status}</Badge>
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      value={edited.subject}
                      onChange={(e) => setEdited((p) => ({ ...p, subject: e.target.value }))}
                      placeholder="Subject"
                    />
                    <Textarea
                      value={edited.message}
                      onChange={(e) => setEdited((p) => ({ ...p, message: e.target.value }))}
                      rows={6}
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {s.subject && <div className="text-sm font-medium text-foreground">{s.subject}</div>}
                    <div className="text-sm text-foreground/90 whitespace-pre-wrap">{s.message}</div>
                    {s.reasoning && (
                      <div className="text-xs text-muted-foreground italic border-l-2 border-border pl-2 mt-2">
                        {s.reasoning}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {isEditing ? (
                    <>
                      <Button size="sm" onClick={() => void saveEdit(s.id)}>
                        <Check className="h-3.5 w-3.5 mr-1" /> Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => startEdit(s)}>
                        <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                      {s.status !== "approved" && s.status !== "sent" && (
                        <Button size="sm" variant="outline" onClick={() => void updateStatus(s.id, "approved")}>
                          <Check className="h-3.5 w-3.5 mr-1" /> Approve
                        </Button>
                      )}
                      {s.status !== "sent" && (
                        <Button size="sm" onClick={() => void updateStatus(s.id, "sent")}>
                          <Send className="h-3.5 w-3.5 mr-1" /> Mark sent
                        </Button>
                      )}
                      {s.status !== "dismissed" && (
                        <Button size="sm" variant="ghost" onClick={() => void updateStatus(s.id, "dismissed")}>
                          <X className="h-3.5 w-3.5 mr-1" /> Dismiss
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
