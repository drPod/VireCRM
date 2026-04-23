import { Link } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";

interface TermsCheckboxProps {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}

/**
 * Required Terms & Conditions + No-Refund acknowledgement.
 * Used on signup and checkout flows. Opens /terms in a new tab.
 */
export function TermsCheckbox({
  id = "accept-terms",
  checked,
  onCheckedChange,
  className,
}: TermsCheckboxProps) {
  return (
    <div
      className={
        "flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3 " +
        (className ?? "")
      }
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className="mt-0.5"
        aria-required="true"
      />
      <label
        htmlFor={id}
        className="text-xs leading-relaxed text-muted-foreground cursor-pointer select-none"
      >
        I agree to the{" "}
        <Link
          to="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary hover:underline"
        >
          GenesisX Terms &amp; Conditions
        </Link>{" "}
        and acknowledge the{" "}
        <Link
          to="/refund-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary hover:underline"
        >
          No-Refund Policy
        </Link>
        . I understand the Service is provided &ldquo;as-is&rdquo; and that all
        payments are final and non-refundable.
      </label>
    </div>
  );
}
