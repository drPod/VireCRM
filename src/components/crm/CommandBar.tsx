import { useState } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CommandBarProps {
  onCommand?: (command: string) => void;
  isProcessing?: boolean;
}

export function CommandBar({ onCommand, isProcessing = false }: CommandBarProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    onCommand?.(input.trim());
    setInput("");
  };

  const suggestions = [
    "Remind me to follow up with my hottest leads tomorrow",
    "Draft a re-engagement email for cold leads",
    "Boost score on leads I've contacted this week",
    "Create a Q1 outbound campaign and summarize my pipeline",
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a command... e.g. 'Run outreach on 200 leads'"
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          disabled={isProcessing}
        />
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              {/* span wrapper so the tooltip still triggers when the button is disabled */}
              <span tabIndex={!input.trim() && !isProcessing ? 0 : -1} className="inline-flex">
                <Button
                  type="submit"
                  size="sm"
                  variant="command"
                  disabled={!input.trim() || isProcessing}
                  aria-label="Send command"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {isProcessing
                ? "Sending command..."
                : !input.trim()
                  ? "Type a command to send"
                  : "Send command"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </form>

      {!input && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => setInput(s)}
              className="rounded-md border border-border bg-secondary/50 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
