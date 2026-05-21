import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import {
  listStepsFn,
  upsertStepFn,
  deleteStepFn,
  type OutreachSequenceStep,
} from "@/functions/outreach-sequences.functions";
import { CampaignStepEditor } from "./CampaignStepEditor";
import { toast } from "sonner";

interface Props {
  organizationId: string;
  sequenceId: string;
}

export function CampaignStepList({ organizationId, sequenceId }: Props) {
  const [steps, setSteps] = useState<OutreachSequenceStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    const rows = await listStepsFn({
      data: { organizationId, sequenceId },
    });
    setSteps(rows);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await listStepsFn({
          data: { organizationId, sequenceId },
        });
        if (!cancelled) setSteps(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId, sequenceId]);

  const addStep = async () => {
    setAdding(true);
    try {
      const nextIndex = steps.length;
      await upsertStepFn({
        data: {
          organizationId,
          sequenceId,
          step_index: nextIndex,
          delay_days: nextIndex === 0 ? 0 : 2,
          delay_hours: 0,
          subject_override: null,
          body_override: null,
        },
      });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add step");
    } finally {
      setAdding(false);
    }
  };

  const saveStep = async (step: OutreachSequenceStep, patch: Partial<OutreachSequenceStep>) => {
    try {
      await upsertStepFn({
        data: {
          organizationId,
          sequenceId,
          id: step.id,
          step_index: step.step_index,
          delay_days: patch.delay_days ?? step.delay_days,
          delay_hours: patch.delay_hours ?? step.delay_hours,
          subject_override: patch.subject_override ?? step.subject_override,
          body_override: patch.body_override ?? step.body_override,
        },
      });
      toast.success("Step saved");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save step");
    }
  };

  const removeStep = async (step: OutreachSequenceStep) => {
    if (!confirm(`Delete step ${step.step_index + 1}?`)) return;
    try {
      await deleteStepFn({
        data: { organizationId, id: step.id },
      });
      toast.success("Step deleted");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {steps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No steps yet. Add the first email to start.
          </p>
        </div>
      ) : (
        steps.map((step) => (
          <CampaignStepEditor
            key={step.id}
            step={step}
            isFirst={step.step_index === 0}
            onSave={(patch) => saveStep(step, patch)}
            onDelete={() => removeStep(step)}
          />
        ))
      )}
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={addStep}
        disabled={adding || steps.length >= 20}
      >
        {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Add step
      </Button>
    </div>
  );
}
