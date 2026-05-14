import { TrendingUp, Users, Zap, Clock } from "lucide-react";

const stats = [
  { icon: TrendingUp, value: "3.2x", label: "More Conversions" },
  { icon: Users, value: "10K+", label: "Leads Managed" },
  { icon: Zap, value: "95%", label: "Follow-Ups Automated" },
  { icon: Clock, value: "< 30s", label: "Avg Response Time" },
];

const testimonials = [
  {
    quote:
      "We were losing 60% of our leads to slow follow-up. After Genesis, our close rate tripled because our reps finally talked to leads while they were still hot. The AI doesn't forget, doesn't get tired, and doesn't take weekends off.",
    name: "Jessica Torres",
    title: "VP of Sales, ScaleUp Inc",
  },
  {
    quote:
      "This isn't software — it's a follow-up engine that works 24/7. We stopped doing manual follow-ups entirely and our revenue went up 40% in the first quarter.",
    name: "Ryan Chen",
    title: "Founder, NovaTech",
  },
  {
    quote:
      "Every lead that comes in gets an instant, personalized response. Our speed-to-lead went from 4 hours to 12 seconds. That alone paid for the entire system.",
    name: "Marcus Williams",
    title: "CEO, Digital Growth Agency",
  },
];

export function SocialProofSection() {
  return (
    <section className="py-20">
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
