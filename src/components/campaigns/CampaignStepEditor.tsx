import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2, Save, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { OutreachSequenceStep } from "@/functions/outreach-sequences.functions";

const TOKENS = ["first_name", "last_name", "name", "email", "company", "business_name", "role"];

interface Props {
  step: OutreachSequenceStep;
  isFirst: boolean;
  onSave: (patch: Partial<OutreachSequenceStep>) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function CampaignStepEditor({ step, isFirst, onSave, onDelete }: Props) {
  const [subject, setSubject] = useState(step.subject_override ?? "");
  const [body, setBody] = useState(step.body_override ?? "");
  const [delayDays, setDelayDays] = useState(step.delay_days);
  const [delayHours, setDelayHours] = useState(step.delay_hours);
  const [saving, setSaving] = useState(false);

  const dirty =
    subject !== (step.subject_override ?? "") ||
    body !== (step.body_override ?? "") ||
    delayDays !== step.delay_days ||
    delayHours !== step.delay_hours;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        subject_override: subject || null,
        body_override: body || null,
        delay_days: delayDays,
        delay_hours: delayHours,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            Step {step.step_index + 1}
          </span>
          <span className="text-xs text-muted-foreground">
            {isFirst
              ? `Sends ${delayDays === 0 && delayHours === 0 ? "immediately on enroll" : `${delayDays}d ${delayHours}h after enroll`}`
              : `${delayDays}d ${delayHours}h after previous step`}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onDelete}
          aria-label="Delete step"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`days-${step.id}`} className="text-xs">
            Delay (days)
          </Label>
          <Input
            id={`days-${step.id}`}
            type="number"
            min={0}
            max={365}
            value={delayDays}
            onChange={(e) => setDelayDays(Math.max(0, Math.min(365, +e.target.value || 0)))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`hours-${step.id}`} className="text-xs">
            Delay (hours)
          </Label>
          <Input
            id={`hours-${step.id}`}
            type="number"
            min={0}
            max={23}
            value={delayHours}
            onChange={(e) => setDelayHours(Math.max(0, Math.min(23, +e.target.value || 0)))}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`subject-${step.id}`} className="text-xs">
          Subject
        </Label>
        <Input
          id={`subject-${step.id}`}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Quick question, {{first_name}}"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor={`body-${step.id}`} className="text-xs">
            Body (plaintext)
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="text-xs text-primary hover:underline">
                Insert variable
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">Available tokens</p>
                {TOKENS.map((t) => (
                  <code
                    key={t}
                    className="block cursor-pointer rounded px-2 py-1 text-xs hover:bg-muted"
                    onClick={() => setBody((b) => b + `{{${t}}}`)}
                  >
                    {"{{"}
                    {t}
                    {"}}"}
                  </code>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <Textarea
          id={`body-${step.id}`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Hey {{first_name}}, I saw {{company}} is hiring…"
          rows={8}
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          variant="command"
          onClick={handleSave}
          disabled={!dirty || saving}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Save step
        </Button>
      </div>
    </div>
  );
}
