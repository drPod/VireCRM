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
import { Loader2 } from "lucide-react";

export interface ProviderDisconnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerName: string;
  removeConfirm: string;
  removing: boolean;
  onConfirm: () => void | Promise<void>;
}

/** Confirmation dialog before disconnecting a configured provider. */
export function ProviderDisconnectDialog({
  open,
  onOpenChange,
  providerName,
  removeConfirm,
  removing,
  onConfirm,
}: ProviderDisconnectDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect {providerName}?</AlertDialogTitle>
          <AlertDialogDescription>{removeConfirm}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={removing}>Keep connected</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={removing}>
            {removing ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Disconnecting…
              </>
            ) : (
              "Yes, disconnect"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
