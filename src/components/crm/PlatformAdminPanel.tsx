import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Crown, Loader2, RefreshCw, ShieldCheck, Trash2, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ManualSub {
  id: string;
  user_id: string;
  email: string;
  plan: string;
  granted_at: string;
  expires_at: string | null;
}

// Hardcoded fallback list — must mirror FALLBACK_ADMINS in the edge function.
// Update both if you change platform admins.
const FALLBACK_ADMIN_EMAILS = ["solidsnake4ks@gmail.com"];

const PLAN_OPTIONS = [
  { value: "manual_enterprise", label: "Enterprise (manual)" },
  { value: "manual_pro", label: "Pro (manual)" },
  { value: "manual_growth", label: "Growth (manual)" },
  { value: "manual_starter", label: "Starter (manual)" },
];

export function PlatformAdminPanel() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("manual_enterprise");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [allowed, setAllowed] = useState<boolean>(false);
  const [checking, setChecking] = useState(true);
  const [subs, setSubs] = useState<ManualSub[] | null>(null);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [revokeEmail, setRevokeEmail] = useState("");
  const [revoking, setRevoking] = useState(false);

  const loadSubs = useCallback(async () => {
    setLoadingSubs(true);
    try {
      const { data, error } = await supabase.functions.invoke("list-manual-subscriptions");
      if (error) {
        toast.error(error.message ?? "Failed to load subscriptions");
        return;
      }
      setSubs((data?.subscriptions as ManualSub[]) ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoadingSubs(false);
    }
  }, []);

  useEffect(() => {
    // Client-side gate is purely cosmetic — the real check is in the edge function.
    const callerEmail = (user?.email ?? "").toLowerCase();
    const isAdmin = FALLBACK_ADMIN_EMAILS.includes(callerEmail);
    setAllowed(isAdmin);
    setChecking(false);
    if (isAdmin) void loadSubs();
  }, [user?.email, loadSubs]);

  if (checking) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!allowed) {
    // Hidden entirely from non-admins so they don't even see the section exists.
    return null;
  }

  async function handleGrant() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("grant-manual-subscription", {
        body: { email: trimmed, planLabel: plan, note: note.trim() || undefined },
      });
      if (error) {
        toast.error(error.message ?? "Failed to grant subscription");
        return;
      }
      if (data?.already_active) {
        toast.info(`${trimmed} already has an active manual subscription`);
      } else {
        toast.success(`Granted ${plan.replace("manual_", "")} to ${trimmed}`);
      }
      setEmail("");
      setNote("");
      void loadSubs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke() {
    const trimmed = revokeEmail.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    if (
      !window.confirm(
        `Revoke ALL active manual subscriptions for ${trimmed}? They'll lose access immediately.`,
      )
    ) {
      return;
    }

    setRevoking(true);
    try {
      const { data, error } = await supabase.functions.invoke("revoke-manual-subscription", {
        body: { email: trimmed },
      });
      if (error) {
        toast.error(error.message ?? "Failed to revoke subscription");
        return;
      }
      const count = (data?.revoked_count as number) ?? 0;
      if (count === 0) {
        toast.info(`No active manual subscriptions found for ${trimmed}`);
      } else {
        toast.success(`Revoked ${count} manual subscription${count === 1 ? "" : "s"} for ${trimmed}`);
      }
      setRevokeEmail("");
      void loadSubs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/40">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            <CardTitle>Platform Admin — Grant Manual Subscription</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Comp any user (by email) with a lifetime manual subscription. Bypasses
            Stripe. Use for internal team, partners, or offline-sold accounts.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <span>
              Visible only to platform admins. Server-side authorization is enforced
              independently — even if this UI leaked, the action would still be denied.
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="grant-email">User email</Label>
            <Input
              id="grant-email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="grant-plan">Plan</Label>
            <Select value={plan} onValueChange={setPlan} disabled={submitting}>
              <SelectTrigger id="grant-plan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAN_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="grant-note">Internal note (optional)</Label>
            <Input
              id="grant-note"
              placeholder="e.g. Beta partner, lifetime deal Q4"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={submitting}
            />
          </div>

          <Button onClick={handleGrant} disabled={submitting} className="w-full">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Granting...
              </>
            ) : (
              "Grant Manual Subscription"
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            <CardTitle>Revoke Manual Subscription</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Cancel all active manual subscriptions for an email. Stripe-paid
            subscriptions are not affected.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="revoke-email">User email</Label>
            <Input
              id="revoke-email"
              type="email"
              placeholder="user@example.com"
              value={revokeEmail}
              onChange={(e) => setRevokeEmail(e.target.value)}
              disabled={revoking}
            />
          </div>
          <Button
            onClick={handleRevoke}
            disabled={revoking}
            variant="destructive"
            className="w-full"
          >
            {revoking ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Revoking...
              </>
            ) : (
              "Revoke Manual Subscription"
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle>Active Manual Subscriptions</CardTitle>
            {subs && (
              <Badge variant="secondary" className="ml-1">
                {subs.length}
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadSubs()}
            disabled={loadingSubs}
          >
            {loadingSubs ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {loadingSubs && !subs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !subs || subs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No active manual subscriptions yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Granted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subs.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {s.plan.replace("manual_", "")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(s.granted_at), {
                          addSuffix: true,
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
