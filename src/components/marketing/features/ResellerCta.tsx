import { Link } from "@tanstack/react-router";
import { ArrowRight, Layers, Palette, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

const HIGHLIGHTS = [
  { icon: Palette, title: "Your brand, top to bottom", body: "Custom logo, palette, copy, and per-tenant theme." },
  { icon: Layers, title: "Unlimited child workspaces", body: "Each customer gets isolated data + their own domain." },
  { icon: Wallet, title: "Bill on your terms", body: "Stripe Connect — you set the price, you keep the margin." },
  { icon: ShieldCheck, title: "We never touch your customers", body: "Majix branding hidden from end users. SOC 2 in progress." },
];

export function ResellerCta() {
  return (
    <section
      id="reseller"
      className="relative scroll-mt-32 border-t border-border/60 py-20 sm:py-28"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute right-[10%] bottom-[20%] h-[280px] w-[280px] rounded-full bg-[oklch(0.65_0.16_320)]/15 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/12 via-card to-[oklch(0.65_0.16_320)]/12 p-10 sm:p-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 -right-12 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
          />
          <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center lg:gap-14">
            <div>
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                For agencies + resellers
              </span>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                Sell Majix as <span className="text-gradient-primary [-webkit-text-fill-color:transparent]">your own product.</span>
              </h2>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
                White-label the entire CRM. Spin up unlimited customer workspaces on your domains. We
                bill you wholesale; you bill your customers what you want. They never see our name.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild variant="command" size="lg" className="gap-2 px-8 text-base">
                  <Link to="/contact">
                    Apply for reseller access
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="px-8 text-base">
                  <Link to="/pricing">See reseller pricing</Link>
                </Button>
              </div>
            </div>

            <ul className="grid gap-3 sm:grid-cols-2">
              {HIGHLIGHTS.map((h) => (
                <li
                  key={h.title}
                  className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-sm"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <h.icon className="h-4 w-4" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-foreground">{h.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{h.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
