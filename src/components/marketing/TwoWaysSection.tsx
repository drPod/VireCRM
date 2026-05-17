import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Check, Wrench, Zap, ArrowRight } from "lucide-react";

const customBuildPoints = [
  "Built around your exact workflow",
  "Fully branded and owned by you",
  "Designed to scale as you grow",
  "Optional white-label capability",
];

const doneForYouPoints = [
  "Fast setup",
  "Simple to use",
  "Continuous updates and improvements",
  "Built from proven systems",
];

export function TwoWaysSection() {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/3 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Two Ways to Build Your Sales System
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Build it — or plug into it. Either way, your pipeline runs smarter.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {/* Option 1 — Custom Build */}
          <div className="group relative rounded-2xl border border-border bg-card p-8 transition-colors hover:border-primary/40">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Wrench className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Custom Build
              </span>
            </div>

            <h3 className="text-2xl font-bold text-foreground">Own Your AI Sales Infrastructure</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              A fully custom-built CRM and automation system designed specifically for your
              business.
            </p>

            <ul className="mt-6 space-y-3">
              {customBuildPoints.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm text-foreground/90">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <Button asChild variant="command" className="w-full gap-2">
                <Link to="/contact">
                  Book a Demo <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Option 2 — Done-for-you */}
          <div className="group relative rounded-2xl border border-border bg-card p-8 transition-colors hover:border-primary/40">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Zap className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Done-for-You System
              </span>
            </div>

            <h3 className="text-2xl font-bold text-foreground">Plug Into Our Proven System</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              Get access to a ready-to-use CRM and automation system designed to start working
              immediately.
            </p>

            <ul className="mt-6 space-y-3">
              {doneForYouPoints.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm text-foreground/90">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <Button asChild variant="outline" className="w-full gap-2">
                <Link to="/pricing">
                  See Plans &amp; Pricing <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <p className="mx-auto mt-12 max-w-xl text-center text-sm italic text-muted-foreground">
          If your system requires training, it&apos;s already too complicated.
        </p>
      </div>
    </section>
  );
}
