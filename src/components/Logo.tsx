import { Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

// TODO(): retrofit auth pages (login.tsx, signup.tsx, reset-password.tsx, etc.)
// to <Logo size="lg" />. Out of scope here — current visuals match, so retrofit
// is a no-op deferred to its own pass.

type LogoSize = "sm" | "md" | "lg";

interface LogoProps {
  size?: LogoSize;
  className?: string;
}

const sizeMap: Record<LogoSize, { box: string; icon: string; halo: string }> = {
  sm: {
    box: "h-7 w-7 rounded-md",
    icon: "h-3.5 w-3.5",
    halo: "shadow-[0_0_10px_-2px_var(--color-primary)]",
  },
  md: {
    box: "h-8 w-8 rounded-lg",
    icon: "h-4 w-4",
    halo: "shadow-[0_0_14px_-2px_var(--color-primary)]",
  },
  lg: {
    box: "h-12 w-12 rounded-xl",
    icon: "h-6 w-6",
    halo: "shadow-[0_0_24px_-6px_var(--color-primary)]",
  },
};

export function Logo({ size = "md", className }: LogoProps) {
  const { box, icon, halo } = sizeMap[size];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex items-center justify-center bg-primary text-primary-foreground",
        box,
        halo,
        className,
      )}
    >
      <Terminal className={icon} />
    </span>
  );
}

export default Logo;
