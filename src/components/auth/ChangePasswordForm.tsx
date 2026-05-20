import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X } from "lucide-react";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrengthMeter, type PasswordStrengthResult } from "@/components/auth/PasswordStrengthMeter";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError } from "@/lib/auth-errors";
import { toast } from "sonner";

interface ChangePasswordFormProps {
  onSuccess?: () => void;
}

function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-1.5 ${met ? "text-foreground" : "text-muted-foreground"}`}>
      {met ? <Check className="h-3 w-3 text-primary" /> : <X className="h-3 w-3" />}
      {label}
    </li>
  );
}

export function ChangePasswordForm({ onSuccess }: ChangePasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [score, setScore] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [loading, setLoading] = useState(false);

  const checks = {
    length: password.length >= 8,
    match: password.length > 0 && password === confirmPassword,
    strength: score >= 2,
  };
  const canSubmit = checks.length && checks.match && checks.strength && !loading;

  const handleStrengthChange = (result: PasswordStrengthResult) => {
    setScore(result.score);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
        data: { must_change_password: null },
      });
      if (error) throw error;
      toast.success("Password updated");
      setPassword("");
      setConfirmPassword("");
      setScore(0);
      onSuccess?.();
    } catch (err) {
      toast.error(friendlyAuthError(err, "Failed to update password"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="email" name="username" autoComplete="username" hidden readOnly value="" />

      <div>
        <label htmlFor="cp-new-password" className="mb-1.5 block text-sm font-medium text-foreground">
          New Password
        </label>
        <PasswordInput
          id="cp-new-password"
          name="new-password"
          autoComplete="new-password"
          required
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordStrengthMeter password={password} onChange={handleStrengthChange} />
      </div>

      <div>
        <label htmlFor="cp-confirm-password" className="mb-1.5 block text-sm font-medium text-foreground">
          Confirm Password
        </label>
        <PasswordInput
          id="cp-confirm-password"
          name="new-password"
          autoComplete="new-password"
          required
          placeholder="Re-enter password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>

      {password.length > 0 && (
        <ul className="space-y-1 text-xs">
          <Requirement met={checks.length} label="At least 8 characters" />
          <Requirement met={checks.match} label="Passwords match" />
          <Requirement met={checks.strength} label="Password must be Fair or stronger" />
        </ul>
      )}

      <Button type="submit" variant="command" className="w-full" disabled={!canSubmit}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Update Password
      </Button>
    </form>
  );
}
