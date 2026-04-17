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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  UserPlus,
  Loader2,
  Copy,
  CheckCircle2,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface CreateClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface CreatedClient {
  email: string;
  password: string;
  loginUrl: string;
}

function generatePassword(length = 14) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

export function CreateClientDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateClientDialogProps) {
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(() => generatePassword());
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedClient | null>(null);

  const reset = () => {
    setCompanyName("");
    setFullName("");
    setEmail("");
    setPassword(generatePassword());
    setShowPassword(false);
    setCreated(null);
  };

  const handleClose = (next: boolean) => {
    if (submitting) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedCompany = companyName.trim();
    const trimmedName = fullName.trim();

    if (!trimmedCompany || trimmedCompany.length > 100) {
      toast.error("Company name is required");
      return;
    }
    if (!trimmedEmail.includes("@") || trimmedEmail.length > 255) {
      toast.error("Enter a valid email");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-client-account",
        {
          body: {
            email: trimmedEmail,
            password,
            companyName: trimmedCompany,
            fullName: trimmedName,
          },
        },
      );

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to create");

      setCreated({
        email: trimmedEmail,
        password,
        loginUrl: `${window.location.origin}/login`,
      });
      toast.success("Client account created");
      onCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create client";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const copyAll = () => {
    if (!created) return;
    const text = `Login URL: ${created.loginUrl}\nEmail: ${created.email}\nPassword: ${created.password}`;
    void navigator.clipboard.writeText(text);
    toast.success("Credentials copied to clipboard");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Client account ready
              </DialogTitle>
              <DialogDescription>
                Share these credentials with your client. Save them now — the
                password isn&apos;t stored anywhere we can show again.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4 font-mono text-xs">
              <div>
                <div className="text-[10px] uppercase text-muted-foreground mb-1">
                  Login URL
                </div>
                <div className="text-foreground break-all">{created.loginUrl}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground mb-1">
                  Email
                </div>
                <div className="text-foreground break-all">{created.email}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground mb-1">
                  Password
                </div>
                <div className="text-foreground break-all">{created.password}</div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Done
              </Button>
              <Button variant="command" onClick={copyAll} className="gap-2">
                <Copy className="h-4 w-4" />
                Copy all
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Create client account
              </DialogTitle>
              <DialogDescription>
                Creates a new client organization under your reseller account
                with the user as Owner. They can log in immediately.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="cc-company">Company name</Label>
                <Input
                  id="cc-company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Inc."
                  className="mt-1.5"
                  maxLength={100}
                  disabled={submitting}
                />
              </div>

              <div>
                <Label htmlFor="cc-name">Owner full name (optional)</Label>
                <Input
                  id="cc-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  className="mt-1.5"
                  maxLength={100}
                  disabled={submitting}
                />
              </div>

              <div>
                <Label htmlFor="cc-email">Email</Label>
                <Input
                  id="cc-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@acme.com"
                  className="mt-1.5"
                  maxLength={255}
                  disabled={submitting}
                />
              </div>

              <div>
                <Label htmlFor="cc-password">Temporary password</Label>
                <div className="flex gap-1.5 mt-1.5">
                  <Input
                    id="cc-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="font-mono"
                    minLength={8}
                    maxLength={72}
                    disabled={submitting}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={submitting}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => setPassword(generatePassword())}
                    disabled={submitting}
                    title="Generate new password"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Auto-generated and secure. Tell your client to change it after
                  first login.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                variant="command"
                onClick={handleSubmit}
                disabled={submitting}
                className="gap-2"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Create account
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
