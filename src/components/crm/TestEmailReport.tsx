import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Ban,
  Zap,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import { useActionLock } from "@/hooks/useActionLock";
import {
  sendQueuedTestEmailFn,
  lookupTestEmailStatusFn,
  type TestEmailStatus,
} from "@/functions/test-email.functions";

interface TestRow extends TestEmailStatus {
  sentAt: string;
}

const STORAGE_KEY = "vireon.test-email-report.v1";
const MAX_ROWS = 10;

function loadStored(): TestRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TestRow[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ROWS) : [];
  } catch {
    return [];
  }
}

function persist(rows: TestRow[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, MAX_ROWS)));
  } catch {
    /* ignore quota */
  }
}

function statusBadge(status: TestEmailStatus["status"]) {
  switch (status) {
    case "queued":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <Clock className="h-3 w-3 mr-1" /> Queued
        </Badge>
      );
    case "sending":
      return (
        <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/15">
          <Zap className="h-3 w-3 mr-1" /> Sending
        </Badge>
      );
    case "delivered":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Delivered
        </Badge>
      );
    case "suppressed":
      return (
        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/15">
          <Ban className="h-3 w-3 mr-1" /> Suppressed
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/15">
          <AlertCircle className="h-3 w-3 mr-1" /> Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Unknown
        </Badge>
      );
  }
}

export function TestEmailReport() {
  const sendFn = useAuthedServerFn(sendQueuedTestEmailFn);
  const lookupFn = useAuthedServerFn(lookupTestEmailStatusFn);
  const sendLock = useActionLock();

  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<TestRow[]>(() => loadStored());
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    persist(rows);
  }, [rows]);

  // Poll for any non-terminal rows
  useEffect(() => {
    const pending = rows.filter(
      (r) => r.status === "queued" || r.status === "sending" || r.status === "unknown",
    );
    if (pending.length === 0) {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
      return;
    }
    if (pollTimer.current) return;

    const tick = async () => {
      try {
        const ids = rows
          .filter(
            (r) => r.status === "queued" || r.status === "sending" || r.status === "unknown",
          )
          .map((r) => r.messageId);
        if (ids.length === 0) return;
        const updates = await lookupFn({ data: { messageIds: ids } });
        setRows((prev) =>
          prev.map((row) => {
            const u = updates.find((x) => x.messageId === row.messageId);
            if (!u) return row;
            return {
              ...row,
              status: u.status,
              rawStatus: u.rawStatus,
              errorMessage: u.errorMessage,
              lastUpdated: u.lastUpdated ?? row.lastUpdated,
              recipient: u.recipient || row.recipient,
            };
          }),
        );
      } catch {
        /* swallow — keep polling */
      }
    };

    void tick();
    pollTimer.current = setInterval(tick, 4000);
    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map((r) => `${r.messageId}:${r.status}`).join(",")]);

  const handleSend = async () => {
    setError(null);
    const trimmed = to.trim();
    if (!trimmed) {
      setError("Enter an email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("That doesn't look like a valid email address.");
      return;
    }
    await sendLock.run(async () => {
      try {
        const result = await sendFn({ data: { to: trimmed } });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        const newRow: TestRow = {
          messageId: result.messageId,
          recipient: result.recipient,
          status: "queued",
          rawStatus: "pending",
          errorMessage: null,
          lastUpdated: new Date().toISOString(),
          sentAt: new Date().toISOString(),
        };
        setRows((prev) => [newRow, ...prev].slice(0, MAX_ROWS));
        setTo("");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const handleClear = () => {
    setRows([]);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Test email report</CardTitle>
            <CardDescription>
              Send a test through the live email queue and watch its status update in real time
              (queued → sending → delivered or failed).
            </CardDescription>
          </div>
          {rows.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClear}>
              <Trash2 className="h-4 w-4 mr-1" /> Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            type="email"
            placeholder="recipient@example.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !sendLock.locked) {
                e.preventDefault();
                void handleSend();
              }
            }}
            disabled={sendLock.locked}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={sendLock.locked}>
            {sendLock.locked ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" /> Send test
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No test emails sent yet. Enter an address above and click <strong>Send test</strong>.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="px-6 py-2 font-medium">Recipient</th>
                  <th className="px-6 py-2 font-medium">Status</th>
                  <th className="px-6 py-2 font-medium">Sent</th>
                  <th className="px-6 py-2 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.messageId} className="border-b border-border/50 last:border-0">
                    <td className="px-6 py-3 text-foreground">{row.recipient || "—"}</td>
                    <td className="px-6 py-3">
                      <div className="flex flex-col gap-1">
                        {statusBadge(row.status)}
                        {row.errorMessage && (
                          <span
                            className="text-xs text-destructive/80 max-w-xs truncate"
                            title={row.errorMessage}
                          >
                            {row.errorMessage}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(row.sentAt), { addSuffix: true })}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground whitespace-nowrap">
                      {row.lastUpdated
                        ? formatDistanceToNow(new Date(row.lastUpdated), { addSuffix: true })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
