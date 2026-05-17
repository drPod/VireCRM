import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
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
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3 w-3" />
            Custom-built CRM &amp; AI sales systems
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Custom CRM &amp; AI Sales Systems
            <br />
            <span className="text-gradient-primary [-webkit-text-fill-color:transparent] drop-shadow-[0_2px_12px_oklch(0.65_0.2_250/0.35)]">
              Built for Your Business
            </span>
            <br />
            <span className="text-2xl font-medium text-muted-foreground sm:text-3xl lg:text-4xl">
              — Not One-Size-Fits-All
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            More than a CRM — this is your AI-powered sales system. We design and build custom
            systems that manage your pipeline, follow up with every lead, and keep your sales
            process moving — without the complexity of traditional CRMs.
          </p>

          <p className="mx-auto mt-4 max-w-xl text-sm font-medium text-foreground/80">
            Built for real estate, agencies, solar, roofing, home services, and coaching businesses.
          </p>

          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground/80">
            All the power of a CRM. None of the complexity.
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

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-success" /> Set up in days, not months
            </span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-success" /> No technical skills required
            </span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-success" /> Automated follow-up built in
            </span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-success" /> Pipeline runs 24/7
            </span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-success" /> Built around how you sell
            </span>
          </div>

          <div className="mx-auto mt-10 max-w-xl rounded-xl border border-primary/20 bg-primary/5 px-6 py-5">
            <p className="text-sm text-muted-foreground">Most businesses rent their systems.</p>
            <p className="mt-1 text-base font-semibold text-foreground">
              Leaders build assets — and control their growth.
            </p>
          </div>
        </div>

        {/* Hero Image */}
        <div
          ref={imageWrapRef}
          className="relative mx-auto mt-16 max-w-5xl will-change-transform"
          style={{ transform: "translate3d(0, var(--parallax-y, 0px), 0)" }}
        >
          <div className="pointer-events-none absolute -inset-12 rounded-[2rem] hero-aurora opacity-70" />
          <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-primary/10 blur-2xl" />
          <div className="relative overflow-hidden rounded-2xl border border-border shadow-2xl shadow-primary/15 hero-float">
            <img
              src={heroImage}
              alt="Majix AI CRM — automated sales pipeline overview"
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
