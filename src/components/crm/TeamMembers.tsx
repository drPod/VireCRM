import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { sendTransactionalEmail } from "@/lib/email/send";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  Copy,
  Mail,
  Loader2,
  Crown,
  CheckCircle2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type AppRole = "owner" | "manager" | "sales_rep";

interface Member {
  user_id: string;
  full_name: string | null;
  role: AppRole;
}

interface Invitation {
  id: string;
  email: string;
  role: AppRole;
  token: string;
  status: string;
  created_at: string;
  expires_at: string;
}

const roleLabels: Record<AppRole, string> = {
  owner: "Owner",
  manager: "Manager",
  sales_rep: "Sales Rep",
};

export function TeamMembers() {
  const { user, organization, role } = useAuth();
  const isOwner = role?.role === "owner";

  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("sales_rep");
  const [inviting, setInviting] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);

  const loadData = async () => {
    if (!organization) return;
    setLoading(true);
    try {
      // Members: join profiles + user_roles
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("organization_id", organization.id);

      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("organization_id", organization.id);

      const roleMap = new Map<string, AppRole>(
        (roleRows ?? []).map((r) => [r.user_id, r.role as AppRole]),
      );

      const memberList: Member[] = (profileRows ?? []).map((p) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        role: roleMap.get(p.user_id) ?? "sales_rep",
      }));

      setMembers(memberList);

      const { data: invRows } = await supabase
        .from("invitations")
        .select("id, email, role, token, status, created_at, expires_at")
        .eq("organization_id", organization.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      setInvitations((invRows ?? []) as Invitation[]);
    } catch (err) {
      console.error("Failed to load team", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organization) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!organization || !user) return;
    setInviting(true);
    try {
      const { data, error } = await supabase
        .from("invitations")
        .insert({
          organization_id: organization.id,
          email,
          role: inviteRole,
          invited_by: user.id,
        })
        .select("token")
        .single();

      if (error) throw error;

      const inviteUrl = `${window.location.origin}/accept-invite?token=${data.token}`;
      await navigator.clipboard.writeText(inviteUrl).catch(() => {});

      // Send the invitation email. Surface failures clearly so the owner
      // knows whether to share the link manually.
      const inviterName =
        (user.user_metadata?.full_name as string | undefined)?.trim() ||
        user.email ||
        "Your team owner";
      const orgName = organization.name || "your team";
      const brandName = organization.brand_name?.trim() || "GenesisX";
      const replyTo = organization.support_email?.trim() || undefined;
      const roleLabel = roleLabels[inviteRole];

      try {
        await sendTransactionalEmail({
          templateName: "team-invite",
          recipientEmail: email,
          idempotencyKey: `team-invite-${data.token}`,
          fromName: brandName,
          replyTo,
          templateData: {
            inviterName,
            organizationName: orgName,
            roleLabel,
            acceptUrl: inviteUrl,
            brandName,
          },
        });
        toast.success(`Invitation sent to ${email} — link also copied`);
      } catch (emailErr) {
        console.error("Failed to send invitation email", emailErr);
        toast.warning(
          `Invitation created and link copied — but email delivery failed. Share the link manually.`,
        );
      }

      setInviteEmail("");
      setInviteRole("sales_rep");
      setInviteOpen(false);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create invitation");
    } finally {
      setInviting(false);
    }
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/accept-invite?token=${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  };

  const cancelInvitation = async (id: string) => {
    const { error } = await supabase.from("invitations").delete().eq("id", id);
    if (error) {
      toast.error("Failed to cancel invitation");
      return;
    }
    toast.success("Invitation cancelled");
    loadData();
  };

  const changeRole = async (userId: string, newRole: AppRole) => {
    const { data, error } = await supabase.rpc("update_member_role", {
      p_user_id: userId,
      p_new_role: newRole,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as { success: boolean; error?: string };
    if (!result?.success) {
      toast.error(result?.error ?? "Failed to update role");
      return;
    }
    toast.success("Role updated");
    loadData();
  };

  const removeMember = async () => {
    if (!removeTarget) return;
    const { data, error } = await supabase.rpc("remove_org_member", {
      p_user_id: removeTarget.user_id,
    });
    if (error) {
      toast.error(error.message);
      setRemoveTarget(null);
      return;
    }
    const result = data as { success: boolean; error?: string };
    if (!result?.success) {
      toast.error(result?.error ?? "Failed to remove member");
      setRemoveTarget(null);
      return;
    }
    toast.success("Member removed");
    setRemoveTarget(null);
    loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Team Members
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage who has access to your organization
          </p>
        </div>
        {isOwner && (
          <Button variant="command" onClick={() => setInviteOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Invite Member
          </Button>
        )}
      </div>

      {!isOwner && (
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Only owners can invite, remove, or change roles. You can view the team list below.
          </p>
        </div>
      )}

      {/* Members list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border bg-secondary/30 px-5 py-3">
          <h3 className="text-sm font-semibold text-foreground">
            Active Members ({members.length})
          </h3>
        </div>
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No members yet</div>
        ) : (
          <ul className="divide-y divide-border">
            {members.map((m) => {
              const isMe = m.user_id === user?.id;
              const isMemberOwner = m.role === "owner";
              return (
                <li key={m.user_id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm shrink-0">
                      {(m.full_name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {m.full_name || "Unnamed"}
                        {isMe && (
                          <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {roleLabels[m.role]}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isMemberOwner ? (
                      <Badge variant="warning" className="gap-1">
                        <Crown className="h-3 w-3" />
                        Owner
                      </Badge>
                    ) : isOwner && !isMe ? (
                      <>
                        <Select
                          value={m.role}
                          onValueChange={(v) => changeRole(m.user_id, v as AppRole)}
                        >
                          <SelectTrigger className="h-8 w-[130px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="sales_rep">Sales Rep</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setRemoveTarget(m)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Badge variant="secondary">{roleLabels[m.role]}</Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border bg-secondary/30 px-5 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              Pending Invitations ({invitations.length})
            </h3>
          </div>
          <ul className="divide-y divide-border">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-muted-foreground shrink-0">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {roleLabels[inv.role]} · expires{" "}
                      {new Date(inv.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => copyInviteLink(inv.token)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy link
                  </Button>
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => cancelInvitation(inv.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a team member</DialogTitle>
            <DialogDescription>
              We&apos;ll generate an invite link you can share with them. They&apos;ll join your
              organization when they sign up.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Email address
              </label>
              <input
                type="email"
                placeholder="teammate@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Role</label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Manager — can manage leads, campaigns, tasks</SelectItem>
                  <SelectItem value="sales_rep">Sales Rep — can work assigned leads & tasks</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg bg-secondary/40 p-3 flex gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                The invite link expires in 7 days. The recipient must sign up with the email
                address you enter here.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviting}>
              Cancel
            </Button>
            <Button variant="command" onClick={handleInvite} disabled={inviting}>
              {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirmation */}
      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.full_name || "This user"} will lose access to your organization
              immediately. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={removeMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
