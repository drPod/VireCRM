import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const TRUST_SIGNALS = [
  "Built for teams",
  "White-label ready",
  "Set up in days",
  "AI that follows up 24/7",
];

export function FeaturesHero() {
  return (
    <section className="relative overflow-hidden pt-20 pb-16 sm:pt-24 sm:pb-20">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[640px] w-[860px] -translate-x-1/2 -translate-y-1/4 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-[12%] top-[35%] h-[360px] w-[360px] rounded-full bg-[oklch(0.65_0.16_320)]/12 blur-3xl" />
        <div className="absolute left-[8%] top-[45%] h-[320px] w-[320px] rounded-full bg-[oklch(0.7_0.18_240)]/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-6 text-center">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3 w-3" />
          One platform · Every channel · Built to white-label
        </div>

        <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl xl:text-[5.25rem] xl:leading-[1.05]">
          The complete sales OS
          <br />
          <span className="text-gradient-primary [-webkit-text-fill-color:transparent] drop-shadow-[0_2px_12px_oklch(0.65_0.2_250/0.35)]">
            your team will actually use.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          VireCRM replaces the spreadsheet, the inbox, the calendar, and three half-broken
          automations with one AI-native CRM — engineered so revenue teams stop chasing leads and
          start closing them.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild variant="command" size="lg" className="gap-2 px-8 text-base">
            <Link to="/signup">
              Start free trial
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="px-8 text-base">
            <Link to="/preview">Tour the product</Link>
          </Button>
        </div>

        <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          {TRUST_SIGNALS.map((signal, idx) => (
            <li key={signal} className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-primary/70" aria-hidden="true" />
              {signal}
              {idx < TRUST_SIGNALS.length - 1 ? (
                <span aria-hidden="true" className="ml-3 hidden text-muted-foreground/40 sm:inline">
                  ·
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
