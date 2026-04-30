/**
 * Admin: Contact Submissions inbox.
 *
 * Owner-only review queue for the public marketing contact form. RLS on
 * `contact_submissions` already restricts SELECT to owners — we just render
 * what the API returns. Supports text search (name/email/company/message),
 * status/sentiment/topic/test-mode filters, and CSV export of the current
 * filtered set.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Download, Search, RefreshCw, Mail, Phone, Building2, FlaskConical, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BulkApplyTemplateDialog, type BulkRecipient } from "@/components/crm/BulkApplyTemplateDialog";

interface Submission {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  budget: string | null;
  message: string;
  status: string;
  sentiment: string | null;
  topic: string | null;
  priority_suggestion: string | null;
  intent_summary: string | null;
  test_mode: boolean;
  created_at: string;
  replied_at: string | null;
  classification_error: string | null;
  lead_id: string | null;
}

const STATUS_OPTIONS = ["all", "received", "in_progress", "replied", "closed", "spam"] as const;
const SENTIMENT_OPTIONS = ["all", "positive", "neutral", "negative", "urgent"] as const;
const TOPIC_OPTIONS = [
  "all",
  "sales",
  "support",
  "partnership",
  "pricing",
  "demo",
  "careers",
  "spam",
  "other",
] as const;
const PRIORITY_OPTIONS = ["all", "low", "medium", "high", "critical"] as const;

export const Route = createFileRoute("/_app/contact-submissions")({
  component: ContactSubmissionsPage,
  head: () => ({
    meta: [{ title: "Contact Submissions — Genesis CRM" }],
  }),
});

function ContactSubmissionsPage() {
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [sentiment, setSentiment] = useState<string>("all");
  const [topic, setTopic] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [includeTest, setIncludeTest] = useState(false);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("contact_submissions")
      .select(
        "id,name,email,company,phone,budget,message,status,sentiment,topic,priority_suggestion,intent_summary,test_mode,created_at,replied_at,classification_error"
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (!includeTest) q = q.eq("test_mode", false);
    if (status !== "all") q = q.eq("status", status);
    if (sentiment !== "all") q = q.eq("sentiment", sentiment);
    if (topic !== "all") q = q.eq("topic", topic);
    if (priority !== "all") q = q.eq("priority_suggestion", priority);

    const { data, error } = await q;
    if (error) {
      toast.error(error.message);
      setItems([]);
    } else {
      setItems((data ?? []) as Submission[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, sentiment, topic, priority, includeTest]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((s) => {
      return (
        s.name.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term) ||
        (s.company ?? "").toLowerCase().includes(term) ||
        s.message.toLowerCase().includes(term) ||
        (s.intent_summary ?? "").toLowerCase().includes(term)
      );
    });
  }, [items, search]);

  const exportCsv = () => {
    if (filtered.length === 0) {
      toast.info("Nothing to export");
      return;
    }
    const headers = [
      "created_at",
      "name",
      "email",
      "company",
      "phone",
      "budget",
      "status",
      "sentiment",
      "topic",
      "priority_suggestion",
      "intent_summary",
      "test_mode",
      "replied_at",
      "message",
    ];
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      // RFC 4180 — quote if contains comma, quote, or newline
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const rows = filtered.map((s) =>
      headers.map((h) => escape((s as unknown as Record<string, unknown>)[h])).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `contact-submissions-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} submissions`);
  };

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Contact Submissions</h1>
          <p className="text-sm text-muted-foreground">
            Inbound messages from the public contact form, classified by AI for routing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV ({filtered.length})
          </Button>
        </div>
      </header>

      <Card className="space-y-4 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, email, company, message…"
                className="pl-8"
              />
            </div>
          </div>
          <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
          <FilterSelect label="Sentiment" value={sentiment} onChange={setSentiment} options={SENTIMENT_OPTIONS} />
          <FilterSelect label="Topic" value={topic} onChange={setTopic} options={TOPIC_OPTIONS} />
          <FilterSelect label="Priority" value={priority} onChange={setPriority} options={PRIORITY_OPTIONS} />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border"
            checked={includeTest}
            onChange={(e) => setIncludeTest(e.target.checked)}
          />
          Include test-mode submissions
        </label>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No submissions match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Received</th>
                  <th className="px-3 py-2 font-medium">From</th>
                  <th className="px-3 py-2 font-medium">Topic</th>
                  <th className="px-3 py-2 font-medium">Sentiment</th>
                  <th className="px-3 py-2 font-medium">Priority</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Summary</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className="cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/20"
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {new Date(s.created_at).toLocaleString()}
                      {s.test_mode && (
                        <Badge variant="outline" className="ml-2 gap-1 text-xs">
                          <FlaskConical className="h-3 w-3" /> test
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.email}</div>
                      {s.company && (
                        <div className="text-xs text-muted-foreground">{s.company}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">{s.topic ?? <Pending />}</td>
                    <td className="px-3 py-2"><SentimentBadge value={s.sentiment} /></td>
                    <td className="px-3 py-2"><PriorityBadge value={s.priority_suggestion} /></td>
                    <td className="px-3 py-2"><StatusBadge value={s.status} /></td>
                    <td className="max-w-md px-3 py-2 text-muted-foreground">
                      <div className="line-clamp-2">{s.intent_summary ?? s.message}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <SubmissionDialog item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>{o === "all" ? "All" : o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Pending() {
  return <span className="text-xs italic text-muted-foreground">pending</span>;
}

function SentimentBadge({ value }: { value: string | null }) {
  if (!value) return <Pending />;
  const map: Record<string, string> = {
    positive: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    neutral: "bg-muted text-muted-foreground border-border",
    negative: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    urgent: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return <Badge variant="outline" className={map[value] ?? ""}>{value}</Badge>;
}

function PriorityBadge({ value }: { value: string | null }) {
  if (!value) return <Pending />;
  const map: Record<string, string> = {
    low: "bg-muted text-muted-foreground border-border",
    medium: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    high: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    critical: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return <Badge variant="outline" className={map[value] ?? ""}>{value}</Badge>;
}

function StatusBadge({ value }: { value: string }) {
  return <Badge variant="outline">{value}</Badge>;
}

function SubmissionDialog({ item, onClose }: { item: Submission | null; onClose: () => void }) {
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        {item && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <span>{item.name}</span>
                <SentimentBadge value={item.sentiment} />
                <PriorityBadge value={item.priority_suggestion} />
                {item.test_mode && (
                  <Badge variant="outline" className="gap-1">
                    <FlaskConical className="h-3 w-3" /> test mode
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
                <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{item.email}</span>
                {item.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{item.phone}</span>}
                {item.company && <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{item.company}</span>}
                {item.budget && <span>Budget: {item.budget}</span>}
              </div>
              <div className="text-xs text-muted-foreground">
                Received {new Date(item.created_at).toLocaleString()}
                {item.replied_at && ` · Replied ${new Date(item.replied_at).toLocaleString()}`}
              </div>
              {item.intent_summary && (
                <div className="rounded-md border border-border bg-muted/20 p-3">
                  <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">AI summary</div>
                  <div className="text-foreground">{item.intent_summary}</div>
                </div>
              )}
              <div>
                <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">Message</div>
                <div className="whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-foreground">
                  {item.message}
                </div>
              </div>
              {item.classification_error && (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                  Classification error: {item.classification_error}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" asChild>
                  <a href={`mailto:${item.email}`}>Reply via email</a>
                </Button>
                <Button onClick={onClose}>Close</Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
