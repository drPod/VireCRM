/**
 * Resend integration card — owner-only.
 *
 * Resend is platform-managed (single workspace-level `RESEND_API_KEY`), so
 * there's no per-org API key to paste. The card focuses on the only
 * org-specific settings that matter:
 *   - The verified `from` address (must be on a domain the org has verified
 *     in their Resend dashboard, e.g. `noreply@notify.virecrm.com`).
 *   - An optional `reply_to` address.
 *
 * We only show whether `RESEND_API_KEY` is present in the runtime — if it
 * isn't, we tell the owner to connect Resend first.
 */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useServerFn } from "@tanstack/react-start";
import { useActionLock } from "@/hooks/useActionLock";
import { useConfirm } from "@/hooks/useConfirm";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mail,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  disconnectResendFn,
  getResendStatusFn,
  saveResendSettingsFn,
  sendResendTestEmailFn,
  testResendConnectionFn,
} from "@/functions/resend.functions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ResendStatus {
  connectorAvailable: boolean;
  configured: boolean;
  fromAddress: string;
  replyTo: string;
  lastVerifiedAt: string | null;
}

function formatRelative(iso: string | null): string | null {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 60_000) return "just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ResendSettingsCard() {
  const { organization, role } = useAuth();
  const isOwner = role?.role === "owner";

  const getStatus = useServerFn(getResendStatusFn);
  const saveSettings = useServerFn(saveResendSettingsFn);
  const testConnection = useServerFn(testResendConnectionFn);
  const disconnect = useServerFn(disconnectResendFn);
  const sendTest = useServerFn(sendResendTestEmailFn);

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ResendStatus | null>(null);

  const [fromDraft, setFromDraft] = useState("");
  const [replyDraft, setReplyDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const testLock = useActionLock();
  const [testResult, setTestResult] = useState<
    { ok: true; verifiedAt: string } | { ok: false; reason: string } | null
  >(null);

  const [testRecipient, setTestRecipient] = useState("");
  const sendLock = useActionLock();
  const [removeLock, setRemoveLock] = useState(false);
  const { confirm } = useConfirm();

  const refresh = useCallback(async () => {
    if (!organization?.id || !isOwner) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const s = await getStatus({ data: { organizationId: organization.id } });
      setStatus(s);
      setFromDraft(s.fromAddress);
      setReplyDraft(s.replyTo);
      if (s.lastVerifiedAt) {
        setTestResult({ ok: true, verifiedAt: s.lastVerifiedAt });
      }
    } catch (err) {
      console.error(err);
      toast.error("Couldn't load Resend status", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, [organization?.id, isOwner, getStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!isOwner) return null;

  const fromValid = !fromDraft || EMAIL_RE.test(fromDraft.trim());
  const replyValid = !replyDraft || EMAIL_RE.test(replyDraft.trim());
  const dirty =
    fromDraft.trim() !== (status?.fromAddress ?? "") ||
    replyDraft.trim() !== (status?.replyTo ?? "");
  const canSave = fromValid && replyValid && dirty && !!fromDraft.trim();

  const testRecipientValid = EMAIL_RE.test(testRecipient.trim());
  const canSendTest =
    !!status?.connectorAvailable && !!status.fromAddress && testRecipientValid && !sendLock.loading;

  const handleSave = async () => {
    if (!organization?.id || !canSave) return;
    setSaving(true);
    try {
      await saveSettings({
        data: {
          organizationId: organization.id,
          fromAddress: fromDraft.trim(),
          replyTo: replyDraft.trim(),
        },
      });
      toast.success("Resend settings saved");
      await refresh();
    } catch (err) {
      toast.error("Couldn't save Resend settings", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = () =>
    testLock.run(async () => {
      if (!organization?.id) return;
      const ranAt = new Date().toISOString();
      try {
        const res = await testConnection({ data: { organizationId: organization.id } });
        if (res.ok) {
          setTestResult({ ok: true, verifiedAt: res.verifiedAt });
          toast.success("Resend connection verified");
        } else {
          setTestResult({ ok: false, reason: res.reason });
          toast.error("Resend test failed", { description: res.reason });
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : "Unknown error";
        setTestResult({ ok: false, reason });
        toast.error("Resend test failed", { description: reason });
      }
      void ranAt;
    });

  const handleSendTest = () =>
    sendLock.run(async () => {
      if (!organization?.id || !canSendTest) return;
      try {
        const res = await sendTest({
          data: { organizationId: organization.id, to: testRecipient.trim() },
        });
        if (res.ok) {
          toast.success("Test email sent via Resend", {
            description: `Delivered to ${testRecipient.trim()}. Check the inbox in a moment.`,
          });
          setTestRecipient("");
        } else {
          toast.error("Resend test send failed", { description: res.reason });
        }
      } catch (err) {
        toast.error("Resend test send failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    });

  const handleDisconnect = async () => {
    if (!organization?.id) return;
    const ok = await confirm({
      title: "Disconnect Resend?",
      description: "Outreach emails will fall back to your other connected email channels.",
      confirmLabel: "Disconnect",
      destructive: true,
    });
    if (!ok) return;
    setRemoveLock(true);
    try {
      await disconnect({ data: { organizationId: organization.id } });
      toast.success("Resend disconnected from this organization");
      await refresh();
    } catch (err) {
      toast.error("Couldn't disconnect Resend", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setRemoveLock(false);
    }
  };

  const verifiedLabel = formatRelative(
    testResult?.ok ? testResult.verifiedAt : (status?.lastVerifiedAt ?? null),
  );

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Mail className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold text-foreground">Resend</h3>
            {status?.configured && status?.fromAddress ? (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-success" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline">Not connected</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Send outreach emails through Resend. The connection is managed at the workspace level —
            here you set the verified <strong>from</strong> address and an optional reply-to. Resend
            takes priority over SendGrid when both are configured.
          </p>
        </div>
        <a
          href="https://resend.com/domains"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
        >
          Verify a domain <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !status?.connectorAvailable ? (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
          <div className="text-sm text-foreground">
            <p className="font-medium">Resend isn't linked to this workspace yet.</p>
            <p className="mt-1 text-muted-foreground">
              Ask your workspace admin to connect Resend from the integrations panel. Once
              connected, you'll be able to set a from address here and start sending.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Send-from address</Label>
              <Input
                type="email"
                value={fromDraft}
                onChange={(e) => setFromDraft(e.target.value)}
                placeholder="noreply@notify.virecrm.com"
                className="font-mono text-sm"
                spellCheck={false}
                autoComplete="off"
              />
              {!fromValid && (
                <p className="text-xs text-destructive">Enter a valid email address.</p>
              )}
              <p className="text-xs text-muted-foreground">
                Must be on a domain you've verified in Resend, otherwise sends will fail.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reply-to (optional)</Label>
              <Input
                type="email"
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                placeholder="support@virecrm.com"
                className="font-mono text-sm"
                spellCheck={false}
                autoComplete="off"
              />
              {!replyValid && (
                <p className="text-xs text-destructive">Enter a valid email address.</p>
              )}
              <p className="text-xs text-muted-foreground">
                Where replies land. Defaults to the send-from address if left blank.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="command" size="sm" onClick={handleSave} disabled={saving || !canSave}>
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save settings"
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testLock.loading}>
              {testLock.loading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Verifying…
                </>
              ) : (
                "Test connection"
              )}
            </Button>
            {status?.configured && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                disabled={removeLock}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Disconnect
              </Button>
            )}
          </div>

          {testResult && (
            <div
              className={`rounded-lg border px-3 py-2 text-xs ${
                testResult.ok
                  ? "border-success/30 bg-success/5 text-foreground"
                  : "border-destructive/30 bg-destructive/5 text-foreground"
              }`}
            >
              {testResult.ok ? (
                <span>
                  <CheckCircle2 className="inline h-3 w-3 text-success mr-1" />
                  Connection verified{verifiedLabel ? ` ${verifiedLabel}` : ""}.
                </span>
              ) : (
                <span>
                  <AlertTriangle className="inline h-3 w-3 text-destructive mr-1" />
                  {testResult.reason}
                </span>
              )}
            </div>
          )}

          {status?.fromAddress && (
            <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Send className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-medium text-foreground">Send a test email</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Input
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="you@example.com"
                  className="h-9 flex-1 min-w-[200px] font-mono text-sm"
                  spellCheck={false}
                  autoComplete="off"
                />
                <Button
                  size="sm"
                  variant="command"
                  onClick={handleSendTest}
                  disabled={!canSendTest}
                >
                  {sendLock.loading ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Send test"
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Sends a real email through Resend from{" "}
                <code className="font-mono">{status.fromAddress}</code>. Logged to your email send
                history.
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
