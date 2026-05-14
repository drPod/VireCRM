import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
  Copy,
  Check,
} from "lucide-react";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import { analyzeBusinessFn } from "@/functions/ai-advisor.functions";
import { toast } from "sonner";

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
  const { organization, session } = useAuth();
  const navigate = useNavigate();
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const analyzeBusiness = useAuthedServerFn(analyzeBusinessFn);

  const tokensRemaining = organization
    ? organization.ai_tokens_limit - organization.ai_tokens_used
    : 0;

  const handleAnalyze = async () => {
    if (!description.trim() || !organization || !session) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await analyzeBusiness({
        data: {
          businessDescription: description,
          organizationId: organization.id,
        },
      });
      setResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Analysis failed. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const copyHook = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.strategicHook);
    setCopied(true);
    toast.success("Hook copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
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
                  <Badge key={i} variant="info">
                    {s}
                  </Badge>
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
                    <Badge key={ind} variant="secondary">
                      {ind}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Job Titles</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.searchFilters.job_titles.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Keywords</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.searchFilters.keywords.map((k) => (
                    <Badge key={k} variant="outline">
                      {k}
                    </Badge>
                  ))}
                </div>
              </div>
              {result.searchFilters.company_size_min && (
                <div className="flex gap-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Company Size</p>
                    <p className="text-sm text-foreground">
                      {result.searchFilters.company_size_min} —{" "}
                      {result.searchFilters.company_size_max} employees
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

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  const term =
                    result.searchFilters.keywords[0] ||
                    result.searchFilters.industries[0] ||
                    result.searchFilters.job_titles[0] ||
                    "";
                  navigate({ to: "/leads", search: { q: term } });
                }}
              >
                <Search className="h-4 w-4" />
                Search Existing Leads
              </Button>
              <Button
                variant="command"
                className="gap-2"
                onClick={() => {
                  // Hand off to /leads with auto-find dialog open and ICP
                  // pre-filled. The auto-outreach toggle in that dialog will
                  // handle the email dispatch once leads are imported.
                  navigate({
                    to: "/leads",
                    search: {
                      action: "auto-find",
                      ai_desc:
                        `${result.icp.title} — ${result.icp.decision_maker} at ${result.icp.industry} companies (${result.icp.company_size})`.slice(
                          0,
                          1000,
                        ),
                      ai_industry: result.searchFilters.industries[0] ?? result.icp.industry,
                    },
                  });
                  toast.success("Opening auto-find with your ICP preloaded", {
                    description:
                      "Toggle 'AI auto-outreach' on before importing to email leads automatically.",
                  });
                }}
              >
                <Sparkles className="h-4 w-4" />
                Auto-find & Email Leads
              </Button>
            </div>
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
            <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={copyHook}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy to Clipboard"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
