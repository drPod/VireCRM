import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck } from "lucide-react";
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
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Turn Every Lead Into Revenue
            <br />
            <span className="text-gradient-primary">—Automatically</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            We build AI-powered CRM systems that follow up, nurture, and close your leads for you—so your business keeps selling even when you're not working.
          </p>

          <p className="mx-auto mt-4 max-w-lg text-sm text-muted-foreground/80">
            No missed follow-ups. No manual chasing. No lost deals from slow response times.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/contact">
              <Button variant="command" size="lg" className="gap-2 px-8 text-base">
                Apply to Get Your AI System Built
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-success" /> Custom-built for your business</span>
            <span className="hidden sm:inline">·</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-success" /> Fully automated pipeline</span>
            <span className="hidden sm:inline">·</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-success" /> 24/7 AI follow-ups</span>
          </div>
        </div>

        {/* Hero Image */}
        <div className="relative mx-auto mt-16 max-w-4xl">
          <div className="absolute -inset-4 rounded-2xl bg-primary/5 blur-2xl" />
          <div className="relative overflow-hidden rounded-xl border border-border shadow-2xl shadow-primary/10">
            <img
              src={heroImage}
              alt="Vireon AI CRM Dashboard — automated sales pipeline"
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
