import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface FeaturesNavItem {
  id: string;
  label: string;
}

interface Props {
  items: FeaturesNavItem[];
}

/**
 * Sticky pill nav for the /features page. Highlights the current section as
 * the user scrolls. Clicking jumps with `scrollIntoView` so we don't fight the
 * browser's native hash-routing.
 */
export function FeaturesNav({ items }: Props) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  const observed = useRef<Map<string, IntersectionObserverEntry>>(new Map());

  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
    const elements = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => Boolean(el));

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => observed.current.set(entry.target.id, entry));
        const visible = Array.from(observed.current.values()).filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        setActive(visible[0].target.id);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    elements.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  return (
    <nav
      aria-label="Feature sections"
      className="sticky top-16 z-30 -mx-6 border-b border-border/50 bg-background/85 px-6 backdrop-blur-xl"
    >
      <div className="mx-auto max-w-6xl">
        <ul className="flex gap-1 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => (
            <li key={item.id} className="shrink-0">
              <a
                href={`#${item.id}`}
                onClick={(e) => {
                  const target = document.getElementById(item.id);
                  if (!target) return;
                  e.preventDefault();
                  target.scrollIntoView({ behavior: "smooth", block: "start" });
                  if (history.replaceState) history.replaceState(null, "", `#${item.id}`);
                }}
                aria-current={active === item.id ? "true" : undefined}
                className={cn(
                  "inline-flex rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                  active === item.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
