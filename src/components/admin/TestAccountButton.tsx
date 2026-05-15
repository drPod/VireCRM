import { useEffect, useState } from "react";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  KeyRound,
  Copy,
  Loader2,
  Trash2,
  CheckCircle2,
  XCircle,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import {
  createTestAccount,
  revokeTestAccount,
} from "@/lib/test-account.functions";
import { handleAuthError } from "@/lib/server-fn-auth";
import { runAuditAs, type AuditCheck } from "@/lib/audit-runner";

type Stored = { userId: string; email: string; password: string };

const STORAGE_KEY = "genesis.test-account.last";

function readStored(): Stored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    // Self-heal: an earlier bug shipped empty email/password (server fn
    // call wasn't auth'd, so the wrapped result envelope had blank fields).
    // Treat that as "no account" so the UI lets the user re-Generate.
    if (!parsed?.email || !parsed?.password || !parsed?.userId) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function TestAccountButton() {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [account, setAccount] = useState<Stored | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [auditResults, setAuditResults] = useState<AuditCheck[] | null>(null);

  const createFn = useAuthedServerFn(createTestAccount);
  const revokeFn = useAuthedServerFn(revokeTestAccount);

  useEffect(() => {
    if (open) setAccount(readStored());
  }, [open]);

  const onCreate = async () => {
    setCreating(true);
    try {
      const res = await createFn();
      const next: Stored = res;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setAccount(next);
      toast.success("Test account created");
    } catch (e) {
      if (handleAuthError(e)) return;
      toast.error(e instanceof Error ? e.message : "Failed to create account");
    } finally {
      setCreating(false);
    }
  };

  const onRevoke = async () => {
    if (!account) return;
    setRevoking(true);
    try {
      await revokeFn({ data: { userId: account.userId } });
      localStorage.removeItem(STORAGE_KEY);
      setAccount(null);
      toast.success("Test account revoked");
    } catch (e) {
      if (handleAuthError(e)) return;
      toast.error(e instanceof Error ? e.message : "Failed to revoke account");
    } finally {
      setRevoking(false);
    }
  };

  const onRunAudit = async () => {
    if (!account) return;
    setAuditing(true);
    setAuditResults(null);
    try {
      const results = await runAuditAs(account.email, account.password);
      setAuditResults(results);
      const failed = results.filter((r) => r.status === "fail").length;
      if (failed === 0) toast.success(`Audit passed (${results.length} checks)`);
      else toast.error(`Audit: ${failed} of ${results.length} check(s) failed`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Audit crashed");
    } finally {
      setAuditing(false);
    }
  };

  const copy = (label: string, value: string) => {
    navigator.clipboard.writeText(value).then(
      () => toast.success(`${label} copied`),
      () => toast.error(`Could not copy ${label.toLowerCase()}`),
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <KeyRound className="h-4 w-4" />
          Test account
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Temporary test account</DialogTitle>
          <DialogDescription>
            One-click throwaway login scoped to your workspace. Revoke when
            you&rsquo;re done — the user, profile and role are deleted.
          </DialogDescription>
        </DialogHeader>

        {account ? (
          <div className="space-y-3 rounded-md border border-border bg-card/50 p-3 text-sm">
            <div className="flex items-center gap-2 text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-medium">Active test account</span>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">Email</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">
                  {account.email}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => copy("Email", account.email)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">Password</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">
                  {account.password}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => copy("Password", account.password)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Stored locally in this browser only. Reload-safe. Use it in an
              incognito window so it doesn&rsquo;t replace your own session.
            </p>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
            No active test account. Click <strong>Generate</strong> to create
            one.
          </div>
        )}

        {account && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-medium text-foreground">
                Audit results
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={onRunAudit}
                disabled={auditing}
                className="gap-1.5"
              >
                {auditing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Running
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Run audit
                  </>
                )}
              </Button>
            </div>
            {auditResults && (
              <div className="max-h-[40vh] space-y-1 overflow-y-auto rounded-md border border-border bg-card/40 p-2">
                {auditResults.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start gap-2 px-1.5 py-1 text-xs"
                  >
                    <div className="mt-0.5">
                      {c.status === "pass" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground">
                        {c.label}
                      </div>
                      {c.detail && (
                        <div
                          className={`mt-0.5 break-words ${
                            c.status === "fail"
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }`}
                        >
                          {c.detail}
                        </div>
                      )}
                      {c.status === "fail" && c.failure && (
                        <div className="mt-1.5 space-y-1 rounded border border-destructive/30 bg-destructive/5 p-2 font-mono text-[10.5px] leading-relaxed text-destructive/90">
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                            {c.failure.code && (
                              <span>
                                <span className="opacity-60">code:</span>{" "}
                                {c.failure.code}
                              </span>
                            )}
                            {c.failure.status !== undefined && (
                              <span>
                                <span className="opacity-60">http:</span>{" "}
                                {c.failure.status}
                              </span>
                            )}
                            {c.failure.table && (
                              <span>
                                <span className="opacity-60">table:</span>{" "}
                                {c.failure.table}
                              </span>
                            )}
                            {c.failure.operation && (
                              <span>
                                <span className="opacity-60">op:</span>{" "}
                                {c.failure.operation}
                              </span>
                            )}
                          </div>
                          {c.failure.details && (
                            <div>
                              <span className="opacity-60">details:</span>{" "}
                              {c.failure.details}
                            </div>
                          )}
                          {c.failure.hint && (
                            <div>
                              <span className="opacity-60">hint:</span>{" "}
                              {c.failure.hint}
                            </div>
                          )}
                          {c.failure.policyHint && (
                            <div className="mt-1 rounded bg-destructive/10 px-1.5 py-1 font-sans text-[11px] text-destructive">
                              {c.failure.policyHint}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="tabular-nums text-muted-foreground">
                      {c.ms}ms
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Audit signs in as the test account in an isolated client. Your
              own session in this tab is preserved — no logout, no redirect.
            </p>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          {account ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onRevoke}
              disabled={revoking}
            >
              {revoking ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Revoking
                </>
              ) : (
                <>
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Revoke
                </>
              )}
            </Button>
          ) : (
            <span />
          )}
          <Button
            type="button"
            size="sm"
            onClick={onCreate}
            disabled={creating || !!account}
          >
            {creating ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Generating
              </>
            ) : (
              "Generate"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
