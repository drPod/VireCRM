import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sendTransactionalEmail } from "@/lib/email/send";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Mail,
  AlertTriangle,
  Infinity as InfinityIcon,
} from "lucide-react";
import { toast } from "sonner";

interface CreateClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

type EmailStatus = "sending" | "sent" | "failed";

interface CreatedClient {
  email: string;
  password: string;
  loginUrl: string;
  fullName: string;
  brandName: string;
  emailStatus: EmailStatus;
  emailError?: string;
  resending?: boolean;
  resentWelcome?: boolean;
}

interface PlanOption {
  id: string;
  name: string;
  monthly_price_cents: number;
  base_cost_cents: number;
  currency: string;
}

const NO_PLAN = "__none__";

function formatCents(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
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
  const { organization } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(() => generatePassword());
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedClient | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [planId, setPlanId] = useState<string>(NO_PLAN);

  useEffect(() => {
    if (!open || !organization?.id) return;
    void (async () => {
      const { data, error } = await supabase
        .from("reseller_plans")
        .select("id, name, monthly_price_cents, base_cost_cents, currency")
        .eq("reseller_id", organization.id)
        .eq("is_active", true)
        .order("monthly_price_cents", { ascending: true });
      if (!error && data) setPlans(data as PlanOption[]);
    })();
  }, [open, organization?.id]);

  const reset = () => {
    setCompanyName("");
    setFullName("");
    setEmail("");
    setPassword(generatePassword());
    setShowPassword(false);
    setPlanId(NO_PLAN);
    setCreated(null);
  };

  const handleClose = (next: boolean) => {
    if (submitting) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const selectedPlan = plans.find((p) => p.id === planId) || null;

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
            resellerPlanId: planId !== NO_PLAN ? planId : null,
          },
        },
      );

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to create");

      const loginUrl = `${window.location.origin}/login`;
      setCreated({
        email: trimmedEmail,
        password,
        loginUrl,
        fullName: trimmedName,
        brandName: trimmedCompany,
        emailStatus: "sending",
      });
      toast.success("Client account created");

      // Auto-email credentials to the client. Failures must not block the
      // create flow — the reseller still has the credentials in the dialog.
      try {
        await sendTransactionalEmail({
          templateName: "client-credentials",
          recipientEmail: trimmedEmail,
          idempotencyKey: `client-credentials-${data.user_id}`,
          templateData: {
            brandName: trimmedCompany,
            fullName: trimmedName,
            email: trimmedEmail,
            password,
            loginUrl,
          },
        });
        setCreated((prev) =>
          prev ? { ...prev, emailStatus: "sent" } : prev,
        );
        toast.success("Login details emailed to the client");
      } catch (mailErr) {
        const errMsg =
          mailErr instanceof Error ? mailErr.message : "Unknown error";
        console.error("Failed to email credentials", mailErr);
        setCreated((prev) =>
          prev
            ? { ...prev, emailStatus: "failed", emailError: errMsg }
            : prev,
        );
        toast.warning(
          "Account created, but emailing the credentials failed. Copy them manually below.",
        );
      }
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

  const resendWelcome = async () => {
    if (!created || created.resending) return;
    setCreated((prev) => (prev ? { ...prev, resending: true } : prev));
    try {
      await sendTransactionalEmail({
        templateName: "client-welcome",
        recipientEmail: created.email,
        idempotencyKey: `client-welcome-${created.email}-${Date.now()}`,
        templateData: {
          brandName: created.brandName,
          fullName: created.fullName,
          loginUrl: created.loginUrl,
        },
      });
      setCreated((prev) =>
        prev ? { ...prev, resending: false, resentWelcome: true } : prev,
      );
      toast.success("Welcome guide sent (no password included)");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("Failed to resend welcome", err);
      setCreated((prev) => (prev ? { ...prev, resending: false } : prev));
      toast.error(`Could not send welcome email: ${msg}`);
    }
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

            <EmailStatusBanner
              status={created.emailStatus}
              recipient={created.email}
              error={created.emailError}
              onResendWelcome={resendWelcome}
              resending={created.resending}
              resentWelcome={created.resentWelcome}
            />

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

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
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
                <Label htmlFor="cc-plan">Plan (optional)</Label>
                <Select
                  value={planId}
                  onValueChange={setPlanId}
                  disabled={submitting}
                >
                  <SelectTrigger id="cc-plan" className="mt-1.5">
                    <SelectValue placeholder="No plan — assign later" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PLAN}>
                      No plan — assign later
                    </SelectItem>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} —{" "}
                        {formatCents(p.monthly_price_cents, p.currency)}/mo
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPlan && (
                  <div className="mt-2 rounded-lg bg-primary/5 border border-primary/20 p-2.5 text-[11px] space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Client pays</span>
                      <span className="font-medium text-foreground">
                        {formatCents(
                          selectedPlan.monthly_price_cents,
                          selectedPlan.currency,
                        )}
                        /mo
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Base cost</span>
                      <span className="text-muted-foreground">
                        {formatCents(
                          selectedPlan.base_cost_cents,
                          selectedPlan.currency,
                        )}
                        /mo
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-primary/20">
                      <span className="text-primary font-medium">You earn</span>
                      <span className="font-bold text-primary">
                        {formatCents(
                          selectedPlan.monthly_price_cents -
                            selectedPlan.base_cost_cents,
                          selectedPlan.currency,
                        )}
                        /mo
                      </span>
                    </div>
                  </div>
                )}
                {plans.length === 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    No active plans. Define one in Clients → Plans first.
                  </p>
                )}
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

function EmailStatusBanner({
  status,
  recipient,
  error,
  onResendWelcome,
  resending,
  resentWelcome,
}: {
  status: EmailStatus;
  recipient: string;
  error?: string;
  onResendWelcome?: () => void;
  resending?: boolean;
  resentWelcome?: boolean;
}) {
  if (status === "sending") {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3 text-xs">
        <Loader2 className="h-4 w-4 mt-0.5 shrink-0 animate-spin text-muted-foreground" />
        <div>
          <div className="font-medium text-foreground">Sending credentials…</div>
          <div className="text-muted-foreground mt-0.5 break-all">
            Queuing email to {recipient}
          </div>
        </div>
      </div>
    );
  }
  if (status === "sent") {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs">
        <Mail className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
        <div>
          <div className="font-medium text-primary">Credentials emailed</div>
          <div className="text-muted-foreground mt-0.5 break-all">
            Sent to {recipient}. Delivery may take up to a minute.
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-destructive">Email failed to send</div>
        <div className="text-muted-foreground mt-0.5 break-words">
          {error || "Unknown error"}. Copy the credentials below and share them
          manually.
        </div>
        {onResendWelcome && (
          <div className="mt-2 flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={onResendWelcome}
              disabled={resending || resentWelcome}
            >
              {resending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Mail className="h-3 w-3" />
              )}
              {resentWelcome ? "Welcome guide sent" : "Resend welcome guide"}
            </Button>
            <span className="text-[10px] text-muted-foreground">
              No password — login link only
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
