import type { AdminSubmissionRow } from "@/types/admin";

/**
 * Renders which submission metadata fields the suggestion engine considered,
 * highlighting the one that drove the chosen plan (when there is a match).
 */
export function SuggestionSignals({
  submission,
  source,
}: {
  submission: AdminSubmissionRow;
  source: "interested_plan" | "budget" | "project_type" | null;
}) {
  const interestedPlan =
    (typeof submission.metadata?.["interested_plan"] === "string"
      ? (submission.metadata["interested_plan"] as string)
      : typeof submission.metadata?.["plan"] === "string"
        ? (submission.metadata["plan"] as string)
        : null) ?? null;

  const fields: Array<{
    key: "interested_plan" | "budget" | "project_type";
    label: string;
    value: string | null;
  }> = [
    { key: "interested_plan", label: "interested_plan", value: interestedPlan },
    { key: "budget", label: "budget", value: submission.budget ?? null },
    { key: "project_type", label: "project_type", value: submission.project_type ?? null },
  ];

  return (
    <div className="flex flex-wrap gap-1.5">
      {fields.map((f) => {
        const matched = source === f.key;
        const empty = !f.value;
        return (
          <span
            key={f.key}
            className={
              matched
                ? "inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/15 px-2 py-0.5 text-[11px] text-foreground"
                : empty
                  ? "inline-flex items-center gap-1 rounded border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground/70"
                  : "inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
            }
            title={
              matched
                ? "This field drove the suggestion"
                : empty
                  ? "Not provided"
                  : "Considered, no match"
            }
          >
            <code className="font-mono text-[10px]">{f.label}</code>
            <span className="text-foreground/80">{empty ? "—" : f.value}</span>
            {matched ? <span className="text-primary">✓ used</span> : null}
          </span>
        );
      })}
    </div>
  );
}
