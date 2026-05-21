import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Crown, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { memberRoleLabel } from "@/lib/team-members-helpers";
import type {
  CustomRoleLite,
  Member,
} from "./team-members.types";

interface MembersListProps {
  members: Member[];
  loading: boolean;
  customRoleMap: Map<string, CustomRoleLite>;
  assignableRoles: CustomRoleLite[];
  currentUserId: string | undefined;
  isOwner: boolean;
  onRoleChanged: () => void;
  onRequestRemove: (member: Member) => void;
}

export function MembersList({
  members,
  loading,
  customRoleMap,
  assignableRoles,
  currentUserId,
  isOwner,
  onRoleChanged,
  onRequestRemove,
}: MembersListProps) {
  const changeMemberRole = async (userId: string, customRoleId: string) => {
    const { data, error } = await supabase.rpc("assign_custom_role", {
      p_user_id: userId,
      p_custom_role_id: customRoleId,
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
    onRoleChanged();
  };

  return (
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
            const isMe = m.user_id === currentUserId;
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
                      {isMe && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {memberRoleLabel(m, customRoleMap)}
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
                        value={m.custom_role_id ?? ""}
                        onValueChange={(v) => changeMemberRole(m.user_id, v)}
                      >
                        <SelectTrigger className="h-8 w-[180px] text-xs">
                          <SelectValue placeholder="Pick role" />
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
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => onRequestRemove(m)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Badge variant="secondary">{memberRoleLabel(m, customRoleMap)}</Badge>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
