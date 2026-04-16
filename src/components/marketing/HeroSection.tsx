import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Crown } from "lucide-react";
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
            <Crown className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">Own Your AI Sales Engine — Forever</span>
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Buy Your Own
            <br />
            <span className="text-gradient-primary">AI-Powered CRM</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Full white-label Vireon CRM — your brand, your domain, your source code.
            One-time purchase. No monthly fees. No revenue sharing. It's yours forever.
          </p>

          {/* Price anchor */}
          <div className="mx-auto mt-8 inline-flex items-baseline gap-2 rounded-xl border border-accent/30 bg-accent/5 px-6 py-3">
            <span className="text-4xl font-bold text-foreground">$10,000</span>
            <span className="text-sm text-muted-foreground">one-time · full ownership</span>
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/pricing">
              <Button variant="command" size="lg" className="gap-2 px-8">
                Get Full Ownership
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button variant="outline" size="lg">Or Lease from $249/mo</Button>
            </Link>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Source code included · White-label ready · Unlimited leads
          </p>
        </div>

        {/* Hero Image */}
        <div className="relative mx-auto mt-16 max-w-4xl">
          <div className="absolute -inset-4 rounded-2xl bg-primary/5 blur-2xl" />
          <div className="relative overflow-hidden rounded-xl border border-border shadow-2xl shadow-primary/10">
            <img
              src={heroImage}
              alt="Vireon CRM Dashboard showing autonomous sales pipeline management"
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
