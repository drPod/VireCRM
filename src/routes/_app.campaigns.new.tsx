import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { createDraftCampaignFn } from "@/functions/campaigns.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/campaigns/new")({
  component: NewCampaignPage,
  head: () => ({
    meta: [{ title: "VireCRM — New Campaign" }],
  }),
});

function NewCampaignPage() {
  const { organization } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Campaign name is required");
      return;
    }
    setSubmitting(true);
    try {
      const { campaignId } = await createDraftCampaignFn({
        data: {
          organizationId: organization.id,
          name: trimmed,
          objective: objective.trim() || null,
        },
      });
      toast.success("Draft campaign created");
      navigate({
        to: "/campaigns/$id",
        params: { id: campaignId },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create campaign");
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">New Campaign</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Start with a name and objective. You'll set audience, sequence, and schedule next.
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-xl border border-border bg-card p-6"
        >
          <div className="space-y-2">
            <Label htmlFor="campaign-name">Name</Label>
            <Input
              id="campaign-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Q1 enterprise outbound"
              autoFocus
              required
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="campaign-objective">Objective (optional)</Label>
            <Textarea
              id="campaign-objective"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Book demos with mid-market SaaS founders"
              rows={3}
              disabled={submitting}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/campaigns" })}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="command" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Continue
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
