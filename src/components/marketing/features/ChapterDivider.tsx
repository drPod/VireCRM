import type { ReactNode } from "react";

interface Props {
  id: string;
  number: string;
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
}

/** Numbered chapter divider — Linear/Attio narrative pattern. */
export function ChapterDivider({ id, number, eyebrow, title, subtitle }: Props) {
  return (
    <section
      id={id}
      className="relative scroll-mt-24 border-t border-border/60 bg-gradient-to-b from-background to-card/40 py-20 sm:py-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      />
      <div className="relative mx-auto max-w-5xl px-6 text-center">
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {number} · {eyebrow}
        </span>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            {subtitle}
          </p>
        ) : null}
      </div>
    </section>
  );
}
