import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import heroImage from "@/assets/hero-dashboard.jpg";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[700px] w-[900px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-1/4 top-1/2 h-[400px] w-[400px] rounded-full bg-[oklch(0.65_0.16_320)]/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3 w-3" />
            Autonomous AI sales system — built for your business
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Turn Every Lead Into Revenue
            <br />
            <span className="text-gradient-primary">— Automatically.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Genesis is a custom-built AI CRM that follows up, nurtures, and closes your leads for you — so your business keeps selling even when you're not working.
          </p>

          <p className="mx-auto mt-4 max-w-lg text-sm text-muted-foreground/80">
            No missed follow-ups. No manual chasing. No deals lost to slow response times.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/pricing">
              <Button variant="command" size="lg" className="gap-2 px-8 text-base">
                See plans &amp; pricing
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/contact">
              <Button variant="outline" size="lg" className="px-8 text-base">
                Book a strategy call
              </Button>
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-success" /> Custom-built for your business</span>
            <span className="hidden sm:inline">·</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-success" /> Fully automated pipeline</span>
            <span className="hidden sm:inline">·</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-success" /> 24/7 AI follow-ups</span>
          </div>
        </div>

        {/* Hero Image */}
        <div className="relative mx-auto mt-16 max-w-5xl">
          <div className="absolute -inset-4 rounded-3xl bg-primary/10 blur-2xl" />
          <div className="relative overflow-hidden rounded-2xl border border-border shadow-2xl shadow-primary/15">
            <img
              src={heroImage}
              alt="Genesis AI CRM — automated sales pipeline overview"
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
