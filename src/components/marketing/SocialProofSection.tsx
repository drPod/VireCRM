import { TrendingUp, Users, Zap, Clock } from "lucide-react";

const stats = [
  { icon: TrendingUp, value: "3.2x", label: "More Conversions" },
  { icon: Users, value: "10K+", label: "Leads Managed" },
  { icon: Zap, value: "95%", label: "Tasks Automated" },
  { icon: Clock, value: "40hrs", label: "Saved Per Week" },
];

const testimonials = [
  {
    quote: "We replaced 3 SDRs with AI CRM and our conversion rate actually went up. The AI follow-ups are relentless in the best way.",
    name: "Jessica Torres",
    title: "VP of Sales, ScaleUp Inc",
  },
  {
    quote: "The command interface is genius. I type 'follow up with cold leads' and 200 personalized emails go out. Game changer.",
    name: "Ryan Chen",
    title: "Founder, NovaTech",
  },
  {
    quote: "We white-labeled AI CRM and sell it to our agency clients. It's become our fastest-growing revenue stream.",
    name: "Marcus Williams",
    title: "CEO, Digital Growth Agency",
  },
];

export function SocialProofSection() {
  return (
    <section className="border-t border-border bg-card/50 py-20">
      <div className="mx-auto max-w-6xl px-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <stat.icon className="h-6 w-6 text-primary" />
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <div key={t.name} className="rounded-xl border border-border bg-card p-6">
              <p className="text-sm leading-relaxed text-muted-foreground">"{t.quote}"</p>
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-sm font-semibold text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.title}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
