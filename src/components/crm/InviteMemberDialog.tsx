import { useEffect, useState } from "react";
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
import { CheckCircle2, Loader2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { sendTransactionalEmail } from "@/lib/email/send";
import { buildInviteUrl } from "@/lib/team-members-helpers";
import { toast } from "sonner";
import type { CustomRoleLite } from "./team-members.types";

interface InviteOrganization {
  id: string;
  name: string;
  brand_name: string | null;
  support_email: string | null;
}

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  organization: InviteOrganization;
  assignableRoles: CustomRoleLite[];
  customRoleMap: Map<string, CustomRoleLite>;
  defaultRepRoleId: string | null;
  onInvited: () => void;
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  user,
  organization,
  assignableRoles,
  customRoleMap,
  defaultRepRoleId,
  onInvited,
}: InviteMemberDialogProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCustomRoleId, setInviteCustomRoleId] = useState<string>("");
  const [inviting, setInviting] = useState(false);

  // Seed picker with the built-in Sales Rep role once available.
  useEffect(() => {
    if (defaultRepRoleId && !inviteCustomRoleId) {
      setInviteCustomRoleId(defaultRepRoleId);
    }
  }, [defaultRepRoleId, inviteCustomRoleId]);

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    const chosen = customRoleMap.get(inviteCustomRoleId);
    if (!chosen) {
      toast.error("Pick a role for this invitation");
      return;
    }

    setInviting(true);
    try {
      const { data, error } = await supabase
        .from("invitations")
        .insert({
          organization_id: organization.id,
          email,
          role: chosen.base_role,
          custom_role_id: chosen.id,
          invited_by: user.id,
        })
        .select("token")
        .single();

      if (error) throw error;

      const inviteUrl = buildInviteUrl(data.token);
      await navigator.clipboard.writeText(inviteUrl).catch(() => {});

      const inviterName =
        (user.user_metadata?.full_name as string | undefined)?.trim() ||
        user.email ||
        "Your team owner";
      const orgName = organization.name || "your team";
      const brandName = organization.brand_name?.trim() || "VireCRM";
      const replyTo = organization.support_email?.trim() || undefined;

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
            roleLabel: chosen.name,
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
      onOpenChange(false);
      onInvited();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create invitation");
    } finally {
      setInviting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <Select value={inviteCustomRoleId} onValueChange={setInviteCustomRoleId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a role" />
              </SelectTrigger>
              <SelectContent>
                {assignableRoles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: r.color ?? "#6366f1" }}
                      />
                      {r.name}
                      {!r.is_builtin && (
                        <span className="text-[10px] text-muted-foreground">(custom)</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Manage roles in the Roles tab.
            </p>
          </div>
          <div className="rounded-lg bg-secondary/40 p-3 flex gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              The invite link expires in 7 days. The recipient must sign up with the email address
              you enter here.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={inviting}>
            Cancel
          </Button>
          <Button variant="command" onClick={handleInvite} disabled={inviting}>
            {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
