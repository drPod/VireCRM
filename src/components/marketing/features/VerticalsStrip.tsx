import { Building2, Dumbbell, Home, ShieldCheck, Sun, Zap } from "lucide-react";

const VERTICALS = [
  {
    name: "Energy",
    icon: Zap,
    accent: "oklch(0.7 0.18 80)",
    description: "LOA workflow, supplier rate sheets, renewal alerts, usage history.",
  },
  {
    name: "Solar",
    icon: Sun,
    accent: "oklch(0.75 0.18 60)",
    description: "9-stage solar pipeline, project tracker, install scheduling, payout splits.",
  },
  {
    name: "Real Estate",
    icon: Home,
    accent: "oklch(0.62 0.18 240)",
    description: "Showings calendar, listing CRM, buyer pre-qual scoring, dual-sided pipelines.",
  },
  {
    name: "Insurance",
    icon: ShieldCheck,
    accent: "oklch(0.55 0.18 290)",
    description: "Policies, quotes, renewals — with carrier-rate comparison and bind workflows.",
  },
  {
    name: "Gym / Fitness",
    icon: Dumbbell,
    accent: "oklch(0.65 0.2 30)",
    description: "Member health tracking, retention alerts, lead-to-trial conversion.",
  },
  {
    name: "General agency",
    icon: Building2,
    accent: "oklch(0.6 0.16 200)",
    description: "Configure your own pipeline stages, custom fields, and lead sources.",
  },
];

export function VerticalsStrip() {
  return (
    <section
      id="verticals"
      className="relative scroll-mt-32 border-t border-border/60 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Industry-shaped
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Templates that already know how your industry sells.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Pick a vertical at onboarding. Get the right pipeline stages, custom fields, and
            automation defaults from day one — not a blank-canvas CRM you have to configure for a
            month.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VERTICALS.map((v) => (
            <div
              key={v.name}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-[border-color,box-shadow] hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-12 -right-10 h-32 w-32 rounded-full opacity-30 blur-2xl transition-opacity duration-300 group-hover:opacity-50"
                style={{ background: v.accent }}
              />
              <div
                className="relative flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm"
                style={{ background: `linear-gradient(135deg, ${v.accent} 0%, ${v.accent}CC 100%)` }}
              >
                <v.icon className="h-5 w-5" />
              </div>
              <h3 className="relative mt-5 text-base font-semibold text-foreground">{v.name}</h3>
              <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">
                {v.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
