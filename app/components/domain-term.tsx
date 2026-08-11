import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { GLOSSARY, type GlossaryTerm } from "~/lib/glossary";

// Every non-obvious domain label must render through this (CLAUDE.md UI
// conventions): dotted underline + hover tooltip with the canonical definition.
export function DomainTerm({
  term,
  children,
}: {
  term: GlossaryTerm;
  children?: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help underline decoration-dotted decoration-muted-foreground/60 underline-offset-2">
          {children ?? term}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-pretty">{GLOSSARY[term]}</TooltipContent>
    </Tooltip>
  );
}
