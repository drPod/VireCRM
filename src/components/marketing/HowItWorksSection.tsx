import { Briefcase, Cog, TrendingUp } from "lucide-react";

export function HowItWorksSection() {
  return (
    <section className="relative overflow-hidden border-t border-border bg-card/50 py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-1/4 h-[500px] w-[700px] section-aurora-reverse opacity-55"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 left-0 h-[450px] w-[650px] section-aurora opacity-50"
      />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-foreground">
            Built for Businesses That Want Leverage, Not More Work
          </h2>
          <p className="mt-4 text-muted-foreground">
            If you're still manually following up with leads…<br />
            <span className="font-medium text-foreground">
              you're doing work your system should already be handling.
            </span>
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {[
            {
              icon: Briefcase,
              step: "01",
              title: "We Learn Your Business",
              description:
                "We study your sales process, your customers, and your offer — then architect a system tuned to your specific type of deal.",
            },
            {
              icon: Cog,
              step: "02",
              title: "We Build Your AI System",
              description:
                "Custom-built CRM with automated follow-ups, AI messaging, lead scoring, and pipeline management — all calibrated for your industry.",
            },
            {
              icon: TrendingUp,
              step: "03",
              title: "You Watch Revenue Grow",
              description:
                "Your system runs 24/7 — responding instantly, following up relentlessly, and handing your team a steady stream of warm, ready-to-close leads.",
            },
          ].map((step) => (
            <div key={step.step} className="rounded-xl border border-border bg-card p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <step.icon className="h-6 w-6 text-primary" />
              </div>
              <span className="mt-4 block text-xs font-bold text-primary">STEP {step.step}</span>
              <h3 className="mt-2 text-lg font-semibold text-foreground">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
