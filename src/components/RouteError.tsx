import { AlertTriangle } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

interface Props {
  error: Error;
  reset: () => void;
  label?: string;
}

export function RouteError({ error, reset, label }: Props) {
  const router = useRouter();
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div
        role="alert"
        className="rounded-xl border border-destructive/30 bg-destructive/5 p-5"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              {label ?? "Couldn't load this page"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {error?.message || "Something went wrong."}
            </p>
            {import.meta.env.DEV && error?.stack && (
              <pre className="mt-3 max-h-40 overflow-auto rounded-md bg-muted p-2 text-left font-mono text-[11px] text-destructive whitespace-pre-wrap">
                {error.stack}
              </pre>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="command"
            size="sm"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Try again
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
          >
            Reload page
          </Button>
        </div>
      </div>
    </div>
  );
}
