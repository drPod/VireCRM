import {
  Bot,
  Zap,
  Target,
  MessageSquare,
  Calendar,
  BarChart3,
  Shield,
  Palette,
  GitBranch,
  Mail,
  Star,
  Receipt,
  Users,
  Phone,
  Globe,
} from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "AI Command Center",
    description: "Type natural language commands like 'Run outreach on 200 leads' and watch your AI sales team execute.",
  },
  {
    icon: GitBranch,
    title: "Workflow Automation",
    description: "Visual drag-and-drop builder. Multi-step sequences across email, SMS, tasks, and pipeline — all on autopilot.",
  },
  {
    icon: Target,
    title: "Smart Lead Scoring",
    description: "AI analyzes every lead and assigns conversion probability scores. Focus on the hottest prospects.",
  },
  {
    icon: MessageSquare,
    title: "Unified Inbox",
    description: "All conversations in one place — email, SMS, WhatsApp, social DMs. Never miss a message or lead.",
  },
  {
    icon: Mail,
    title: "Email Marketing Suite",
    description: "Drag-and-drop email builder, templates, broadcast campaigns, drip sequences, and full analytics.",
  },
  {
    icon: Calendar,
    title: "Appointment Booking",
    description: "Booking links, calendar sync, automated reminders, payment at booking, and round-robin assignment.",
  },
  {
    icon: Star,
    title: "Reputation Management",
    description: "Automated review requests, centralized review dashboard, AI-powered response suggestions, and spam detection.",
  },
  {
    icon: Receipt,
    title: "Invoicing & Payments",
    description: "Create invoices, send text-to-pay links, recurring billing, and payment tracking tied to contact records.",
  },
  {
    icon: Zap,
    title: "Auto Outreach & Follow-ups",
    description: "AI writes personalized messages, sends at optimal times, and automatically follows up on no-replies.",
  },
  {
    icon: Phone,
    title: "SMS & Phone Integration",
    description: "Two-way SMS, call tracking, missed-call text-back, voicemail drops, and WhatsApp messaging.",
  },
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    description: "Custom dashboards, pipeline reports, revenue forecasting, campaign ROI tracking, and team performance.",
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
            Everything You Need to Close More Deals
          </h2>
          <p className="mt-3 text-muted-foreground">
            A complete sales and marketing platform powered by AI — replaces 10+ tools
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
