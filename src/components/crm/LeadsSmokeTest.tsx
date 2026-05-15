import { useState } from "react";
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
import { Stethoscope, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  notifyLeadsChanged,
  onLeadsChanged,
} from "@/lib/leads-events";
import { toast } from "sonner";

type CheckStatus = "pending" | "running" | "pass" | "fail";
type Check = {
  id: string;
  label: string;
  status: CheckStatus;
  detail?: string;
  ms?: number;
};

const INITIAL_CHECKS: Check[] = [
  { id: "auth", label: "Authenticated session + organization", status: "pending" },
  { id: "list", label: "List leads (RLS read)", status: "pending" },
  { id: "filter", label: "Filter leads by status", status: "pending" },
  { id: "insert", label: "Insert test lead", status: "pending" },
  { id: "update", label: "Update lead status → contacted", status: "pending" },
  { id: "event", label: "UI event bus (leads:changed) fires", status: "pending" },
  { id: "soft-delete", label: "Soft-delete test lead", status: "pending" },
  { id: "cleanup", label: "Hard-delete test lead", status: "pending" },
];

const TEST_TAG = "__smoketest__";

export function LeadsSmokeTest() {
  const { organization, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [checks, setChecks] = useState<Check[]>(INITIAL_CHECKS);

  const update = (id: string, patch: Partial<Check>) =>
    setChecks((cur) => cur.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const run = async (id: string, fn: () => Promise<string | void>) => {
    update(id, { status: "running" });
    const t0 = performance.now();
    try {
      const detail = await fn();
      update(id, {
        status: "pass",
        detail: detail || undefined,
        ms: Math.round(performance.now() - t0),
      });
      return true;
    } catch (e) {
      update(id, {
        status: "fail",
        detail: e instanceof Error ? e.message : String(e),
        ms: Math.round(performance.now() - t0),
      });
      return false;
    }
  };

  const runAll = async () => {
    setRunning(true);
    setChecks(INITIAL_CHECKS.map((c) => ({ ...c, status: "pending", detail: undefined, ms: undefined })));

    let createdId: string | null = null;

    await run("auth", async () => {
      if (!user) throw new Error("No authenticated user");
      if (!organization?.id) throw new Error("No organization on profile");
      return `org ${organization.id.slice(0, 8)}…`;
    });

    if (!organization?.id || !user) {
      setRunning(false);
      return;
    }

    await run("list", async () => {
      const { data, error, count } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: false })
        .eq("organization_id", organization.id)
        .is("deleted_at", null)
        .limit(1);
      if (error) throw error;
      return `${count ?? data?.length ?? 0} visible`;
    });

    await run("filter", async () => {
      const { error, count } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization.id)
        .eq("status", "new")
        .is("deleted_at", null);
      if (error) throw error;
      return `${count ?? 0} with status=new`;
    });

    const insertOk = await run("insert", async () => {
      const { data, error } = await supabase
        .from("leads")
        .insert({
          organization_id: organization.id,
          name: `Smoke Test ${new Date().toISOString().slice(11, 19)}`,
          email: `smoketest+${Date.now()}@example.com`,
          status: "new",
          source: "smoke-test",
          created_by: user.id,
          tags: [TEST_TAG],
        })
        .select("id")
        .single();
      if (error) throw error;
      createdId = data.id;
      return `id ${data.id.slice(0, 8)}…`;
    });

    if (insertOk && createdId) {
      await run("update", async () => {
        const { error } = await supabase
          .from("leads")
          .update({ status: "contacted" })
          .eq("id", createdId!);
        if (error) throw error;
        const { data, error: e2 } = await supabase
          .from("leads")
          .select("status")
          .eq("id", createdId!)
          .single();
        if (e2) throw e2;
        if (data.status !== "contacted") throw new Error(`status=${data.status}`);
        return "persisted";
      });

      await run("event", async () => {
        return await new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => {
            off();
            reject(new Error("event not received within 1s"));
          }, 1000);
          const off = onLeadsChanged(() => {
            clearTimeout(timeout);
            off();
            resolve("received");
          });
          notifyLeadsChanged();
        });
      });

      await run("soft-delete", async () => {
        const { error } = await supabase
          .from("leads")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", createdId!);
        if (error) throw error;
        return "deleted_at set";
      });
    } else {
      update("update", { status: "fail", detail: "skipped (insert failed)" });
      update("event", { status: "fail", detail: "skipped (insert failed)" });
      update("soft-delete", { status: "fail", detail: "skipped (insert failed)" });
    }

    await run("cleanup", async () => {
      const { error } = await supabase
        .from("leads")
        .delete()
        .eq("organization_id", organization.id)
        .contains("tags", [TEST_TAG]);
      if (error) throw error;
      return "ok";
    });

    setRunning(false);
    notifyLeadsChanged();

    const failed = checks.filter((c) => c.status === "fail").length;
    if (failed === 0) toast.success("Leads smoke test passed");
    else toast.error(`Leads smoke test: ${failed} check(s) failed`);
  };

  const passCount = checks.filter((c) => c.status === "pass").length;
  const failCount = checks.filter((c) => c.status === "fail").length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Stethoscope className="h-4 w-4" />
          Smoke test
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Leads smoke test</DialogTitle>
          <DialogDescription>
            Runs read, insert, update, soft-delete, event-bus and cleanup checks against the
            live database for your organization.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
          {checks.map((c) => (
            <div
              key={c.id}
              className="flex items-start gap-2 rounded-md border border-border bg-card/50 px-3 py-2 text-sm"
            >
              <div className="mt-0.5">
                {c.status === "pending" && (
                  <div className="h-4 w-4 rounded-full border border-muted-foreground/40" />
                )}
                {c.status === "running" && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
                {c.status === "pass" && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                )}
                {c.status === "fail" && <XCircle className="h-4 w-4 text-destructive" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground">{c.label}</div>
                {c.detail && (
                  <div
                    className={`text-xs mt-0.5 break-words ${
                      c.status === "fail" ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {c.detail}
                  </div>
                )}
              </div>
              {typeof c.ms === "number" && (
                <div className="text-xs text-muted-foreground tabular-nums">{c.ms}ms</div>
              )}
            </div>
          ))}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {running
              ? "Running…"
              : passCount + failCount === 0
                ? "Ready"
                : `${passCount} passed · ${failCount} failed`}
          </div>
          <Button onClick={runAll} disabled={running} size="sm">
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                Running
              </>
            ) : (
              "Run tests"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
