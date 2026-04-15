import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Crown } from "lucide-react";

export function CtaSection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 p-12 text-center">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
          </div>
          <div className="relative">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5">
              <Crown className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">Full Ownership</span>
            </div>
            <h2 className="text-3xl font-bold text-foreground">
              Own Your AI CRM for $10,000
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              One payment. Full source code. Your brand, your servers, your business — forever.
              No monthly fees, no revenue sharing, no limits.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/pricing">
                <Button variant="command" size="lg" className="gap-2 px-8">
                  See Ownership Details
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/contact">
                <Button variant="outline" size="lg">
                  Need Custom Features? Contact Us
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
