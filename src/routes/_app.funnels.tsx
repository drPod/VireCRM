import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Globe,
  Plus,
  Loader2,
  Eye,
  Edit3,
  Copy,
  ExternalLink,
  TrendingUp,
  Layers,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/funnels")({
  component: FunnelsPage,
  head: () => ({
    meta: [
      { title: "VireCRM — Funnels & Sites" },
      {
        name: "description",
        content: "Build high-converting funnels and websites with drag-and-drop pages.",
      },
    ],
  }),
});

interface Funnel {
  id: string;
  name: string;
  slug: string;
  kind: "funnel" | "website";
  status: "draft" | "published" | "archived";
  steps: Array<{ id: string; name: string; type: string }>;
  visits_count: number;
  conversions_count: number;
  published_url: string | null;
  updated_at: string;
}

const FUNNEL_TEMPLATES = [
  { id: "lead-magnet", name: "Lead magnet", steps: ["Opt-in", "Thank you"], icon: "📥" },
  {
    id: "webinar",
    name: "Webinar funnel",
    steps: ["Registration", "Confirmation", "Replay"],
    icon: "🎥",
  },
  {
    id: "tripwire",
    name: "Tripwire",
    steps: ["Sales", "Order form", "Upsell", "Thank you"],
    icon: "💰",
  },
  { id: "consult", name: "Consultation", steps: ["Booking", "Confirmation"], icon: "📅" },
  { id: "blank", name: "Blank funnel", steps: [], icon: "✨" },
];

function FunnelsPage() {
  const { organization, role, user } = useAuth();
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "funnel" | "website">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<"funnel" | "website">("funnel");
  const [selectedTemplate, setSelectedTemplate] = useState("blank");

  const isOwnerOrManager = role?.role === "owner" || role?.role === "manager";

  const refresh = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("funnels")
      .select("*")
      .eq("organization_id", organization.id)
      .order("updated_at", { ascending: false })
      .limit(100);
    setFunnels((data || []) as unknown as Funnel[]);
    setLoading(false);
  }, [organization?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    if (tab === "all") return funnels;
    return funnels.filter((f) => f.kind === tab);
  }, [funnels, tab]);

  const stats = useMemo(() => {
    const published = funnels.filter((f) => f.status === "published").length;
    const visits = funnels.reduce((s, f) => s + (f.visits_count || 0), 0);
    const conversions = funnels.reduce((s, f) => s + (f.conversions_count || 0), 0);
    const rate = visits > 0 ? ((conversions / visits) * 100).toFixed(1) : "0.0";
    return { published, visits, conversions, rate };
  }, [funnels]);

  const create = async () => {
    if (!organization?.id || !newName.trim()) return;
    setCreating(true);
    const slug = newName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);
    const template = FUNNEL_TEMPLATES.find((t) => t.id === selectedTemplate);
    const steps = (template?.steps || []).map((name, i) => ({
      id: crypto.randomUUID(),
      name,
      type: i === 0 ? "landing" : "follow-up",
    }));
    const { error } = await supabase.from("funnels").insert({
      organization_id: organization.id,
      name: newName.trim(),
      slug: `${slug}-${Math.random().toString(36).slice(2, 6)}`,
      kind: newKind,
      steps,
      created_by: user?.id ?? null,
    });
    setCreating(false);
    if (error) {
      toast.error(error.message || "Failed to create");
      return;
    }
    toast.success(`${newKind === "funnel" ? "Funnel" : "Website"} created`);
    setCreateOpen(false);
    setNewName("");
    setSelectedTemplate("blank");
    void refresh();
  };

  const duplicate = async (f: Funnel) => {
    if (!organization?.id) return;
    const { error } = await supabase.from("funnels").insert({
      organization_id: organization.id,
      name: `${f.name} (copy)`,
      slug: `${f.slug}-copy-${Math.random().toString(36).slice(2, 5)}`,
      kind: f.kind,
      steps: f.steps,
      created_by: user?.id ?? null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Duplicated");
      void refresh();
    }
  };

  const togglePublish = async (f: Funnel) => {
    const next = f.status === "published" ? "draft" : "published";
    const { error } = await supabase
      .from("funnels")
      .update({
        status: next,
        published_url: next === "published" ? `https://${f.slug}.example.com` : null,
      })
      .eq("id", f.id);
    if (error) toast.error(error.message);
    else {
      toast.success(next === "published" ? "Published" : "Unpublished");
      void refresh();
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Sites & Funnels</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Drag-and-drop funnels and websites that convert visitors into leads.
            </p>
          </div>
          {isOwnerOrManager && (
            <Button variant="command" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard icon={Layers} label="Active" value={String(stats.published)} sub="published" />
          <StatCard icon={Eye} label="Total visits" value={stats.visits.toLocaleString()} />
          <StatCard
            icon={CheckCircle2}
            label="Conversions"
            value={stats.conversions.toLocaleString()}
          />
          <StatCard icon={TrendingUp} label="Conversion rate" value={`${stats.rate}%`} />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mb-4">
          <TabsList>
            <TabsTrigger value="all">All ({funnels.length})</TabsTrigger>
            <TabsTrigger value="funnel">
              Funnels ({funnels.filter((f) => f.kind === "funnel").length})
            </TabsTrigger>
            <TabsTrigger value="website">
              Websites ({funnels.filter((f) => f.kind === "website").length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <Globe className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <h3 className="mt-3 font-semibold text-foreground">
              No {tab === "all" ? "pages" : tab + "s"} yet
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Build your first high-converting funnel or website in seconds.
            </p>
            {isOwnerOrManager && (
              <Button variant="command" className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Create
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((f) => {
              const rate =
                f.visits_count > 0
                  ? ((f.conversions_count / f.visits_count) * 100).toFixed(1)
                  : "0";
              return (
                <div
                  key={f.id}
                  className="group rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-[0_0_24px_-12px_oklch(var(--primary)/0.4)]"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                      {f.kind === "website" ? (
                        <Globe className="h-5 w-5 text-primary" />
                      ) : (
                        <Layers className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <Badge
                      variant={
                        f.status === "published"
                          ? "default"
                          : f.status === "draft"
                            ? "secondary"
                            : "outline"
                      }
                      className="capitalize text-[10px]"
                    >
                      {f.status}
                    </Badge>
                  </div>
                  <h3 className="mt-3 truncate font-semibold text-foreground">{f.name}</h3>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">/{f.slug}</p>

                  <div className="mt-4 flex items-center gap-4 text-xs">
                    <div>
                      <p className="text-muted-foreground">Steps</p>
                      <p className="font-semibold text-foreground">{f.steps?.length || 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Visits</p>
                      <p className="font-semibold text-foreground">
                        {(f.visits_count || 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Conv.</p>
                      <p className="font-semibold text-primary">{rate}%</p>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-1">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <Link to="/funnels">
                        <Edit3 className="h-3 w-3" /> Edit
                      </Link>
                    </Button>
                    {isOwnerOrManager && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => duplicate(f)}
                          title="Duplicate"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePublish(f)}
                          title={f.status === "published" ? "Unpublish" : "Publish"}
                        >
                          {f.status === "published" ? (
                            <ExternalLink className="h-3 w-3" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create new {newKind}</DialogTitle>
            <DialogDescription>
              Pick a starting template — you can customize every step afterwards.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setNewKind("funnel")}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  newKind === "funnel"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent/40"
                }`}
              >
                <Layers className="h-4 w-4 text-primary" />
                <p className="mt-1.5 text-sm font-semibold">Funnel</p>
                <p className="text-[10px] text-muted-foreground">Multi-step conversion flow</p>
              </button>
              <button
                onClick={() => setNewKind("website")}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  newKind === "website"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent/40"
                }`}
              >
                <Globe className="h-4 w-4 text-primary" />
                <p className="mt-1.5 text-sm font-semibold">Website</p>
                <p className="text-[10px] text-muted-foreground">Multi-page site</p>
              </button>
            </div>

            <div>
              <Label htmlFor="funnel-name">Name</Label>
              <Input
                id="funnel-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={newKind === "funnel" ? "Spring promo funnel" : "Company site"}
              />
            </div>

            {newKind === "funnel" && (
              <div>
                <Label>Template</Label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {FUNNEL_TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t.id)}
                      className={`rounded-lg border p-2.5 text-left transition-colors ${
                        selectedTemplate === t.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-accent/40"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{t.icon}</span>
                        <span className="text-xs font-semibold">{t.name}</span>
                      </div>
                      {t.steps.length > 0 && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {t.steps.length} steps · {t.steps.join(" → ")}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="command" onClick={create} disabled={creating || !newName.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1.5 text-xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
