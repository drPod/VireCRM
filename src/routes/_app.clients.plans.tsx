import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import {
  ArrowLeft,
  Loader2,
  Plus,
  Sparkles,
  Tags,
  Pencil,
  Copy,
  Trash2,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/clients/plans")({
  component: PlansPage,
  head: () => ({
    meta: [
      { title: "Plans — Vireon" },
      { name: "description", content: "Define white-labeled plans you sell to your clients" },
    ],
  }),
});

// Base tiers we offer. Each maps to a Paddle external_id and our internal cost.
// In production these would be loaded from Paddle, but caching them avoids an extra
// round-trip on every plan edit and keeps reseller UX snappy.
const BASE_TIERS = [
  { price_id: "starter_monthly", label: "Starter — $29/mo", cost_cents: 2900 },
  { price_id: "pro_monthly", label: "Pro — $99/mo", cost_cents: 9900 },
  { price_id: "growth_monthly", label: "Growth — $299/mo", cost_cents: 29900 },
] as const;

interface ResellerPlan {
  id: string;
  reseller_id: string;
  name: string;
  description: string | null;
  features: string[];
  base_price_id: string;
  base_cost_cents: number;
  markup_percent: number;
  monthly_price_cents: number;
  currency: string;
  is_active: boolean;
  slug: string;
  created_at: string;
}

function formatCents(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function PlansPage() {
  const { organization, role } = useAuth();
  const navigate = useNavigate();
  const isOwner = role?.role === "owner";
  const isReseller = !!(organization as { is_reseller?: boolean } | null)?.is_reseller;

  const [plans, setPlans] = useState<ResellerPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ResellerPlan | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!organization?.id || !isOwner || !isReseller) {
      setLoading(false);
      return;
    }
    void loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id, isOwner, isReseller]);

  const loadPlans = async () => {
    if (!organization?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("reseller_plans")
      .select("*")
      .eq("reseller_id", organization.id)
      .order("monthly_price_cents", { ascending: true });
    if (error) {
      toast.error("Failed to load plans: " + error.message);
    } else {
      setPlans((data || []) as ResellerPlan[]);
    }
    setLoading(false);
  };

  const handleDelete = async (plan: ResellerPlan) => {
    if (!confirm(`Delete "${plan.name}"? Existing client subscriptions will keep working but the plan won't be sellable anymore.`)) return;
    const { error } = await supabase.from("reseller_plans").delete().eq("id", plan.id);
    if (error) {
      toast.error("Delete failed: " + error.message);
      return;
    }
    toast.success("Plan deleted");
    void loadPlans();
  };

  const handleToggleActive = async (plan: ResellerPlan) => {
    const { error } = await supabase
      .from("reseller_plans")
      .update({ is_active: !plan.is_active })
      .eq("id", plan.id);
    if (error) {
      toast.error("Update failed: " + error.message);
      return;
    }
    toast.success(plan.is_active ? "Plan paused" : "Plan activated");
    void loadPlans();
  };

  const copyCheckoutLink = (plan: ResellerPlan) => {
    if (!organization?.slug) return;
    const url = `${window.location.origin}/r/${organization.slug}/checkout/${plan.slug}`;
    void navigator.clipboard.writeText(url);
    toast.success("Checkout link copied");
  };

  if (!isOwner || !isReseller) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-8 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary" />
          <h3 className="mt-3 text-base font-semibold text-foreground">Reseller owners only</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Enable reseller mode and own the organization to define your own plans.
          </p>
          <Button variant="command" className="mt-4" onClick={() => navigate({ to: "/clients" })}>
            Back to Clients
          </Button>
        </div>
      </div>
    );
  }

  const totalMrr = plans
    .filter((p) => p.is_active)
    .reduce((sum, p) => sum + (p.monthly_price_cents - p.base_cost_cents), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link
            to="/clients"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Clients
          </Link>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Tags className="h-6 w-6 text-primary" />
            Plans
          </h1>
          <p className="text-sm text-muted-foreground">
            Define your own white-labeled plans. You set the price, we collect, you keep the markup.
          </p>
        </div>
        <Button variant="command" onClick={() => setCreating(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Plan
        </Button>
      </div>

      {plans.length > 0 && (
        <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-primary" />
            Per-client markup earned at full capacity
          </div>
          <div className="mt-1 text-2xl font-bold text-foreground">
            {formatCents(totalMrr)}{" "}
            <span className="text-sm font-normal text-muted-foreground">/ mo per client × plan</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          <Tags className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <h3 className="mt-4 text-sm font-semibold text-foreground">No plans yet</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            Create your first plan to start reselling. Pick a base tier, set a markup, and share
            the checkout link.
          </p>
          <Button variant="command" onClick={() => setCreating(true)} className="mt-4 gap-2">
            <Plus className="h-4 w-4" />
            Create your first plan
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const markupCents = plan.monthly_price_cents - plan.base_cost_cents;
            return (
              <div
                key={plan.id}
                className="rounded-xl border border-border bg-card p-5 flex flex-col"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-foreground truncate">
                      {plan.name}
                    </h3>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      /{plan.slug}
                    </p>
                  </div>
                  <Badge variant={plan.is_active ? "default" : "secondary"}>
                    {plan.is_active ? "Active" : "Paused"}
                  </Badge>
                </div>

                {plan.description && (
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                    {plan.description}
                  </p>
                )}

                <div className="rounded-lg bg-muted/40 p-3 mb-3 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Client pays</span>
                    <span className="font-semibold text-foreground">
                      {formatCents(plan.monthly_price_cents, plan.currency)}/mo
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Our base cost</span>
                    <span className="text-muted-foreground">
                      {formatCents(plan.base_cost_cents, plan.currency)}/mo
                    </span>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t border-border">
                    <span className="text-primary font-medium">You earn</span>
                    <span className="font-bold text-primary">
                      {formatCents(markupCents, plan.currency)}/mo
                    </span>
                  </div>
                </div>

                {plan.features.length > 0 && (
                  <ul className="text-xs text-muted-foreground space-y-1 mb-3">
                    {plan.features.slice(0, 3).map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-1">{f}</span>
                      </li>
                    ))}
                    {plan.features.length > 3 && (
                      <li className="text-[10px] text-muted-foreground/70">
                        +{plan.features.length - 3} more
                      </li>
                    )}
                  </ul>
                )}

                <div className="mt-auto flex flex-wrap gap-1.5 pt-3 border-t border-border">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyCheckoutLink(plan)}
                    className="gap-1.5 flex-1 min-w-0"
                  >
                    <Copy className="h-3 w-3" />
                    Copy link
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(plan)}
                    className="gap-1.5"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleActive(plan)}
                    className="gap-1.5"
                  >
                    <Switch checked={plan.is_active} className="pointer-events-none scale-75" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(plan)}
                    className="gap-1.5 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PlanFormDialog
        key={editing?.id || (creating ? "new" : "closed")}
        open={creating || !!editing}
        plan={editing}
        resellerId={organization?.id || ""}
        existingSlugs={plans.map((p) => p.slug)}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          void loadPlans();
        }}
      />
    </div>
  );
}

function PlanFormDialog({
  open,
  plan,
  resellerId,
  existingSlugs,
  onClose,
  onSaved,
}: {
  open: boolean;
  plan: ResellerPlan | null;
  resellerId: string;
  existingSlugs: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(plan?.name || "");
  const [slug, setSlug] = useState(plan?.slug || "");
  const [slugTouched, setSlugTouched] = useState(!!plan);
  const [description, setDescription] = useState(plan?.description || "");
  const [basePriceId, setBasePriceId] = useState(plan?.base_price_id || BASE_TIERS[0].price_id);
  const [markupPercent, setMarkupPercent] = useState(
    plan ? Math.round(plan.markup_percent * 100) : 50,
  );
  const [features, setFeatures] = useState<string[]>(plan?.features || [""]);
  const [saving, setSaving] = useState(false);

  const baseTier = BASE_TIERS.find((t) => t.price_id === basePriceId) || BASE_TIERS[0];
  const baseCostCents = baseTier.cost_cents;
  const monthlyPriceCents = useMemo(() => {
    return Math.round(baseCostCents * (1 + markupPercent / 100));
  }, [baseCostCents, markupPercent]);
  const markupCents = monthlyPriceCents - baseCostCents;

  // Auto-derive slug from name unless user typed it manually
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  const handleSave = async () => {
    if (!name.trim()) return toast.error("Name is required");
    if (!slug.trim()) return toast.error("Slug is required");
    const cleanFeatures = features.map((f) => f.trim()).filter(Boolean);

    const slugConflict = existingSlugs.includes(slug) && plan?.slug !== slug;
    if (slugConflict) return toast.error("That slug is already used by another plan");

    setSaving(true);
    const payload = {
      reseller_id: resellerId,
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      features: cleanFeatures,
      base_price_id: basePriceId,
      base_cost_cents: baseCostCents,
      markup_percent: markupPercent / 100,
      monthly_price_cents: monthlyPriceCents,
      currency: "USD",
    };

    const { error } = plan
      ? await supabase.from("reseller_plans").update(payload).eq("id", plan.id)
      : await supabase.from("reseller_plans").insert(payload);

    setSaving(false);
    if (error) {
      toast.error("Save failed: " + error.message);
      return;
    }
    toast.success(plan ? "Plan updated" : "Plan created");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan ? "Edit plan" : "New plan"}</DialogTitle>
          <DialogDescription>
            {plan
              ? "Changes apply to NEW signups only. Existing client subscriptions keep their original price."
              : "Pick a base tier and set your markup. We collect from the client, you earn the markup on each renewal."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Plan name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Agency Pro"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label>URL slug</Label>
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-xs text-muted-foreground font-mono">/checkout/</span>
              <Input
                value={slug}
                onChange={(e) => {
                  setSlug(slugify(e.target.value));
                  setSlugTouched(true);
                }}
                placeholder="agency-pro"
                className="font-mono"
              />
            </div>
          </div>

          <div>
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Everything in Starter plus..."
              className="mt-1.5 min-h-[60px]"
            />
          </div>

          <div>
            <Label>Base tier (your cost)</Label>
            <Select value={basePriceId} onValueChange={setBasePriceId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BASE_TIERS.map((t) => (
                  <SelectItem key={t.price_id} value={t.price_id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Your markup: +{markupPercent}%</Label>
            <input
              type="range"
              min={0}
              max={500}
              step={5}
              value={markupPercent}
              onChange={(e) => setMarkupPercent(Number(e.target.value))}
              className="w-full mt-1.5 accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>0%</span>
              <span>250%</span>
              <span>500%</span>
            </div>
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Client pays</span>
              <span className="font-semibold text-foreground">
                {formatCents(monthlyPriceCents)}/mo
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Our base cost</span>
              <span className="text-muted-foreground">{formatCents(baseCostCents)}/mo</span>
            </div>
            <div className="flex justify-between text-sm pt-1.5 border-t border-primary/20">
              <span className="text-primary font-medium">You earn</span>
              <span className="font-bold text-primary">
                {formatCents(markupCents)}/mo per client
              </span>
            </div>
          </div>

          <div>
            <Label>Features (one per line)</Label>
            <Textarea
              value={features.join("\n")}
              onChange={(e) => setFeatures(e.target.value.split("\n"))}
              placeholder={"Unlimited leads\nPriority support\nCustom branding"}
              className="mt-1.5 min-h-[100px] font-mono text-xs"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="command" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {plan ? "Save changes" : "Create plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
