import {
  Bot,
  Zap,
  Target,
  MessageSquare,
  Calendar,
  BarChart3,
  Shield,
  Palette,
} from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "AI Command Center",
    description: "Type natural language commands like 'Run outreach on 200 leads' and watch your AI sales team execute.",
  },
  {
    icon: Target,
    title: "Smart Lead Scoring",
    description: "AI analyzes every lead and assigns conversion probability scores. Focus on the hottest prospects.",
  },
  {
    icon: MessageSquare,
    title: "Auto Outreach & Follow-ups",
    description: "AI writes personalized messages, sends them at optimal times, and automatically follows up on no-replies.",
  },
  {
    icon: Zap,
    title: "Reply Classification",
    description: "AI reads every response and classifies sentiment — interested, not interested, or needs follow-up.",
  },
  {
    icon: Calendar,
    title: "Autonomous Scheduling",
    description: "Hot leads get auto-booked for demos. Calendar syncs, confirmations, and reminders handled by AI.",
  },
  {
    icon: BarChart3,
    title: "Real-Time Analytics",
    description: "Track conversion rates, AI performance, pipeline health, and revenue forecasts in real-time.",
  },
  {
    icon: Shield,
    title: "Guardrails & Safety",
    description: "Rate limiting, duplicate prevention, approval workflows, and full audit logs protect your reputation.",
  },
  {
    icon: Palette,
    title: "White-Label Ready",
    description: "Custom branding, colors, logo, and domain. Sell Vireon as your own product to your clients.",
  },
];

export function FeaturesSection() {
  return (
    <section className="border-t border-border bg-card/50 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-foreground">
            Everything Your Sales Team Needs
          </h2>
          <p className="mt-3 text-muted-foreground">
            A complete autonomous sales system powered by specialized AI agents
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
