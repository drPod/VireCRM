import { useEffect, useMemo, useState } from "react";
import { zxcvbn, zxcvbnOptions } from "@zxcvbn-ts/core";
import * as zxcvbnCommon from "@zxcvbn-ts/language-common";
import * as zxcvbnEn from "@zxcvbn-ts/language-en";

let optionsConfigured = false;
function ensureOptions() {
  if (optionsConfigured) return;
  zxcvbnOptions.setOptions({
    translations: zxcvbnEn.translations,
    graphs: zxcvbnCommon.adjacencyGraphs,
    dictionary: {
      ...zxcvbnCommon.dictionary,
      ...zxcvbnEn.dictionary,
    },
  });
  optionsConfigured = true;
}

const LABELS = ["Very weak", "Weak", "Fair", "Strong", "Very strong"] as const;
const COLORS = [
  "bg-destructive",
  "bg-destructive",
  "bg-amber-500",
  "bg-primary",
  "bg-emerald-500",
] as const;

export interface PasswordStrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  feedback: string;
}

interface PasswordStrengthMeterProps {
  password: string;
  userInputs?: string[];
  onChange?: (result: PasswordStrengthResult) => void;
}

export function PasswordStrengthMeter({
  password,
  userInputs,
  onChange,
}: PasswordStrengthMeterProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureOptions();
    setReady(true);
  }, []);

  // Stable key so a new-array-every-render `userInputs` prop doesn't recompute
  // the result and refire the onChange effect, which previously caused an
  // infinite render loop in parents that called setState in onChange.
  const userInputsKey = (userInputs ?? []).join("\u0001");
  const result = useMemo(() => {
    if (!ready || !password) return null;
    const r = zxcvbn(password, userInputs ?? []);
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, password, userInputsKey]);

  useEffect(() => {
    if (!onChange) return;
    if (!password) {
      onChange({ score: 0, feedback: "" });
      return;
    }
    if (!result) return;
    const score = result.score as 0 | 1 | 2 | 3 | 4;
    const feedback =
      result.feedback.warning ||
      result.feedback.suggestions[0] ||
      LABELS[score];
    onChange({ score, feedback });
  }, [result, password, onChange]);

  if (!password) return null;

  const score = (result?.score ?? 0) as 0 | 1 | 2 | 3 | 4;
  const label = LABELS[score];
  const barColor = COLORS[score];
  const filled = score + 1;
  const warning = result?.feedback.warning;
  const suggestion = result?.feedback.suggestions?.[0];

  return (
    <div className="mt-2 space-y-1.5" aria-live="polite">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < filled ? barColor : "bg-muted"
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span
          className={
            score >= 3
              ? "text-emerald-500"
              : score === 2
              ? "text-amber-500"
              : "text-destructive"
          }
        >
          {label}
        </span>
        {(warning || suggestion) && (
          <span className="text-muted-foreground truncate ml-2 max-w-[60%] text-right">
            {warning || suggestion}
          </span>
        )}
      </div>
    </div>
  );
}
