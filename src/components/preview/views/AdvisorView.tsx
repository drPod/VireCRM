import { AlertTriangle, Flame, PenLine, Send, Sparkles, TrendingUp, Wand2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ADVISOR_PROMPT_CARDS, ADVISOR_TURNS } from "../data/advisor";

const ICONS: Record<string, LucideIcon> = {
  Flame,
  PenLine,
  TrendingUp,
  AlertTriangle,
};

export function AdvisorView() {
  return (
    <div data-tour="advisor" className="space-y-6 scroll-mt-24">
      <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-[oklch(0.65_0.16_320)]/10 p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">VireCRM AI Advisor</h2>
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-[10px] text-primary">
                Claude · grounded on your data
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Ask anything about your pipeline. The advisor pulls live context from your contacts,
              workflows, and conversations — every action is audit-logged and reversible.
            </p>
          </div>
        </div>

        <div className="relative mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ADVISOR_PROMPT_CARDS.map((p) => {
            const Icon = ICONS[p.icon] ?? Sparkles;
            return (
              <button
                key={p.id}
                type="button"
                data-preview-allow="true"
                onClick={(e) => e.preventDefault()}
                className="rounded-xl border border-border/60 bg-card/60 p-4 text-left transition-colors duration-150 hover:border-primary/40 hover:bg-primary/5 cursor-not-allowed opacity-90"
                aria-disabled="true"
                title="Sign up to run your own prompts"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="mt-3 text-sm font-semibold text-foreground">{p.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.body}</p>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <p className="text-sm font-semibold text-foreground">Today's conversation</p>
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Sparkles className="h-3 w-3 text-primary" /> Audit-logged
          </Badge>
        </div>
        <div className="space-y-5 p-5">
          {ADVISOR_TURNS.map((t) => {
            const isUser = t.role === "user";
            return (
              <div key={t.id} className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    isUser
                      ? "bg-foreground/10 text-foreground"
                      : "bg-gradient-to-br from-primary to-[oklch(0.65_0.16_320)] text-white"
                  }`}
                >
                  {isUser ? <span className="text-xs font-semibold">You</span> : <Sparkles className="h-4 w-4" />}
                </div>
                <div className={`max-w-[80%] flex-1 ${isUser ? "text-right" : ""}`}>
                  <div
                    className={`inline-block rounded-2xl px-4 py-3 text-left ${
                      isUser
                        ? "border border-border bg-card text-foreground"
                        : "bg-primary/10 text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{t.body}</p>
                    {t.citations && t.citations.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {t.citations.map((c) => (
                          <Badge key={c} variant="outline" className="text-[10px]">
                            {c}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {t.actions && t.actions.length > 0 && (
                      <TooltipProvider delayDuration={150}>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {t.actions.map((a) => (
                            <Tooltip key={a.label}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={a.kind === "run" ? "command" : "outline"}
                                  size="sm"
                                  className="cursor-not-allowed opacity-70"
                                  aria-disabled="true"
                                  onClick={(e) => e.preventDefault()}
                                >
                                  {a.label}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Sign up to execute AI actions.</TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-border/60 p-4">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <Wand2 className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-sm text-muted-foreground">
              Ask the advisor anything about your pipeline…
            </span>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="command"
                    size="sm"
                    className="gap-1.5 cursor-not-allowed opacity-70"
                    aria-disabled="true"
                    onClick={(e) => e.preventDefault()}
                  >
                    <Send className="h-3.5 w-3.5" />
                    Ask
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sign up to chat with your AI advisor.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </Card>
    </div>
  );
}
