import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Loader2, Copy, Check, Dices, KeyRound } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientOrgId: string | null;
  clientName: string | null;
}

function generatePassword() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const arr = new Uint32Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

export function ResetClientPasswordDialog({
  open,
  onOpenChange,
  clientOrgId,
  clientName,
}: Props) {
  const [password, setPassword] = useState(() => generatePassword());
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{
    email: string;
    password: string;
    loginUrl: string;
  } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const reset = () => {
    setPassword(generatePassword());
    setDone(null);
    setCopied(null);
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      onOpenChange(false);
      setTimeout(reset, 200);
    } else {
      onOpenChange(true);
    }
  };

  const copy = (label: string, value: string) => {
    void navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleSubmit = async () => {
    if (!clientOrgId) return;
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "reset-client-password",
        { body: { clientOrgId, newPassword: password } },
      );
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Reset failed");
      setDone({
        email: data.email,
        password,
        loginUrl: data.login_url,
      });
      toast.success("Password reset");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Reset client password
          </DialogTitle>
          <DialogDescription>
            {clientName ? (
              <>
                Generate a new password for{" "}
                <span className="font-medium text-foreground">{clientName}</span>
                . The old password will stop working immediately.
              </>
            ) : (
              "Generate a new password for this client."
            )}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
              <CopyRow
                label="Login URL"
                value={done.loginUrl}
                copied={copied === "url"}
                onCopy={() => copy("url", done.loginUrl)}
              />
              <CopyRow
                label="Email"
                value={done.email}
                copied={copied === "email"}
                onCopy={() => copy("email", done.email)}
              />
              <CopyRow
                label="New password"
                value={done.password}
                copied={copied === "pw"}
                onCopy={() => copy("pw", done.password)}
                mono
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Save or send this password now — it will not be shown again after
              you close this dialog.
            </p>
            <DialogFooter>
              <Button onClick={() => handleClose(false)} variant="command">
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <div className="flex gap-2">
                <input
                  id="new-password"
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 flex-1 rounded-lg border border-input bg-input px-3 text-sm font-mono text-foreground outline-none focus:ring-2 focus:ring-primary/40"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setPassword(generatePassword())}
                  title="Generate new password"
                >
                  <Dices className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                8–72 characters. The client's existing session will be revoked
                next time they sign in.
              </p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="command"
                onClick={handleSubmit}
                disabled={loading}
                className="gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Reset password
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CopyRow({
  label,
  value,
  copied,
  onCopy,
  mono,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1">
        {label}
      </div>
      <div className="flex gap-2">
        <input
          readOnly
          value={value}
          className={`h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none ${mono ? "font-mono" : ""}`}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onCopy}
          className="shrink-0"
        >
          {copied ? (
            <Check className="h-4 w-4 text-emerald-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
