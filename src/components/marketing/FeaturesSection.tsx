import {
  Zap,
  MessageSquare,
  Clock,
  UserX,
  MailWarning,
  BrainCircuit,
  Bot,
  CalendarCheck,
  BarChart3,
  Shield,
} from "lucide-react";

export function FeaturesSection() {
  return (
    <section className="relative overflow-hidden border-t border-border py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 section-aurora opacity-60"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 right-0 h-[500px] w-[700px] section-aurora-reverse opacity-50"
      />
      <div className="relative mx-auto max-w-6xl px-6">
        {/* Pain Points */}
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
            Your Business Is Already Losing Money Here
          </h2>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: UserX, text: "Leads that never get followed up with" },
            { icon: Clock, text: "Customers that go cold after first contact" },
            { icon: MailWarning, text: "Slow responses killing conversions" },
            { icon: MessageSquare, text: "Manual DMs & emails wasting your time" },
          ].map((item) => (
            <div
              key={item.text}
              className="flex items-start gap-3 rounded-xl border border-destructive/15 bg-destructive/5 p-5"
            >
              <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <p className="text-sm font-medium text-foreground">{item.text}</p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-xl text-center text-muted-foreground">
          We fix this by automating the entire follow-up and lead-nurturing process — so your team
          can focus on closing.
        </p>

        {/* Positioning Shift */}
        <div className="mx-auto mt-20 max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
            This is <span className="text-[oklch(0.65_0.16_320)]">Innovative</span> CRM Software
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            This is a fully automated sales system built specifically for your business.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 text-sm">
            <p className="text-muted-foreground">
              It doesn't just <span className="line-through opacity-60">organize leads</span>.
            </p>
            <p className="text-lg font-semibold text-foreground">
              It nurtures them and hands your team the ones ready to buy.
            </p>
          </div>
        </div>

        {/* Core Promise */}
        <div className="mx-auto mt-20 max-w-3xl rounded-2xl border border-primary/20 bg-primary/5 p-10 text-center">
          <h3 className="text-2xl font-bold text-foreground sm:text-3xl">
            If a lead shows interest…
            <br />
            <span className="text-gradient-primary">our system doesn't let it die.</span>
          </h3>
          <p className="mt-4 text-sm text-muted-foreground">It automatically:</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 text-left max-w-lg mx-auto">
            {[
              { icon: Zap, text: "Responds instantly" },
              { icon: Bot, text: "Follows up until they reply" },
              { icon: BrainCircuit, text: "Nurtures them with AI messaging" },
              { icon: CalendarCheck, text: "Surfaces hot leads ready for your team" },
            ].map((item) => (
              <div
                key={item.text}
                className="flex items-center gap-3 rounded-lg bg-background/60 px-4 py-3"
              >
                <item.icon className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-sm font-medium text-foreground">{item.text}</span>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm font-medium text-muted-foreground">
            Your pipeline stays alive 24/7 without you touching it.
          </p>
        </div>

        {/* Full Feature Grid */}
        <div className="mt-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-foreground">Everything Under the Hood</h2>
            <p className="mt-3 text-muted-foreground">
              A complete sales infrastructure — not another tool to manage
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Bot,
                title: "AI Command Center",
                desc: "Natural language commands that execute full outreach campaigns automatically.",
              },
              {
                icon: Zap,
                title: "Auto Follow-Ups",
                desc: "AI writes personalized messages, sends at optimal times, and follows up on no-replies.",
              },
              {
                icon: BrainCircuit,
                title: "Smart Lead Scoring",
                desc: "AI analyzes every lead and assigns conversion probability. Focus on the hottest prospects.",
              },
              {
                icon: MessageSquare,
                title: "Unified Inbox",
                desc: "All conversations in one place — email, SMS, WhatsApp, social DMs.",
              },
              {
                icon: CalendarCheck,
                title: "Appointment Booking",
                desc: "Booking links, calendar sync, automated reminders, and round-robin assignment.",
              },
              {
                icon: BarChart3,
                title: "Revenue Analytics",
                desc: "Pipeline reports, revenue forecasting, campaign ROI tracking, and team performance.",
              },
              {
                icon: Shield,
                title: "White-Label Ready",
                desc: "Custom branding, colors, logo, and domain. Sell it as your own product.",
              },
              {
                icon: Clock,
                title: "Instant Response",
                desc: "Leads get a response within seconds — not hours. Speed-to-lead on autopilot.",
              },
              {
                icon: MailWarning,
                title: "SMS & Email Automation",
                desc: "Multi-channel drip sequences, broadcast campaigns, and text-to-pay links.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
