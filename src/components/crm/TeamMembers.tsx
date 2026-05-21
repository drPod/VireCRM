import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Shield, UserPlus, Users } from "lucide-react";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { MembersList } from "./MembersList";
import { PendingInvitesList } from "./PendingInvitesList";
import { InviteMemberDialog } from "./InviteMemberDialog";
import { RemoveMemberDialog } from "./RemoveMemberDialog";
import type { Member } from "./team-members.types";

export function TeamMembers() {
  const { user, organization, role } = useAuth();
  const isOwner = role?.role === "owner";

  const {
    members,
    invitations,
    customRoleMap,
    assignableRoles,
    defaultRepRoleId,
    loading,
    reload,
  } = useTeamMembers(organization?.id);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);

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

      <MembersList
        members={members}
        loading={loading}
        customRoleMap={customRoleMap}
        assignableRoles={assignableRoles}
        currentUserId={user?.id}
        isOwner={isOwner}
        onRoleChanged={reload}
        onRequestRemove={setRemoveTarget}
      />

      <PendingInvitesList
        invitations={invitations}
        customRoleMap={customRoleMap}
        isOwner={isOwner}
        onChanged={reload}
      />

      {user && organization && (
        <InviteMemberDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          user={user}
          organization={organization}
          assignableRoles={assignableRoles}
          customRoleMap={customRoleMap}
          defaultRepRoleId={defaultRepRoleId}
          onInvited={reload}
        />
      )}

      <RemoveMemberDialog
        target={removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        onRemoved={reload}
      />
    </div>
  );
}
