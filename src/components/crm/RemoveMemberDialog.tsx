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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Member } from "./team-members.types";

interface RemoveMemberDialogProps {
  target: Member | null;
  onOpenChange: (open: boolean) => void;
  onRemoved: () => void;
}

export function RemoveMemberDialog({
  target,
  onOpenChange,
  onRemoved,
}: RemoveMemberDialogProps) {
  const handleRemove = async () => {
    if (!target) return;
    const { data, error } = await supabase.rpc("remove_org_member", {
      p_user_id: target.user_id,
    });
    if (error) {
      toast.error(error.message);
      onOpenChange(false);
      return;
    }
    const result = data as { success: boolean; error?: string };
    if (!result?.success) {
      toast.error(result?.error ?? "Failed to remove member");
      onOpenChange(false);
      return;
    }
    toast.success("Member removed");
    onOpenChange(false);
    onRemoved();
  };

  return (
    <AlertDialog open={!!target} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove team member?</AlertDialogTitle>
          <AlertDialogDescription>
            {target?.full_name || "This user"} will lose access to your organization
            immediately. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRemove}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
