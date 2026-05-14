import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { submitSupportTicket } from "@/functions/support-ticket.functions";

import { CheckCircle2, Loader2 } from "lucide-react";

interface ReportIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  error: Error | null;
  componentStack?: string | null;
}

export function ReportIssueDialog({
  open,
  onOpenChange,
  error,
  componentStack,
}: ReportIssueDialogProps) {
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const submit = useServerFn(submitSupportTicket);

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      // userId / organizationId are derived server-side from the session.
      const result = await submit({
        data: {
          description: description.trim(),
          errorMessage: error?.message?.slice(0, 2000) ?? null,
          errorStack: error?.stack?.slice(0, 8000) ?? null,
          componentStack: componentStack?.slice(0, 8000) ?? null,
          url: typeof window !== "undefined" ? window.location.href : null,
        },
      });

      if (result.success) {
        setSubmitted(true);
      } else {
        setErrorMsg(result.error || "Failed to submit");
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      // reset on close
      setDescription("");
      setSubmitted(false);
      setErrorMsg(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        {submitted ? (
          <>
            <DialogHeader>
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle className="text-center">Report sent</DialogTitle>
              <DialogDescription className="text-center">
                Thanks — our team has received your report and will look into it.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => handleClose(false)} className="w-full">
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Report this issue</DialogTitle>
              <DialogDescription>
                Tell us what you were doing when this happened. Technical details are attached
                automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="report-description">What happened?</Label>
                <Textarea
                  id="report-description"
                  placeholder="I was trying to..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  maxLength={5000}
                  disabled={submitting}
                  autoFocus
                />
              </div>
              {error?.message && (
                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs font-medium text-muted-foreground">Error attached</p>
                  <p className="mt-1 break-all font-mono text-xs text-destructive">
                    {error.message}
                  </p>
                </div>
              )}
              {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => handleClose(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting || !description.trim()}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send report
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
