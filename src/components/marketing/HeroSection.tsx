import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import heroImage from "@/assets/hero-dashboard.jpg";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/8 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">Fully Autonomous AI Sales Engine</span>
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Your AI Sales Team
            <br />
            <span className="text-gradient-primary">That Never Sleeps</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Type one command. AI scores leads, writes personalized outreach, sends
            messages, classifies replies, and books meetings — automatically.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/signup">
              <Button variant="command" size="lg" className="gap-2 px-8">
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button variant="outline" size="lg">View Pricing</Button>
            </Link>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            No credit card required · 14-day free trial · Cancel anytime
          </p>
        </div>

        {/* Hero Image */}
        <div className="relative mx-auto mt-16 max-w-4xl">
          <div className="absolute -inset-4 rounded-2xl bg-primary/5 blur-2xl" />
          <div className="relative overflow-hidden rounded-xl border border-border shadow-2xl shadow-primary/10">
            <img
              src={heroImage}
              alt="AI CRM Dashboard showing autonomous sales pipeline management"
              width={1920}
              height={1080}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
