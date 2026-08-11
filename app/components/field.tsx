import type { ReactNode } from "react";

// Definition-list layout for detail pages.
export function FieldList({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </dl>
  );
}

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">{children}</dd>
    </div>
  );
}
