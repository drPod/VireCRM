/**
 * Per-lead "AI score" button.
 *
 * Calls the score-lead agent and surfaces the resulting 0-100 score with
 * positive/negative signals. The agent persists score + score_reason on
 * the leads row, so the parent drawer should refetch after success.
 */
import { useState } from "react";
import { Sparkles, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ScoreResult {
  score: number;
  reason: string;
  signals: { positive: string[]; negative: string[] };
}

export function LeadScoreButton({ leadId, onScored }: { leadId: string; onScored?: (score: number) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);

  const score = async () => {
    setLoading(true);
    setOpen(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("score-lead", {
        body: { lead_id: leadId },
      });
      if (error) throw error;
      const r = data as ScoreResult & { ok?: boolean };
      if (typeof r.score !== "number") throw new Error("No score returned");
      setResult(r);
      onScored?.(r.score);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to score";
      toast.error(msg);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={score} disabled={loading}>
        {loading ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
        )}
        AI score
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Lead score</DialogTitle>
            <DialogDescription>AI-generated fit/intent score with rationale.</DialogDescription>
          </DialogHeader>

          {loading || !result ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Scoring…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold text-primary">{result.score}</div>
                <p className="text-sm text-foreground">{result.reason}</p>
              </div>

              {result.signals.positive.length > 0 && (
                <div>
                  <p className="mb-1 flex items-center gap-1 text-xs font-medium text-success">
                    <TrendingUp className="h-3 w-3" /> Positive signals
                  </p>
                  <ul className="ml-5 list-disc space-y-0.5 text-xs text-muted-foreground">
                    {result.signals.positive.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}

              {result.signals.negative.length > 0 && (
                <div>
                  <p className="mb-1 flex items-center gap-1 text-xs font-medium text-destructive">
                    <TrendingDown className="h-3 w-3" /> Risk signals
                  </p>
                  <ul className="ml-5 list-disc space-y-0.5 text-xs text-muted-foreground">
                    {result.signals.negative.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
