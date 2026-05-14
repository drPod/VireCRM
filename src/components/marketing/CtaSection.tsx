import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CtaSection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 p-12 text-center sm:p-16">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
              Stop Losing Deals You Already Paid For
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              Every lead that goes cold is money you already spent to acquire. Let your AI system
              keep them warm and ready for your team — 24/7.
            </p>
            <div className="mt-10">
              <Link to="/contact">
                <Button variant="command" size="lg" className="gap-2 px-10 text-base">
                  Apply to Get Your AI CRM System Built
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Limited spots · Custom-built for your business · Results guaranteed
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
