/**
 * Inline result panel shown on integration cards after a Test run.
 *
 * Surfaces three things a non-technical owner cares about right next to the
 * Test button — without making them open a toast log:
 *
 *  - Whether the most recent verification succeeded (green check) or failed
 *    (warning triangle + the provider's error message verbatim).
 *  - When the verification was last run (relative — "5m ago", "yesterday"),
 *    with the absolute ISO timestamp on hover for support tickets.
 *  - The raw provider error string, so they can paste it to support if they
 *    can't make sense of it themselves.
 *
 * Stays mounted between runs: an old success keeps showing "Verified 5m ago"
 * until a new test replaces it with a fresh result.
 */
import { CheckCircle2, AlertTriangle, Clock } from "lucide-react";

export interface TestResult {
  ok: boolean;
  /** Provider error message — required when ok=false, ignored otherwise. */
  reason?: string | null;
  /** ISO timestamp of when the verification ran. */
  verifiedAt: string;
}

interface TestResultPanelProps {
  result: TestResult | null;
  /** Set true while a Test request is in flight, to show a subtle hint. */
  testing?: boolean;
  /** Optional human label for the provider, used in the headline. */
  providerLabel?: string;
}

export function TestResultPanel({ result, testing, providerLabel }: TestResultPanelProps) {
  if (!result && !testing) return null;

  if (testing && !result) {
    return (
      <div className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" />
        <span>Running test…</span>
      </div>
    );
  }

  if (!result) return null;

  const tone = result.ok
    ? "border-success/30 bg-success/10 text-success"
    : "border-destructive/30 bg-destructive/10 text-destructive";
  const Icon = result.ok ? CheckCircle2 : AlertTriangle;
  const headline = result.ok
    ? `${providerLabel ? `${providerLabel} ` : ""}verified successfully`
    : `${providerLabel ? `${providerLabel} ` : ""}test failed`;

  return (
    <div className={`rounded-md border px-3 py-2 ${tone}`}>
      <div className="flex items-start gap-1.5 text-[11px]">
        <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="font-medium">{headline}</div>
          {!result.ok && result.reason && (
            // Provider error verbatim — break-words so long stack-trace-y
            // strings don't blow out the card width.
            <div className="text-foreground/90 break-words leading-snug">
              {result.reason}
            </div>
          )}
          <div
            className="text-muted-foreground"
            title={new Date(result.verifiedAt).toLocaleString()}
          >
            Last test {formatRelative(result.verifiedAt)}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "just now";
  const diffMs = Date.now() - then;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "yesterday";
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}
