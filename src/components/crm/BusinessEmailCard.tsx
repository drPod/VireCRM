/**
 * Sender identity card — lets the org owner set the business email address
 * that's used as the Reply-To on all outreach emails sent through Genesis.
 *
 * Why a dedicated card (and not just the white-label settings)?
 *  - White-label settings are gated to the Enterprise plan, but every plan
 *    can benefit from having replies route to their own inbox.
 *  - This sits next to the SendGrid card so the relationship between
 *    "where replies go" and "where the email comes from" is explicit.
 *
 * Persistence path: the support_email column on `organizations` is the same
 * field the white-label panel writes to — they're intentionally one value,
 * not two.
 */
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, CheckCircle2, Loader2, AlertCircle, KeyRound } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

interface BusinessEmailCardProps {
  /** Whether the org has a verified BYO SendGrid key — drives the helper copy. */
  sendgridConnected: boolean;
}

export function BusinessEmailCard({ sendgridConnected }: BusinessEmailCardProps) {
  const { organization, refreshProfile } = useAuth();
  const orgExt = organization as
    | (typeof organization & { support_email?: string | null })
    | null;
  const initial = orgExt?.support_email ?? "";
  const [email, setEmail] = useState(initial);
  const [saving, setSaving] = useState(false);

  // Reseed when the org loads / refreshes so we don't show stale values.
  useEffect(() => {
    setEmail(orgExt?.support_email ?? "");
  }, [orgExt?.support_email]);

  const trimmed = email.trim();
  const dirty = trimmed !== (initial || "");
  const looksValid =
    !trimmed || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  const configured = !!initial;

  const handleSave = async () => {
    if (!organization?.id) return;
    if (trimmed && !looksValid) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({ support_email: trimmed || null } as never)
        .eq("id", organization.id);
      if (error) throw error;
      toast.success(
        trimmed
          ? "Business email saved — outreach replies will route here."
          : "Business email cleared.",
      );
      await refreshProfile();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <h3 className="text-base font-semibold text-foreground">
            Sender identity
          </h3>
          {configured ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3 text-success" />
              Reply-to set
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <AlertCircle className="h-3 w-3" />
              Not configured
            </Badge>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-3">
        The address Genesis uses as <strong className="text-foreground">Reply-To</strong> on
        every outreach email. When a lead hits Reply, the message lands in this inbox
        instead of disappearing into a generic platform address.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@yourcompany.com"
          className="h-10 flex-1 rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
          aria-invalid={!looksValid}
        />
        <Button
          variant="command"
          onClick={handleSave}
          disabled={saving || !dirty || !looksValid}
          className="sm:w-auto"
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {configured ? "Update" : "Save"}
        </Button>
      </div>

      {!looksValid && (
        <p className="mt-2 text-xs text-destructive">
          Please enter a valid email address.
        </p>
      )}

      <div className="mt-4 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground space-y-1.5">
        <div className="flex items-start gap-2">
          <KeyRound className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">Want emails to also send <em>from</em> your own domain?</p>
            <p className="mt-0.5">
              {sendgridConnected ? (
                <>
                  <CheckCircle2 className="inline h-3 w-3 text-success mr-1" />
                  SendGrid is connected — outreach is now sent from your verified
                  SendGrid sender, not the platform default.
                </>
              ) : (
                <>
                  Connect <span className="font-medium text-foreground">SendGrid</span> below
                  with a verified sender address. Outreach will then send from your own
                  domain (proper DKIM/SPF) instead of the shared platform sender.
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {!configured && (
        <p className="mt-3 text-xs text-muted-foreground">
          You can also set this on the{" "}
          <Link to="/settings" className="text-primary hover:underline">
            White-Label tab
          </Link>{" "}
          — it's the same field.
        </p>
      )}
    </Card>
  );
}
