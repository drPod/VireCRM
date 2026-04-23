import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Star,
  MessageCircle,
  Mail,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { sendTransactionalEmail } from "@/lib/email/send";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reputation")({
  component: ReputationPage,
  head: () => ({
    meta: [
      { title: "Genesis — Reputation" },
      { name: "description", content: "Request reviews from happy customers" },
    ],
  }),
});

interface WonLead {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  closed_at: string | null;
  last_review_request_at?: string | null;
}

function loadRequestedMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("review_requests_sent") || "{}") as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
}

function saveRequestedMap(map: Record<string, string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem("review_requests_sent", JSON.stringify(map));
}

function ReputationPage() {
  const { organization, profile } = useAuth();
  const [leads, setLeads] = useState<WonLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [requested, setRequested] = useState<Record<string, string>>({});

  const [selected, setSelected] = useState<WonLead | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reviewUrl, setReviewUrl] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState(false);

  const brandName = organization?.brand_name || organization?.name || "Genesis";
  const senderName = profile?.full_name?.split(" ")[0] || undefined;

  useEffect(() => {
    setRequested(loadRequestedMap());
  }, []);

  useEffect(() => {
    if (!organization?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, email, company, closed_at")
        .eq("organization_id", organization.id)
        .eq("status", "won")
        .order("closed_at", { ascending: false, nullsFirst: false })
        .limit(100);
      if (!cancelled) {
        if (error) {
          toast.error("Couldn't load won deals");
        } else {
          setLeads((data ?? []) as WonLead[]);
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organization?.id]);

  const stats = useMemo(() => {
    const total = leads.length;
    const eligible = leads.filter((l) => !!l.email).length;
    const sentCount = leads.filter((l) => requested[l.id]).length;
    return { total, eligible, sentCount };
  }, [leads, requested]);

  const openSendDialog = (lead: WonLead) => {
    setSelected(lead);
    setReviewUrl("");
    setCustomMessage("");
    setDialogOpen(true);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected?.email) return;
    setSending(true);
    try {
      await sendTransactionalEmail({
        templateName: "review-request",
        recipientEmail: selected.email,
        idempotencyKey: `review-${selected.id}-${Date.now()}`,
        templateData: {
          brandName,
          customerName: selected.name?.split(" ")[0],
          senderName,
          reviewUrl: reviewUrl.trim() || undefined,
          customMessage: customMessage.trim() || undefined,
        },
      });
      const next = { ...requested, [selected.id]: new Date().toISOString() };
      setRequested(next);
      saveRequestedMap(next);
      toast.success(`Review request sent to ${selected.name}`);
      setDialogOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reputation</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Send branded review requests to customers from closed-won deals
            </p>
          </div>
          <Badge variant="secondary" className="gap-1">
            <Star className="h-3 w-3 text-warning" />
            Review requests
          </Badge>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          {[
            { label: "Won deals", value: stats.total, icon: CheckCircle2, color: "text-success" },
            { label: "With email", value: stats.eligible, icon: Mail, color: "text-foreground" },
            { label: "Requests sent", value: stats.sentCount, icon: Send, color: "text-primary" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
              <p className="mt-1 text-2xl font-bold text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Closed-won customers</h2>

            {loading ? (
              <div className="flex items-center justify-center py-16 rounded-xl border border-border bg-card">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : leads.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
                <Star className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium text-foreground">
                  No won deals yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Mark a lead as <span className="font-semibold">Won</span> in
                  Leads to start collecting reviews from happy customers.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {leads.map((lead) => {
                  const sentAt = requested[lead.id];
                  const hasEmail = !!lead.email;
                  return (
                    <div
                      key={lead.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/20"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-foreground truncate">{lead.name}</p>
                          {lead.company && (
                            <span className="text-xs text-muted-foreground">
                              · {lead.company}
                            </span>
                          )}
                          {sentAt && (
                            <Badge variant="outline" className="gap-1 text-[10px]">
                              <CheckCircle2 className="h-2.5 w-2.5 text-success" />
                              Sent {new Date(sentAt).toLocaleDateString()}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground truncate">
                          {lead.email || "No email on file"}
                        </p>
                      </div>
                      <Button
                        variant={sentAt ? "outline" : "command"}
                        size="sm"
                        disabled={!hasEmail}
                        onClick={() => openSendDialog(lead)}
                        className="gap-1.5"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {sentAt ? "Send again" : "Request review"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
              <h3 className="text-sm font-semibold text-foreground">How it works</h3>
              <ul className="mt-3 space-y-3 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  <span>
                    Pulls customers from leads marked <span className="font-semibold">Won</span>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>
                    Sends a branded email from{" "}
                    <span className="font-semibold">{brandName}</span> with your review link.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>Customers can reply directly if they had any issue.</span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground">Tip</h3>
              <p className="mt-2 text-xs text-muted-foreground">
                Paste your Google, Trustpilot, or Facebook review URL in the
                send dialog so customers can leave a rating in one click.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSend}>
            <DialogHeader>
              <DialogTitle>Request a review</DialogTitle>
              <DialogDescription>
                Send a branded email asking{" "}
                <span className="font-medium text-foreground">{selected?.name}</span> to share
                their experience. They'll receive it from{" "}
                <span className="font-medium text-foreground">{brandName}</span>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs">
                <span className="text-muted-foreground">To:</span>{" "}
                <span className="font-medium text-foreground">{selected?.email}</span>
              </div>
              <div className="space-y-2">
                <Label htmlFor="review-url">Review link (optional)</Label>
                <Input
                  id="review-url"
                  type="url"
                  value={reviewUrl}
                  onChange={(e) => setReviewUrl(e.target.value)}
                  placeholder="https://g.page/r/.../review"
                />
                <p className="text-[11px] text-muted-foreground">
                  Paste your Google, Trustpilot, or other review URL. Leave blank to send a
                  general request.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-message">Custom message (optional)</Label>
                <Textarea
                  id="custom-message"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Override the default body with your own note…"
                  rows={4}
                />
              </div>
              {!reviewUrl.trim() && (
                <div className="flex items-start gap-2 rounded-md bg-warning/10 p-3 text-xs text-warning">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    No review link set — the email will still send, but customers won't have a
                    one-click way to leave a rating.
                  </span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={sending}
              >
                Cancel
              </Button>
              <Button type="submit" variant="command" disabled={sending}>
                {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                Send request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
