import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
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
    return raw ? (JSON.parse(raw) as Stored) : null;
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

  const createFn = useServerFn(createTestAccount);
  const revokeFn = useServerFn(revokeTestAccount);

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
