import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, MessageCircle, Plug, Sparkles, Mail } from "lucide-react";

export const Route = createFileRoute("/_app/reputation")({
  component: ReputationPage,
  head: () => ({
    meta: [
      { title: "Vireon — Reputation" },
      { name: "description", content: "Review management and reputation tracking" },
    ],
  }),
});

const platforms = [
  { name: "Google Business", description: "Sync reviews and reply from Vireon" },
  { name: "Facebook", description: "Pull recommendations and respond inline" },
  { name: "Trustpilot", description: "Import ratings and trigger review requests" },
];

function ReputationPage() {
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reputation</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Monitor reviews, request feedback, and reply from one place
            </p>
          </div>
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="h-3 w-3" />
            Coming soon
          </Badge>
        </div>

        <div className="mb-8 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Star className="h-7 w-7 text-primary" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            No reviews connected yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Connect Google, Facebook, or Trustpilot to import reviews automatically and
            reply to customers without leaving Vireon.
          </p>
          <Button variant="command" className="mt-5 gap-2" disabled>
            <Plug className="h-4 w-4" />
            Connect a platform
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            We'll notify you when integrations are live.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Available integrations</h2>
            <div className="space-y-3">
              {platforms.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between rounded-xl border border-border bg-card p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Star className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Not connected
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                What's coming
              </h3>
              <ul className="space-y-3 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <MessageCircle className="mt-0.5 h-3.5 w-3.5 text-primary" />
                  <span>One-click replies from your unified inbox</span>
                </li>
                <li className="flex items-start gap-2">
                  <Mail className="mt-0.5 h-3.5 w-3.5 text-primary" />
                  <span>Automated review requests after a deal closes</span>
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 text-primary" />
                  <span>AI-suggested responses tuned to your brand voice</span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
              <h3 className="text-sm font-semibold text-foreground">
                Want this sooner?
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Reply to your onboarding email and tell us which platform matters most —
                we prioritize integrations that customers ask for.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
