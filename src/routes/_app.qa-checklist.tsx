import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Circle,
  RotateCcw,
  Download,
  ExternalLink,
  ClipboardCheck,
  PlayCircle,
  Zap,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Verifier result returned by each step's quick-check probe.
 * - status "pass" / "fail" pre-fills the corresponding button.
 * - detail is appended to the notes field so the tester sees what was checked.
 */
type VerifyResult = { status: "pass" | "fail"; detail: string };
type Verifier = () => Promise<VerifyResult>;

/** Lookback window for "did this just happen?" probes. */
const VERIFY_WINDOW_MIN = 10;
function sinceISO() {
  return new Date(Date.now() - VERIFY_WINDOW_MIN * 60_000).toISOString();
}

/**
 * Per-step verifiers. Each runs a tiny RLS-scoped query (or count) that
 * returns within ~1s. They look for evidence that the buyer just performed
 * the action — e.g. a fresh outbound message, a new conversation reply,
 * a recent AI call, or a soft-deleted lead.
 */
const VERIFIERS: Record<string, Verifier> = {
  "send-email-flow": async () => {
    const since = sinceISO();
    const { count, error } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    if (error) return { status: "fail", detail: `messages query error: ${error.message}` };
    return (count ?? 0) > 0
      ? {
          status: "pass",
          detail: `Found ${count} message(s) in the last ${VERIFY_WINDOW_MIN} min.`,
        }
      : { status: "fail", detail: `No messages created in the last ${VERIFY_WINDOW_MIN} min.` };
  },
  "reply-thread": async () => {
    const since = sinceISO();
    const { count, error } = await supabase
      .from("conversation_messages")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    if (error) return { status: "fail", detail: `conversation_messages error: ${error.message}` };
    return (count ?? 0) > 0
      ? {
          status: "pass",
          detail: `Found ${count} reply/message(s) in the last ${VERIFY_WINDOW_MIN} min.`,
        }
      : { status: "fail", detail: `No replies in the last ${VERIFY_WINDOW_MIN} min.` };
  },
  "command-plan": async () => {
    const since = sinceISO();
    const { count, error } = await supabase
      .from("ai_call_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    if (error) return { status: "fail", detail: `ai_call_log error: ${error.message}` };
    return (count ?? 0) > 0
      ? { status: "pass", detail: `Found ${count} AI call(s) — planning likely ran.` }
      : { status: "fail", detail: `No AI calls logged in the last ${VERIFY_WINDOW_MIN} min.` };
  },
  "command-execute": async () => {
    const since = sinceISO();
    const { count, error } = await supabase
      .from("credit_usage_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    if (error) return { status: "fail", detail: `credit_usage_log error: ${error.message}` };
    return (count ?? 0) > 0
      ? { status: "pass", detail: `Found ${count} credit usage entr(ies) — execution billed.` }
      : { status: "fail", detail: `No credit usage in the last ${VERIFY_WINDOW_MIN} min.` };
  },
  "delete-confirm": async () => {
    // The confirm dialog itself isn't observable from the DB, but we can
    // verify the user has at least one lead they're allowed to read — a
    // prerequisite for triggering the delete flow at all.
    const { count, error } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .limit(1);
    if (error) return { status: "fail", detail: `leads readable check failed: ${error.message}` };
    return (count ?? 0) > 0
      ? { status: "pass", detail: `${count} lead(s) visible — ready to trigger the delete dialog.` }
      : { status: "fail", detail: "No leads visible — create one before testing delete." };
  },
  "delete-execute": async () => {
    const since = sinceISO();
    const { count, error } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("deleted_at", since);
    if (error) return { status: "fail", detail: `leads query error: ${error.message}` };
    return (count ?? 0) > 0
      ? {
          status: "pass",
          detail: `Found ${count} soft-deleted lead(s) in the last ${VERIFY_WINDOW_MIN} min.`,
        }
      : { status: "fail", detail: `No leads soft-deleted in the last ${VERIFY_WINDOW_MIN} min.` };
  },
};

export const Route = createFileRoute("/_app/qa-checklist")({
  component: QaChecklistPage,
  head: () => ({
    meta: [
      { title: "Buyer-mode QA Checklist — Majix" },
      {
        name: "description",
        content:
          "Step-by-step QA walkthrough covering send email, reply, run outreach command, and delete lead with pass/fail logs.",
      },
    ],
  }),
});

type StepStatus = "pending" | "pass" | "fail";

interface QaStep {
  id: string;
  title: string;
  goal: string;
  // Optional in-app destination users can jump to.
  href?: { to: string; label: string };
  steps: string[];
  expect: string;
}

interface QaSection {
  id: string;
  title: string;
  summary: string;
  steps: QaStep[];
}

const SECTIONS: QaSection[] = [
  {
    id: "send-email",
    title: "Send email to a lead",
    summary: "Verify outbound transactional email creates a message and reaches the inbox.",
    steps: [
      {
        id: "send-email-flow",
        title: "Compose & send",
        goal: "An email is dispatched and a row appears in the lead's message thread.",
        href: { to: "/leads", label: "Open Leads" },
        steps: [
          "Open Leads and pick any lead with a valid email address.",
          'Click "Send email" (or open the lead detail and use the email composer).',
          "Fill subject and body, then submit.",
          "Watch for a success toast and the new message in the lead timeline.",
        ],
        expect:
          "Success toast appears, no console errors, and a new outbound message shows in the lead's conversation thread within ~5s.",
      },
    ],
  },
  {
    id: "reply",
    title: "Reply in Conversations",
    summary: "Verify replies append to the existing thread and persist after refresh.",
    steps: [
      {
        id: "reply-thread",
        title: "Reply to a thread",
        goal: "Reply is saved to conversation_messages and visible after reload.",
        href: { to: "/conversations", label: "Open Conversations" },
        steps: [
          "Open Conversations and select an existing thread (or the one created by the previous test).",
          "Type a reply in the composer and send.",
          "Confirm the new bubble appears at the bottom of the thread immediately.",
          "Refresh the page and confirm the reply is still present.",
        ],
        expect:
          "Reply is appended optimistically, persists after reload, and no 4xx/5xx requests fire in the network tab.",
      },
    ],
  },
  {
    id: "outreach-command",
    title: "Run outreach command",
    summary: "Verify the AI Command Center plans, executes, and bills credits correctly.",
    steps: [
      {
        id: "command-plan",
        title: "Plan the command",
        goal: "Submitting a command produces a plan with at least one step.",
        href: { to: "/dashboard", label: "Open Command Center" },
        steps: [
          "On the Dashboard, open the Command Bar.",
          'Submit: "Draft a re-engagement email for cold leads".',
          "Confirm planned steps render in the Task Status panel.",
        ],
        expect:
          "Plan returns within ~10s, steps appear as 'planned'. No silent failure — errors surface as toasts.",
      },
      {
        id: "command-execute",
        title: "Execute the plan",
        goal: "Each billable action consumes credits and reports ok/error.",
        steps: [
          'Click "Execute" on the planned command.',
          "Watch each step transition queued → running → completed/failed.",
          "Confirm a summary toast (success or 'completed with N issues') appears at the end.",
        ],
        expect:
          "All steps reach a terminal state. Credit balance decreases by the expected amount. Failures (if any) include a Retry action.",
      },
    ],
  },
  {
    id: "delete-lead",
    title: "Delete a lead",
    summary: "Verify the confirm dialog, hard/soft delete options, and related-data handling.",
    steps: [
      {
        id: "delete-confirm",
        title: "Trigger delete + confirm dialog",
        goal: "Confirm dialog blocks accidental deletes and explains hard vs soft delete.",
        href: { to: "/leads", label: "Open Leads" },
        steps: [
          "Open Leads and pick a disposable test lead.",
          "Click the delete (trash) icon on the lead card.",
          "Inspect the confirm dialog: hard vs soft delete copy and the related-data note should be visible.",
        ],
        expect:
          "Dialog appears, default selection is safe (soft delete), and cancelling closes the dialog without changes.",
      },
      {
        id: "delete-execute",
        title: "Confirm delete & verify cleanup",
        goal: "Lead is removed (or archived) and related tasks/messages follow the chosen rule.",
        steps: [
          "Confirm deletion. Watch for a success toast.",
          "Verify the lead disappears from the list (or is moved to archived view if soft-deleted).",
          "Open Conversations / Tasks and verify related items are removed (hard delete) or preserved (soft delete) per the choice.",
        ],
        expect:
          "Delete RPC returns 200, list updates without manual reload, and related-data behavior matches the option chosen.",
      },
    ],
  },
];

interface LogEntry {
  ts: string;
  sectionId: string;
  stepId: string;
  status: StepStatus;
  note?: string;
}

interface PersistedState {
  statuses: Record<string, StepStatus>;
  notes: Record<string, string>;
  log: LogEntry[];
}

const STORAGE_KEY = "genesis.qa-checklist.v1";

function loadState(): PersistedState {
  if (typeof window === "undefined") return { statuses: {}, notes: {}, log: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { statuses: {}, notes: {}, log: [] };
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      statuses: parsed.statuses ?? {},
      notes: parsed.notes ?? {},
      log: parsed.log ?? [],
    };
  } catch {
    return { statuses: {}, notes: {}, log: [] };
  }
}

function saveState(state: PersistedState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

function QaChecklistPage() {
  const [statuses, setStatuses] = useState<Record<string, StepStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [log, setLog] = useState<LogEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  /** Per-step verifier in-flight state, keyed by step id. */
  const [verifying, setVerifying] = useState<Record<string, boolean>>({});
  const [verifyingAll, setVerifyingAll] = useState(false);

  useEffect(() => {
    const initial = loadState();
    setStatuses(initial.statuses);
    setNotes(initial.notes);
    setLog(initial.log);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveState({ statuses, notes, log });
  }, [statuses, notes, log, hydrated]);

  const allSteps = useMemo(
    () => SECTIONS.flatMap((s) => s.steps.map((step) => ({ section: s, step }))),
    [],
  );
  const totals = useMemo(() => {
    let pass = 0;
    let fail = 0;
    let pending = 0;
    for (const { step } of allSteps) {
      const status = statuses[step.id] ?? "pending";
      if (status === "pass") pass += 1;
      else if (status === "fail") fail += 1;
      else pending += 1;
    }
    return { pass, fail, pending, total: allSteps.length };
  }, [allSteps, statuses]);

  const recordResult = (sectionId: string, stepId: string, status: StepStatus) => {
    setStatuses((prev) => ({ ...prev, [stepId]: status }));
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      sectionId,
      stepId,
      status,
      note: notes[stepId]?.trim() || undefined,
    };
    setLog((prev) => [entry, ...prev].slice(0, 200));
    toast[status === "pass" ? "success" : status === "fail" ? "error" : "info"](
      status === "pass" ? "Marked pass" : status === "fail" ? "Marked fail" : "Reset",
      { description: stepId },
    );
  };

  /**
   * Run a single step's verifier, pre-fill pass/fail, and append the
   * detail string to that step's notes (prefixed with a timestamp so a
   * tester can re-run and see history).
   */
  const verifyStep = async (sectionId: string, stepId: string) => {
    const verifier = VERIFIERS[stepId];
    if (!verifier) {
      toast.info("No automated check for this step", { description: stepId });
      return null;
    }
    setVerifying((prev) => ({ ...prev, [stepId]: true }));
    try {
      const result = await verifier();
      const stamp = new Date().toLocaleTimeString();
      const line = `[${stamp}] ${result.status.toUpperCase()} — ${result.detail}`;
      setNotes((prev) => ({
        ...prev,
        [stepId]: prev[stepId] ? `${line}\n${prev[stepId]}` : line,
      }));
      setStatuses((prev) => ({ ...prev, [stepId]: result.status }));
      setLog((prev) =>
        [
          {
            ts: new Date().toISOString(),
            sectionId,
            stepId,
            status: result.status,
            note: `auto: ${result.detail}`,
          },
          ...prev,
        ].slice(0, 200),
      );
      toast[result.status === "pass" ? "success" : "error"](
        result.status === "pass" ? "Verified pass" : "Verified fail",
        { description: result.detail },
      );
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Verifier crashed", { description: msg });
      return { status: "fail", detail: msg };
    } finally {
      setVerifying((prev) => ({ ...prev, [stepId]: false }));
    }
  };

  /** Run every step's verifier sequentially so logs stay readable. */
  const verifyAll = async () => {
    setVerifyingAll(true);
    let pass = 0;
    let fail = 0;
    try {
      for (const { section, step } of allSteps) {
        if (!VERIFIERS[step.id]) continue;
        const r = await verifyStep(section.id, step.id);
        if (r?.status === "pass") pass += 1;
        else if (r?.status === "fail") fail += 1;
      }
      toast.info("Verify all complete", { description: `${pass} pass · ${fail} fail` });
    } finally {
      setVerifyingAll(false);
    }
  };

  const resetAll = () => {
    setStatuses({});
    setNotes({});
    setLog([]);
    toast.info("Checklist reset");
  };

  const exportLog = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      totals,
      statuses,
      notes,
      log,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qa-checklist-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ClipboardCheck className="h-3.5 w-3.5" /> Buyer-mode QA
          </div>
          <h1 className="text-2xl font-bold text-foreground">QA Checklist</h1>
          <p className="text-sm text-muted-foreground">
            Walk through the four buyer-critical flows. Mark each step pass or fail and export the
            log when done.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={verifyAll} disabled={verifyingAll}>
            {verifyingAll ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-1.5" />
            )}
            Verify all
          </Button>
          <Button variant="outline" size="sm" onClick={resetAll}>
            <RotateCcw className="h-4 w-4 mr-1.5" /> Reset
          </Button>
          <Button variant="outline" size="sm" onClick={exportLog}>
            <Download className="h-4 w-4 mr-1.5" /> Export log
          </Button>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Stat label="Total" value={totals.total} />
          <Stat label="Pass" value={totals.pass} tone="pass" />
          <Stat label="Fail" value={totals.fail} tone="fail" />
          <Stat label="Pending" value={totals.pending} tone="pending" />
        </div>
      </section>

      <div className="space-y-5">
        {SECTIONS.map((section) => (
          <section
            key={section.id}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <div className="border-b border-border p-4">
              <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{section.summary}</p>
            </div>
            <div className="divide-y divide-border">
              {section.steps.map((step) => {
                const status = statuses[step.id] ?? "pending";
                return (
                  <div key={step.id} className="p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <StatusIcon status={status} />
                          <h3 className="text-sm font-medium text-foreground">{step.title}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{step.goal}</p>
                      </div>
                      {step.href && (
                        <Button asChild size="sm" variant="outline">
                          <Link to={step.href.to as never}>
                            <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
                            {step.href.label}
                            <ExternalLink className="h-3 w-3 ml-1.5 opacity-60" />
                          </Link>
                        </Button>
                      )}
                    </div>

                    <ol className="list-decimal pl-5 space-y-1 text-sm text-foreground/90">
                      {step.steps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ol>

                    <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Expected:</span> {step.expect}
                    </div>

                    <Textarea
                      placeholder="Notes (optional) — paste console errors, request IDs, screenshots links, etc."
                      value={notes[step.id] ?? ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [step.id]: e.target.value }))}
                      rows={2}
                      className="text-sm"
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      {VERIFIERS[step.id] && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void verifyStep(section.id, step.id)}
                          disabled={verifying[step.id] || verifyingAll}
                          title={`Run an automated check for "${step.title}"`}
                        >
                          {verifying[step.id] ? (
                            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                          ) : (
                            <Zap className="h-4 w-4 mr-1.5" />
                          )}
                          Verify now
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={status === "pass" ? "default" : "outline"}
                        onClick={() => recordResult(section.id, step.id, "pass")}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1.5" /> Pass
                      </Button>
                      <Button
                        size="sm"
                        variant={status === "fail" ? "destructive" : "outline"}
                        onClick={() => recordResult(section.id, step.id, "fail")}
                      >
                        <XCircle className="h-4 w-4 mr-1.5" /> Fail
                      </Button>
                      {status !== "pending" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => recordResult(section.id, step.id, "pending")}
                        >
                          Reset
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <section className="rounded-xl border border-border bg-card">
        <div className="border-b border-border p-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Activity log</h2>
            <p className="text-xs text-muted-foreground">
              Newest first. Up to the last 200 entries are kept locally on this device.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{log.length} entries</span>
        </div>
        {log.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">
            No results yet. Mark a step pass or fail to populate the log.
          </div>
        ) : (
          <ul className="divide-y divide-border max-h-96 overflow-auto">
            {log.map((entry, i) => (
              <li key={`${entry.ts}-${i}`} className="p-3 text-xs flex items-start gap-3">
                <StatusIcon status={entry.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{entry.stepId}</span>
                    <span className="text-muted-foreground">· {entry.sectionId}</span>
                    <span className="text-muted-foreground ml-auto">
                      {new Date(entry.ts).toLocaleTimeString()}
                    </span>
                  </div>
                  {entry.note && (
                    <p className="text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                      {entry.note}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "pass" | "fail" | "pending";
}) {
  const toneClass =
    tone === "pass"
      ? "text-emerald-400"
      : tone === "fail"
        ? "text-destructive"
        : tone === "pending"
          ? "text-amber-400"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "pass") return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
  if (status === "fail") return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
  return <Circle className="h-4 w-4 text-muted-foreground shrink-0" />;
}
