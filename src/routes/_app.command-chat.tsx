import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  User2,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import { executeCommandFn, type CommandPlan } from "@/functions/command.functions";
import {
  executeCommandActionsFn,
  type ExecuteCommandResponse,
} from "@/functions/command-execute.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/command-chat")({
  component: CommandChat,
  head: () => ({
    meta: [
      { title: "Command Chat — Majix" },
      {
        name: "description",
        content:
          "Chat with your AI workforce: run outreach, follow-ups, and pipeline actions in plain English.",
      },
    ],
  }),
});

type ChatMessage =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      status: "planning" | "awaiting" | "executing" | "done" | "error";
      command: string;
      plan?: CommandPlan;
      result?: ExecuteCommandResponse;
      error?: string;
    };

const SUGGESTIONS = [
  "Run outreach on 200 leads in the prospect stage",
  "Score every lead I haven't contacted in 14 days",
  "Draft personalized follow-ups for my hottest 50 leads",
  "Book intro calls with leads who replied positively this week",
];

const TIMEOUT_MS = 45_000;
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`${label} timed out`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        res(v);
      },
      (e) => {
        clearTimeout(t);
        rej(e);
      },
    );
  });
}

function CommandChat() {
  const router = useRouter();
  const planFn = useAuthedServerFn(executeCommandFn);
  const runFn = useAuthedServerFn(executeCommandActionsFn);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      status: "done",
      command: "",
      result: {
        summary:
          "Hey 👋 — I'm your AI command line. Tell me what to do (e.g. \"Run outreach on 200 leads\") and I'll plan it, then execute it on approval.",
        results: [],
      },
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const updateMsg = (id: string, patch: Partial<Extract<ChatMessage, { role: "assistant" }>>) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id && m.role === "assistant" ? { ...m, ...patch } : m)),
    );
  };

  const handleSend = async (raw?: string) => {
    const command = (raw ?? input).trim();
    if (!command || busy) return;
    setInput("");
    setBusy(true);

    const userId = `u-${Date.now()}`;
    const aiId = `a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", text: command },
      { id: aiId, role: "assistant", status: "planning", command },
    ]);

    try {
      const plan = await withTimeout(planFn({ data: { command } }), TIMEOUT_MS, "Planning");
      updateMsg(aiId, { status: "awaiting", plan });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Planning failed";
      updateMsg(aiId, { status: "error", error: msg });
      toast.error("Couldn't plan command", { description: msg });
    } finally {
      setBusy(false);
    }
  };

  const handleExecute = async (aiId: string, command: string) => {
    setBusy(true);
    updateMsg(aiId, { status: "executing" });
    try {
      const result = await withTimeout(runFn({ data: { command } }), TIMEOUT_MS * 2, "Executing");
      updateMsg(aiId, { status: "done", result });
      const errCount = result.results.filter((r) => r.status === "error").length;
      if (errCount > 0) {
        toast.warning(`Completed with ${errCount} issue${errCount === 1 ? "" : "s"}`);
      } else {
        toast.success(result.summary);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Execution failed";
      updateMsg(aiId, { status: "error", error: msg });
      toast.error("Execution failed", { description: msg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground">Command Chat</h1>
            <p className="text-xs text-muted-foreground">
              Run AI workflows in plain English. I'll plan first, then execute on your approval.
            </p>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.map((m) =>
            m.role === "user" ? (
              <UserBubble key={m.id} text={m.text} />
            ) : (
              <AssistantBubble
                key={m.id}
                msg={m}
                busy={busy}
                onExecute={() => handleExecute(m.id, m.command)}
                onCancel={() =>
                  updateMsg(m.id, {
                    status: "done",
                    result: { summary: "Cancelled.", results: [] },
                  })
                }
                onRetry={() => handleSend(m.command)}
              />
            ),
          )}
        </div>
      </div>

      <div className="border-t border-border bg-card/50 px-4 py-4">
        <div className="mx-auto max-w-3xl space-y-3">
          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void handleSend(s)}
                  disabled={busy}
                  className="rounded-md border border-border bg-secondary/50 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a command... e.g. 'Run outreach on 200 leads'"
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              disabled={busy}
            />
            <Button type="submit" size="sm" variant="command" disabled={!input.trim() || busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex items-start justify-end gap-3">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary/15 px-4 py-2.5 text-sm text-foreground border border-primary/20">
        {text}
      </div>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
        <User2 className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

function AssistantBubble({
  msg,
  busy,
  onExecute,
  onCancel,
  onRetry,
}: {
  msg: Extract<ChatMessage, { role: "assistant" }>;
  busy: boolean;
  onExecute: () => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15">
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 space-y-2">
        {msg.status === "planning" && (
          <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Planning <span className="text-foreground font-medium">{msg.command}</span>...
          </div>
        )}

        {msg.status === "awaiting" && msg.plan && (
          <div className="rounded-2xl rounded-tl-sm border border-border bg-card p-4 text-sm space-y-3">
            <div className="flex items-start gap-2">
              <Zap className="mt-0.5 h-4 w-4 text-primary" />
              <p className="text-foreground">{msg.plan.summary}</p>
            </div>
            <ol className="space-y-1.5 pl-6">
              {msg.plan.steps.map((s) => (
                <li key={s.step} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{s.action}</span>
                  {s.detail ? ` — ${s.detail}` : null}
                  <span className="ml-1 text-muted-foreground/70">({s.estimatedTime})</span>
                </li>
              ))}
            </ol>
            {msg.plan.warnings?.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <ul className="space-y-0.5">
                  {msg.plan.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" variant="command" onClick={onExecute} disabled={busy}>
                <Play className="mr-1.5 h-3.5 w-3.5" />
                Run plan
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
                Cancel
              </Button>
              <span className="ml-auto text-xs text-muted-foreground">
                Est. {msg.plan.estimatedTotal}
              </span>
            </div>
          </div>
        )}

        {msg.status === "executing" && (
          <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Executing your plan...
          </div>
        )}

        {msg.status === "done" && msg.result && (
          <div className="rounded-2xl rounded-tl-sm border border-border bg-card p-4 text-sm space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
              <p className="text-foreground">{msg.result.summary}</p>
            </div>
            {msg.result.results.length > 0 && (
              <ul className="space-y-1 pl-6 text-xs">
                {msg.result.results.map((r, i) => (
                  <li
                    key={`${r.handler}-${i}`}
                    className={r.status === "error" ? "text-destructive" : "text-muted-foreground"}
                  >
                    <span className="font-medium text-foreground">{r.handler}</span>
                    {r.message ? ` — ${r.message}` : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {msg.status === "error" && (
          <div className="rounded-2xl rounded-tl-sm border border-destructive/30 bg-destructive/5 p-4 text-sm space-y-2">
            <div className="flex items-start gap-2 text-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
              <p>{msg.error || "Something went wrong."}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={onRetry} disabled={busy}>
              Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
