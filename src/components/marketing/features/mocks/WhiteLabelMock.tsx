import { Globe, Palette, ShieldCheck } from "lucide-react";

const BRANDS = [
  {
    name: "Atlas CRM",
    domain: "crm.atlasgroup.io",
    accent: "oklch(0.6 0.18 220)",
    initial: "A",
    plan: "Pro · 12 seats",
  },
  {
    name: "RoofMax",
    domain: "app.roofmax.co",
    accent: "oklch(0.7 0.2 30)",
    initial: "R",
    plan: "Pro · 6 seats",
  },
  {
    name: "Sunbright Solar",
    domain: "ops.sunbright.solar",
    accent: "oklch(0.75 0.18 80)",
    initial: "S",
    plan: "Starter · 3 seats",
  },
  {
    name: "Pulse Realty",
    domain: "deals.pulserealty.com",
    accent: "oklch(0.62 0.2 340)",
    initial: "P",
    plan: "Pro · 18 seats",
  },
];

export function WhiteLabelMock() {
  return (
    <div className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Client workspaces
          </p>
          <p className="mt-1 text-base font-semibold text-foreground">
            4 active · 2 onboarding this week
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
          <ShieldCheck className="h-3 w-3" /> SSL auto-provisioned
        </span>
      </div>

      <div className="space-y-2">
        {BRANDS.map((b) => (
          <div
            key={b.name}
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 px-3 py-2.5"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${b.accent} 0%, ${b.accent}CC 100%)` }}
            >
              {b.initial}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{b.name}</p>
              <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                <Globe className="h-2.5 w-2.5" />
                {b.domain}
              </p>
            </div>
            <span className="hidden shrink-0 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground sm:inline">
              {b.plan}
            </span>
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: b.accent }}
            />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/8 via-card to-[oklch(0.65_0.16_320)]/10 p-4">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Theme · Atlas CRM</p>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {["oklch(0.6 0.18 220)", "oklch(0.7 0.16 250)", "oklch(0.55 0.15 280)", "oklch(0.45 0.1 240)"].map(
            (c) => (
              <div
                key={c}
                className="h-7 rounded-md border border-border/60"
                style={{ background: c }}
              />
            ),
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Logo, palette, fonts, and email templates inherited per-tenant. Resellers bill on their own
          Stripe.
        </p>
      </div>
    </div>
  );
}
