import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";

/**
 * Wrap any domain term with a hover tooltip carrying its glossary definition.
 *
 * Per CLAUDE.md §UI: "Every domain label with non-obvious meaning gets a hover
 * tooltip." Canonical definitions live in the project CLAUDE.md Domain
 * glossary — pass the same prose here.
 *
 * Relies on the app-level `<TooltipProvider>` rendered in `app/root.tsx`.
 */
export function GlossaryTooltip({
  term,
  definition,
  children,
}: {
  term: string;
  definition: string;
  children?: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <abbr
          title={definition}
          className="cursor-help underline decoration-dotted underline-offset-2 decoration-muted-foreground/60"
        >
          {children ?? term}
        </abbr>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-balance">
        <p>
          <span className="font-semibold">{term}:</span> {definition}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
