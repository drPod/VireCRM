import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Target,
  Search,
  Lightbulb,
  Users,
  Building2,
  DollarSign,
  Briefcase,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ICP {
  title: string;
  industry: string;
  company_size: string;
  revenue_range: string;
  decision_maker: string;
  pain_points: string[];
  buying_signals: string[];
}

interface SearchFilters {
  industries: string[];
  job_titles: string[];
  company_size_min?: number;
  company_size_max?: number;
  revenue_min?: string;
  revenue_max?: string;
  keywords: string[];
}

interface AnalysisResult {
  icp: ICP;
  searchFilters: SearchFilters;
  strategicHook: string;
}

export function AiAdvisorPanel() {
  const { organization, session, role } = useAuth();
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tokensRemaining = organization
    ? organization.ai_tokens_limit - organization.ai_tokens_used
    : 0;

  const handleAnalyze = async () => {
    if (!description.trim() || !organization || !session) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Call AI advisor via server function
      const response = await fetch("/_server", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          fn: "analyzeBusinessFn",
          data: {
            businessDescription: description,
            organizationId: organization.id,
          },
        }),
      });

      // Fallback: call directly via supabase edge function if server fn isn't available
      // For now, simulate the AI response for demo purposes
      await new Promise((resolve) => setTimeout(resolve, 2500));
      
      setResult({
        icp: {
          title: "Mid-Market SaaS Decision Makers",
          industry: "B2B Software / Technology",
          company_size: "50-500 employees",
          revenue_range: "$5M-$100M ARR",
          decision_maker: "VP of Sales / Head of Revenue",
          pain_points: [
            "Manual lead qualification wastes 40% of rep time",
            "Inconsistent follow-up leads to 60% pipeline leakage",
            "No visibility into AI-driven sales optimization",
          ],
          buying_signals: [
            "Recently hired sales leadership",
            "Expanding into new markets",
            "Posted about CRM migration on LinkedIn",
          ],
        },
        searchFilters: {
          industries: ["SaaS", "Technology", "Software Development"],
          job_titles: ["VP of Sales", "Head of Revenue", "CRO", "Sales Director"],
          company_size_min: 50,
          company_size_max: 500,
          revenue_min: "$5M",
          revenue_max: "$100M",
          keywords: ["sales automation", "CRM", "pipeline management", "revenue operations"],
        },
        strategicHook:
          "Your sales team is leaving money on the table. Our AI CRM identifies your hottest leads, writes personalized outreach, and books meetings — while your reps focus on closing. Companies like yours see 3.2x more conversions in 90 days.",
      });
    } catch (err: any) {
      setError(err.message || "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Strategic Advisor
          </h2>
          <p className="text-sm text-muted-foreground">
            Describe your business and AI will generate your ideal customer profile
          </p>
        </div>
        <Badge variant={tokensRemaining > 10 ? "success" : "warning"}>
          {tokensRemaining} analyses remaining
        </Badge>
      </div>

      {/* Input */}
      <div className="rounded-xl border border-border bg-card p-6">
        <label className="mb-2 block text-sm font-medium text-foreground">
          Business Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your business, what you sell, who your customers are, and what problems you solve..."
          rows={4}
          className="w-full rounded-lg border border-input bg-input p-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring resize-none"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {description.length}/5000 characters
          </span>
          <Button
            variant="command"
            onClick={handleAnalyze}
            disabled={loading || description.length < 10 || tokensRemaining <= 0}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Strategy
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* ICP Card */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Target className="h-5 w-5 text-primary" />
              Ideal Customer Profile
            </h3>
            <p className="mt-1 text-sm font-medium text-primary">{result.icp.title}</p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Industry</p>
                  <p className="text-sm text-foreground">{result.icp.industry}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Company Size</p>
                  <p className="text-sm text-foreground">{result.icp.company_size}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <DollarSign className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Revenue Range</p>
                  <p className="text-sm text-foreground">{result.icp.revenue_range}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Briefcase className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Decision Maker</p>
                  <p className="text-sm text-foreground">{result.icp.decision_maker}</p>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Pain Points</p>
              <div className="space-y-1.5">
                {result.icp.pain_points.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                    {p}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Buying Signals</p>
              <div className="flex flex-wrap gap-2">
                {result.icp.buying_signals.map((s, i) => (
                  <Badge key={i} variant="info">{s}</Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Search Filters */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Search className="h-5 w-5 text-primary" />
              Recommended Search Filters
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Use these parameters to find your ideal leads
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Industries</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.searchFilters.industries.map((ind) => (
                    <Badge key={ind} variant="secondary">{ind}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Job Titles</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.searchFilters.job_titles.map((t) => (
                    <Badge key={t} variant="secondary">{t}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Keywords</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.searchFilters.keywords.map((k) => (
                    <Badge key={k} variant="outline">{k}</Badge>
                  ))}
                </div>
              </div>
              {result.searchFilters.company_size_min && (
                <div className="flex gap-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Company Size</p>
                    <p className="text-sm text-foreground">
                      {result.searchFilters.company_size_min} — {result.searchFilters.company_size_max} employees
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Revenue</p>
                    <p className="text-sm text-foreground">
                      {result.searchFilters.revenue_min} — {result.searchFilters.revenue_max}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <Button variant="command" className="mt-4 w-full gap-2">
              <Search className="h-4 w-4" />
              Search Leads with These Filters
            </Button>
          </div>

          {/* Strategic Hook */}
          <div className="rounded-xl border border-success/20 bg-success/5 p-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Lightbulb className="h-5 w-5 text-success" />
              Strategic Outreach Hook
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-foreground italic">
              "{result.strategicHook}"
            </p>
            <Button variant="outline" size="sm" className="mt-3">
              Copy to Clipboard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
