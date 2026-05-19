import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Bullet {
  title: string;
  body: string;
}

interface Props {
  id: string;
  eyebrow: string;
  icon: LucideIcon;
  title: ReactNode;
  tagline: string;
  body: string;
  bullets: Bullet[];
  /** Right-side product mock rendered inside an aurora frame. */
  mock: ReactNode;
  reverse?: boolean;
  /** Optional anchor-class — adjusts top scroll-margin to clear the sticky nav. */
  className?: string;
}

export function FeatureBlock({
  id,
  eyebrow,
  icon: Icon,
  title,
  tagline,
  body,
  bullets,
  mock,
  reverse = false,
  className,
}: Props) {
  return (
    <section
      id={id}
      className={cn(
        "relative scroll-mt-32 border-t border-border/60 py-20 sm:py-24",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -top-24 h-[420px] w-[640px] section-aurora opacity-40",
          reverse ? "left-0 -translate-x-1/4" : "right-0 translate-x-1/4",
        )}
      />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-16">
        <div className={cn("space-y-6", reverse && "lg:order-2")}>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Icon className="h-3.5 w-3.5" />
            {eyebrow}
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h2>
          <p className="text-lg font-medium text-foreground/80">{tagline}</p>
          <p className="text-base leading-relaxed text-muted-foreground">{body}</p>
          <ul className="space-y-3 pt-2">
            {bullets.map((b) => (
              <li key={b.title} className="flex gap-3">
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{b.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{b.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className={cn("relative", reverse && "lg:order-1")}>
          <ProductMockFrame>{mock}</ProductMockFrame>
        </div>
      </div>
    </section>
  );
}

function ProductMockFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-8 rounded-[2rem] bg-primary/8 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-2 rounded-3xl bg-gradient-to-br from-primary/25 via-[oklch(0.65_0.16_320)]/15 to-transparent opacity-60 blur-md"
      />
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/10">
        {/* Browser chrome */}
        <div className="flex items-center gap-1.5 border-b border-border/80 bg-card/80 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" aria-hidden="true" />
          <span className="ml-3 inline-flex items-center gap-1.5 rounded-md bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            app.virecrm.com
          </span>
        </div>
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}
