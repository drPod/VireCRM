import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CtaSection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 p-12 text-center">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-3xl font-bold text-foreground">
              Ready to Automate Your Sales?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Start your 14-day free trial. No credit card required. Set up in under 5 minutes.
            </p>
            <div className="mt-8">
              <Link to="/signup">
                <Button variant="command" size="lg" className="gap-2 px-8">
                  Get Started Free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
