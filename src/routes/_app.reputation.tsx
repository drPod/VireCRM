import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Star,
  Send,
  TrendingUp,
  MessageCircle,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  MoreHorizontal,
  RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/_app/reputation")({
  component: ReputationPage,
  head: () => ({
    meta: [
      { title: "Vireon — Reputation" },
      { name: "description", content: "Review management and reputation tracking" },
    ],
  }),
});

const demoReviews = [
  {
    id: "1",
    author: "Michael Johnson",
    platform: "Google",
    rating: 5,
    text: "Incredible CRM platform. The AI follow-ups saved us 20 hours a week. Highly recommend for any sales team.",
    date: "2 days ago",
    replied: true,
  },
  {
    id: "2",
    author: "Emily Davis",
    platform: "Google",
    rating: 4,
    text: "Great features and easy to set up. Would love to see more integrations with calendar tools.",
    date: "5 days ago",
    replied: false,
  },
  {
    id: "3",
    author: "Robert Chen",
    platform: "Facebook",
    rating: 5,
    text: "We switched from GoHighLevel and haven't looked back. The white-label options are far superior.",
    date: "1 week ago",
    replied: true,
  },
  {
    id: "4",
    author: "Lisa Thompson",
    platform: "Google",
    rating: 3,
    text: "Good tool overall but the learning curve is steep. Support was helpful though.",
    date: "2 weeks ago",
    replied: false,
  },
  {
    id: "5",
    author: "David Park",
    platform: "Trustpilot",
    rating: 5,
    text: "Best CRM investment we've ever made. The automation workflows alone are worth 10x the price.",
    date: "2 weeks ago",
    replied: true,
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < rating ? "fill-warning text-warning" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

function ReputationPage() {
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reputation</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Monitor reviews, request feedback, and manage your online reputation
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Sync Reviews
            </Button>
            <Button variant="command" className="gap-2">
              <Send className="h-4 w-4" />
              Request Reviews
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-5 gap-4">
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <span className="text-3xl font-bold text-foreground">4.7</span>
              <Star className="h-5 w-5 fill-warning text-warning" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Average Rating</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-3xl font-bold text-foreground">142</p>
            <p className="mt-1 text-xs text-muted-foreground">Total Reviews</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-3xl font-bold text-success">+18</p>
            <p className="mt-1 text-xs text-muted-foreground">This Month</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-3xl font-bold text-foreground">89%</p>
            <p className="mt-1 text-xs text-muted-foreground">Response Rate</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <TrendingUp className="h-4 w-4 text-success" />
              <span className="text-3xl font-bold text-success">+0.3</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Rating Trend</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Reviews list */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Recent Reviews</h2>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="text-xs">All</Button>
                <Button variant="ghost" size="sm" className="text-xs">Needs Reply</Button>
                <Button variant="ghost" size="sm" className="text-xs">Negative</Button>
              </div>
            </div>

            {demoReviews.map((review) => (
              <div
                key={review.id}
                className="rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/20"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {review.author.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{review.author}</span>
                        <Badge variant="outline" className="text-xs">{review.platform}</Badge>
                        {review.replied && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <MessageCircle className="h-2.5 w-2.5" /> Replied
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <StarRating rating={review.rating} />
                        <span className="text-xs text-muted-foreground">{review.date}</span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{review.text}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {!review.replied && (
                      <Button variant="outline" size="sm" className="gap-1 text-xs">
                        <MessageCircle className="h-3 w-3" /> Reply
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right panel */}
          <div className="space-y-6">
            {/* Rating distribution */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Rating Distribution</h3>
              {[
                { stars: 5, count: 98, pct: 69 },
                { stars: 4, count: 27, pct: 19 },
                { stars: 3, count: 11, pct: 8 },
                { stars: 2, count: 4, pct: 3 },
                { stars: 1, count: 2, pct: 1 },
              ].map((row) => (
                <div key={row.stars} className="mb-2 flex items-center gap-2">
                  <span className="w-3 text-xs text-muted-foreground">{row.stars}</span>
                  <Star className="h-3 w-3 fill-warning text-warning" />
                  <div className="flex-1 h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-warning"
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs text-muted-foreground">{row.count}</span>
                </div>
              ))}
            </div>

            {/* Connected platforms */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Connected Platforms</h3>
              <div className="space-y-3">
                {[
                  { name: "Google Business", reviews: 98, rating: 4.8 },
                  { name: "Facebook", reviews: 32, rating: 4.6 },
                  { name: "Trustpilot", reviews: 12, rating: 4.9 },
                ].map((platform) => (
                  <div key={platform.name} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{platform.name}</p>
                      <p className="text-xs text-muted-foreground">{platform.reviews} reviews</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-semibold text-foreground">{platform.rating}</span>
                      <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="mt-3 w-full gap-1 text-xs">
                <Plus className="h-3 w-3" /> Connect Platform
              </Button>
            </div>

            {/* Review request automation */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
              <h3 className="text-sm font-semibold text-foreground">Auto Review Requests</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Automatically request reviews via SMS & email after service completion
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Sent this month: 34</span>
                <Badge variant="default" className="text-xs">Active</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
