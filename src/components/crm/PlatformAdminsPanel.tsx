import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface AdminRow {
  user_id: string;
  email: string | null;
  granted_at: string;
  granted_by_email: string | null;
  notes: string | null;
}

export function PlatformAdminsPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AdminRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteNotes, setInviteNotes] = useState("");
  const [inviting, setInviting] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_platform_admins");
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data as AdminRow[]) ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    // Typed confirmation — admin access is full Super Admin (financials, all
    // submissions, invoices, plan assignment). A mis-typed email or accidental
    // submit must NOT silently grant access.
    const typed = window.prompt(
      `Grant FULL Super Admin access to:\n\n  ${email}\n\nThis gives them complete control: financials, every customer's data, ` +
        `invoice creation, plan assignment, and the ability to add/remove other admins.\n\n` +
        `Type the email address again to confirm:`,
    );
    if (typed === null) return;
    if (typed.trim().toLowerCase() !== email.toLowerCase()) {
      toast.error("Email did not match — admin access NOT granted.");
      return;
    }
    setInviting(true);
    const { data, error } = await supabase.rpc("grant_platform_admin_by_email", {
      p_email: email,
      p_notes: inviteNotes.trim() || undefined,
    });
    setInviting(false);
    const result = data as { success?: boolean; error?: string } | null;
    if (error || result?.success === false) {
      toast.error(result?.error ?? error?.message ?? "Failed to grant admin access");
      return;
    }
    toast.success(`${email} is now a platform admin`);
    setInviteEmail("");
    setInviteNotes("");
    void load();
  };

  const handleRevoke = async (row: AdminRow) => {
    if (!window.confirm(`Revoke platform admin from ${row.email ?? row.user_id}?`)) return;
    setRevoking(row.user_id);
    const { data, error } = await supabase.rpc("revoke_platform_admin", { p_user_id: row.user_id });
    setRevoking(null);
    const result = data as { success?: boolean; error?: string } | null;
    if (error || result?.success === false) {
      toast.error(result?.error ?? error?.message ?? "Failed to revoke admin");
      return;
    }
    toast.success("Platform admin revoked");
    void load();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Platform Admins
          </CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Anyone listed here has full Super Admin access to this console — financials, contact submissions,
          invoices, plan assignment, everything. Invite carefully. The invitee must already have an account
          (they can sign up at the normal login page first).
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleInvite} className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase text-muted-foreground">Email</label>
            <Input
              type="email"
              placeholder="partner@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase text-muted-foreground">
              Notes (optional)
            </label>
            <Input
              placeholder="e.g. Co-founder, ops partner"
              value={inviteNotes}
              onChange={(e) => setInviteNotes(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={inviting || !inviteEmail.trim()} className="gap-2">
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Grant admin
            </Button>
          </div>
        </form>

        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Granted</TableHead>
                <TableHead>Granted by</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    No platform admins yet.
                  </TableCell>
                </TableRow>
              )}
              {rows?.map((row) => {
                const isSelf = row.user_id === user?.id;
                return (
                  <TableRow key={row.user_id}>
                    <TableCell className="font-medium">
                      {row.email ?? <span className="text-muted-foreground">unknown</span>}
                      {isSelf && (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          You
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(row.granted_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.granted_by_email ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.notes ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(row)}
                        disabled={isSelf || revoking === row.user_id}
                        className="gap-1 text-destructive hover:text-destructive"
                      >
                        {revoking === row.user_id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
