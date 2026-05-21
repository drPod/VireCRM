import { Button } from "@/components/ui/button";
import { Copy, Mail, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { buildInviteUrl, invitationRoleLabel } from "@/lib/team-members-helpers";
import type { CustomRoleLite, Invitation } from "./team-members.types";

interface PendingInvitesListProps {
  invitations: Invitation[];
  customRoleMap: Map<string, CustomRoleLite>;
  isOwner: boolean;
  onChanged: () => void;
}

export function PendingInvitesList({
  invitations,
  customRoleMap,
  isOwner,
  onChanged,
}: PendingInvitesListProps) {
  if (invitations.length === 0) return null;

  const copyInviteLink = (token: string) => {
    navigator.clipboard.writeText(buildInviteUrl(token));
    toast.success("Invite link copied");
  };

  const cancelInvitation = async (id: string) => {
    const { error } = await supabase.from("invitations").delete().eq("id", id);
    if (error) {
      toast.error("Failed to cancel invitation");
      return;
    }
    toast.success("Invitation cancelled");
    onChanged();
  };

  return (
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
                  {invitationRoleLabel(inv, customRoleMap)} · expires{" "}
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
  );
}
