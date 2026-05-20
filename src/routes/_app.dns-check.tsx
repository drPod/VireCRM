import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Globe,
  Loader2,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  REQUIRED_CNAME_TARGET,
  runDomainChecklist,
  type CheckResult,
  type ChecklistResult,
} from "@/lib/dns-check";

interface DnsCheckSearch {
  domain?: string;
  org?: string;
}

export const Route = createFileRoute("/_app/dns-check")({
  component: DnsCheckPage,
  validateSearch: (search: Record<string, unknown>): DnsCheckSearch => ({
    domain: typeof search.domain === "string" ? search.domain : undefined,
    org: typeof search.org === "string" ? search.org : undefined,
  }),
  head: () => ({
    meta: [
      { title: "VireCRM — DNS Checklist" },
      { name: "description", content: "Validate custom domain DNS records before verifying" },
    ],
  }),
});

interface OrgRow {
  id: string;
  name: string;
  custom_domain: string | null;
  domain_verification_token: string;
  domain_verified_at: string | null;
}

function DnsCheckPage() {
  const { isAdmin, loading: adminLoading } = usePlatformAdmin();
  const search = Route.useSearch();

  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [selectedOrgId, setSelectedOrgId] = useState<string>(search.org ?? "");
  const [domain, setDomain] = useState<string>(search.domain ?? "");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ChecklistResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  const selectedOrg = useMemo(
    () => orgs.find((o) => o.id === selectedOrgId) ?? null,
    [orgs, selectedOrgId],
  );
  const token = selectedOrg?.domain_verification_token ?? null;

  // Load orgs with custom domains for the dropdown
  useEffect(() => {
    if (!isAdmin) {
      setOrgsLoading(false);
      return;
    }
    void (async () => {
      const { data } = await supabase
        .from("organizations")
        .select("id, name, custom_domain, domain_verification_token, domain_verified_at")
        .not("custom_domain", "is", null)
        .order("name");
      setOrgs((data as OrgRow[]) ?? []);
      setOrgsLoading(false);
    })();
  }, [isAdmin]);

  // When an org is selected, sync the domain input
  useEffect(() => {
    if (selectedOrg?.custom_domain) {
      setDomain(selectedOrg.custom_domain);
    }
  }, [selectedOrg]);

  const runCheck = async () => {
    if (!domain.trim()) {
      toast.error("Enter a domain first");
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const r = await runDomainChecklist(domain, token);
      setResult(r);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "DNS lookup failed");
    } finally {
      setRunning(false);
    }
  };

  const verifyNow = async () => {
    if (!selectedOrg) {
      toast.error("Select an org first to verify");
      return;
    }
    setVerifying(true);
    try {
      const { data, error } = await supabase.rpc("mark_domain_verified", {
        p_org_id: selectedOrg.id,
      });
      if (error) throw error;
      const out = data as { success: boolean; error?: string } | null;
      if (!out?.success) throw new Error(out?.error || "Verification failed");
      toast.success(`${selectedOrg.name} — domain verified!`);
      setOrgs((prev) =>
        prev.map((o) =>
          o.id === selectedOrg.id ? { ...o, domain_verified_at: new Date().toISOString() } : o,
        ),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const copy = (value: string) => {
    void navigator.clipboard.writeText(value);
    toast.success("Copied");
  };

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Platform admin required</CardTitle>
            <CardDescription>This tool is only available to platform admins.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="gap-1">
          <Link to="/settings">
            <ArrowLeft className="h-4 w-4" />
            Settings
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Globe className="h-6 w-6 text-primary" />
          DNS Checklist
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Validate custom-domain DNS records before flipping a client live. Also flags risky
          changes to email DNS (MX/SPF/DKIM/DMARC).
        </p>
      </div>

      {/* Input bar */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr,1fr,auto]">
            <div>
              <Label className="text-xs mb-1.5 block">Org (optional)</Label>
              <Select
                value={selectedOrgId || "none"}
                onValueChange={(v) => setSelectedOrgId(v === "none" ? "" : v)}
                disabled={orgsLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick an org…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— none / manual —</SelectItem>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name} · {o.custom_domain}
                      {o.domain_verified_at ? " ✅" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="dns-domain" className="text-xs mb-1.5 block">
                Domain
              </Label>
              <Input
                id="dns-domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value.trim().toLowerCase())}
                placeholder="example.com"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runCheck();
                }}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={runCheck} disabled={running || !domain.trim()} className="gap-2">
                {running ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Run check
              </Button>
            </div>
          </div>

          {token && (
            <div className="flex items-center gap-2 rounded-md bg-secondary/50 p-2 text-xs">
              <span className="text-muted-foreground">Token:</span>
              <code className="font-mono text-foreground">{token}</code>
              <Button variant="ghost" size="sm" onClick={() => copy(token)} className="h-6 px-2">
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verdict */}
      {result && <VerdictBanner result={result} onVerify={verifyNow} canVerify={!!selectedOrg} verifying={verifying} verified={!!selectedOrg?.domain_verified_at} />}

      {/* Required records */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Required records</CardTitle>
            <CardDescription>
              All of these must pass for{" "}
              <code className="text-foreground">{domain}</code> to verify and serve the CRM.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.required.map((c) => (
              <CheckRow key={c.id} check={c} onCopy={copy} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Email safety */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Email safety panel
            </CardTitle>
            <CardDescription>
              These records belong to the client's email setup. They should be{" "}
              <strong>untouched</strong> by the CRM domain change.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.email.map((c) => (
              <CheckRow key={c.id} check={c} onCopy={copy} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">What we expect</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-1.5 text-muted-foreground font-mono">
          <div>CNAME &lt;subdomain&gt; {REQUIRED_CNAME_TARGET}</div>
          <div>TXT   _virecrm.&lt;subdomain&gt; &lt;verification token&gt;</div>
        </CardContent>
      </Card>
    </div>
  );
}

function VerdictBanner({
  result,
  onVerify,
  canVerify,
  verifying,
  verified,
}: {
  result: ChecklistResult;
  onVerify: () => void;
  canVerify: boolean;
  verifying: boolean;
  verified: boolean;
}) {
  if (verified) {
    return (
      <Card className="border-green-500/40 bg-green-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">Already verified</p>
            <p className="text-muted-foreground">This domain is live.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (result.verdict === "ready") {
    return (
      <Card className="border-green-500/40 bg-green-500/5">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div className="text-sm">
              <p className="font-semibold text-foreground">Safe to verify</p>
              <p className="text-muted-foreground">
                All required records check out and email DNS looks healthy.
              </p>
            </div>
          </div>
          {canVerify && (
            <Button onClick={onVerify} disabled={verifying} variant="command">
              {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify now
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (result.verdict === "email-risk") {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="p-4 flex items-center gap-3">
          <XCircle className="h-5 w-5 text-destructive" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">Email DNS may be broken</p>
            <p className="text-muted-foreground">
              CRM records are correct but the client's email records are missing or unhealthy.
              Review the email panel before continuing.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardContent className="p-4 flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-amber-500" />
        <div className="text-sm">
          <p className="font-semibold text-foreground">Not ready</p>
          <p className="text-muted-foreground">
            One or more required records are missing or wrong. Fix the items below and re-run.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function statusBadge(status: CheckResult["status"]) {
  switch (status) {
    case "pass":
      return (
        <Badge variant="secondary" className="gap-1 bg-green-500/15 text-green-500 border-green-500/30">
          <CheckCircle2 className="h-3 w-3" /> Pass
        </Badge>
      );
    case "fail":
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" /> Fail
        </Badge>
      );
    case "warn":
      return (
        <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-500">
          <AlertCircle className="h-3 w-3" /> Warn
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1">
          Info
        </Badge>
      );
  }
}

function CheckRow({ check, onCopy }: { check: CheckResult; onCopy: (v: string) => void }) {
  return (
    <div className="rounded-md border border-border bg-card/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground">{check.label}</span>
            {statusBadge(check.status)}
          </div>
          <div className="text-[11px] text-muted-foreground space-y-0.5">
            <div>
              <span className="text-muted-foreground/70">Expected:</span>{" "}
              <code className="text-foreground">{check.expected}</code>
            </div>
            <div>
              <span className="text-muted-foreground/70">Found:</span>{" "}
              {check.actual.length === 0 ? (
                <span className="italic">(none)</span>
              ) : (
                <code className="text-foreground break-all">{check.actual.join(", ")}</code>
              )}
            </div>
            {check.hint && <div className="text-amber-500/90 mt-1">{check.hint}</div>}
          </div>
        </div>
        {check.status === "fail" && check.expected && check.expected !== "(none — should be removed)" && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => onCopy(check.expected)}
          >
            <Copy className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
