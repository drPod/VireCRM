import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";
import heroImage from "@/assets/hero-dashboard.jpg";

export function HeroSection() {
  const imageWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const el = imageWrapRef.current;
    if (!el) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let attached = false;

    const update = () => {
      frame = 0;
      const offset = Math.min(Math.max(window.scrollY * 0.18, 0), 80);
      el.style.setProperty("--parallax-y", `${-offset}px`);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    const attach = () => {
      if (attached) return;
      attached = true;
      update();
      window.addEventListener("scroll", onScroll, { passive: true });
    };

    const detach = () => {
      if (!attached) return;
      attached = false;
      window.removeEventListener("scroll", onScroll);
      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
      el.style.setProperty("--parallax-y", "0px");
    };

    const onMotionChange = () => {
      if (motionQuery.matches) detach();
      else attach();
    };

    onMotionChange();
    motionQuery.addEventListener("change", onMotionChange);
    return () => {
      motionQuery.removeEventListener("change", onMotionChange);
      detach();
    };
  }, []);

  return (
    <section className="relative overflow-hidden pt-16 pb-20">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[700px] w-[900px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-1/4 top-1/2 h-[400px] w-[400px] rounded-full bg-[oklch(0.65_0.16_320)]/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Custom CRM &amp; AI sales systems, built for your business
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            We design and build the system that runs your pipeline, follows up with every lead, and
            keeps deals moving — without the bloat of an off-the-shelf CRM.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild variant="command" size="lg" className="gap-2 px-8 text-base">
              <Link to="/contact">
                Book a Demo
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="px-8 text-base">
              <Link to="/preview">See It In Action</Link>
            </Button>
          </div>
        </div>

        {/* Hero Image */}
        <div
          ref={imageWrapRef}
          className="relative mx-auto mt-16 max-w-5xl will-change-transform"
          style={{ transform: "translate3d(0, var(--parallax-y, 0px), 0)" }}
        >
          <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-primary/10 blur-2xl" />
          <div className="relative overflow-hidden rounded-2xl border border-border shadow-2xl shadow-primary/15 hero-float">
            <img
              src={heroImage}
              alt="VireCRM — automated sales pipeline overview"
              width={1920}
              height={1080}
              fetchPriority="high"
              decoding="async"
              className="w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
