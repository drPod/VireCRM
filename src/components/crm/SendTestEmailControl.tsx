/**
 * Inline "Send test email" control used on the SendGrid (BYO) and Gmail
 * (connector) integration cards.
 *
 * Behavior:
 *  - Shows a "Send test email" button. Clicking it expands an inline form
 *    pre-filled with the current user's email address.
 *  - On send, calls `sendTestEmailFn` server-side which validates that the
 *    integration is fully configured (credentials present, from address set
 *    where required) and actually delivers a small message.
 *  - Result is shown inline as a success or error pill — no toast — so the
 *    feedback stays glued to the card the user is testing.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import { useServerFn } from "@tanstack/react-start";
import { useActionLock } from "@/hooks/useActionLock";
import { sendTestEmailFn } from "@/functions/connector-actions.functions";
import { CheckCircle2, AlertTriangle, Loader2, Send, X } from "lucide-react";

interface SendTestEmailControlProps {
  /** Which integration we're testing. */
  provider: "gmail" | "sendgrid";
  /** Provider display label (e.g. "Gmail"). */
  providerLabel: string;
  /** Disabled when the integration isn't ready (no key / no from address / not enabled). */
  disabledReason?: string | null;
}

type Result = { kind: "idle" } | { kind: "ok"; to: string } | { kind: "err"; reason: string };

export function SendTestEmailControl({
  provider,
  providerLabel,
  disabledReason,
}: SendTestEmailControlProps) {
  const { user, organization } = useAuth();
  const sendTestEmail = useServerFn(sendTestEmailFn);

  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(user?.email ?? "");
  // Single-flight lock — see useActionLock. Prevents a flurry of clicks on
  // "Send" from launching multiple test emails in parallel.
  const sendLock = useActionLock();
  const sending = sendLock.loading;
  const [result, setResult] = useState<Result>({ kind: "idle" });

  const disabled = !!disabledReason;

  const handleSend = async () => {
    if (!organization?.id) return;
    const trimmed = to.trim();
    if (!trimmed) {
      setResult({ kind: "err", reason: "Enter an email address to send the test to." });
      return;
    }
    // Cheap client-side sanity check — server enforces the real validation.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setResult({ kind: "err", reason: "That doesn't look like a valid email address." });
      return;
    }

    setResult({ kind: "idle" });
    await sendLock.run(async () => {
      try {
        await sendTestEmail({
          data: {
            organizationId: organization.id,
            provider,
            to: trimmed,
          },
        });
        setResult({ kind: "ok", to: trimmed });
      } catch (err) {
        const reason =
          err instanceof Error ? err.message : `Couldn't send test email via ${providerLabel}.`;
        setResult({ kind: "err", reason });
      }
    });
  };

  if (!open) {
    return (
      <div className="space-y-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setOpen(true);
            setResult({ kind: "idle" });
            if (!to) setTo(user?.email ?? "");
          }}
          disabled={disabled}
          title={disabledReason ?? undefined}
        >
          <Send className="h-3.5 w-3.5" />
          Send test email
        </Button>
        {disabled && <p className="text-[11px] text-muted-foreground">{disabledReason}</p>}
        {result.kind === "ok" && (
          <ResultPill kind="ok">Test email delivered to {result.to}.</ResultPill>
        )}
        {result.kind === "err" && <ResultPill kind="err">{result.reason}</ResultPill>}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-secondary/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11px] font-medium text-foreground">
          Send a test email via {providerLabel} to:
        </label>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setResult({ kind: "idle" });
          }}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex gap-2">
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="you@yourcompany.com"
          className="h-8 flex-1 rounded-md border border-input bg-input px-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
          autoComplete="email"
          spellCheck={false}
          disabled={sending}
        />
        <Button
          variant="command"
          size="sm"
          onClick={handleSend}
          disabled={sendLock.locked || disabled}
          aria-busy={sending}
        >
          {sending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5" />
              Send
            </>
          )}
        </Button>
      </div>
      {result.kind === "ok" && (
        <ResultPill kind="ok">
          Test email delivered to {result.to}. Check the inbox (and spam folder) within a minute.
        </ResultPill>
      )}
      {result.kind === "err" && <ResultPill kind="err">{result.reason}</ResultPill>}
      {result.kind === "idle" && !sending && disabled && disabledReason && (
        <ResultPill kind="err">{disabledReason}</ResultPill>
      )}
    </div>
  );
}

function ResultPill({ kind, children }: { kind: "ok" | "err"; children: React.ReactNode }) {
  if (kind === "ok") {
    return (
      <div className="flex items-start gap-1.5 rounded-md border border-success/30 bg-success/10 px-2 py-1.5 text-[11px] text-success">
        <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>{children}</span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
