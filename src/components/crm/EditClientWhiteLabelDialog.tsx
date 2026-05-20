import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Globe,
  Palette,
  Building2,
  Upload,
  Copy,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { REQUIRED_CNAME_TARGET as CRM_CNAME_TARGET, TXT_VERIFICATION_PREFIX } from "@/lib/dns-check";
import {
  provisionCustomHostnameFn,
  tearDownCustomHostnameFn,
} from "@/functions/custom-hostnames.functions";
import { isNotConfigured, describeError } from "@/lib/cf-saas-errors";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientOrgId: string | null;
  clientName: string | null;
  onSaved?: () => void;
}

interface ClientOrgRow {
  id: string;
  brand_name: string | null;
  primary_color: string | null;
  logo_url: string | null;
  custom_domain: string | null;
  domain_verification_token: string;
  domain_verified_at: string | null;
}

export function EditClientWhiteLabelDialog({
  open,
  onOpenChange,
  clientOrgId,
  clientName,
  onSaved,
}: Props) {
  const provisionCf = useAuthedServerFn(provisionCustomHostnameFn);
  const tearDownCf = useAuthedServerFn(tearDownCustomHostnameFn);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [org, setOrg] = useState<ClientOrgRow | null>(null);

  const [brandName, setBrandName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#3b82f6");
  const [logoUrl, setLogoUrl] = useState("");
  const [customDomain, setCustomDomain] = useState("");

  useEffect(() => {
    if (!open || !clientOrgId) return;
    void (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("organizations")
        .select(
          "id, brand_name, primary_color, logo_url, custom_domain, domain_verification_token, domain_verified_at",
        )
        .eq("id", clientOrgId)
        .maybeSingle();
      setLoading(false);
      if (error || !data) {
        toast.error("Failed to load client settings");
        onOpenChange(false);
        return;
      }
      const row = data as ClientOrgRow;
      setOrg(row);
      setBrandName(row.brand_name ?? "");
      setPrimaryColor(row.primary_color ?? "#3b82f6");
      setLogoUrl(row.logo_url ?? "");
      setCustomDomain(row.custom_domain ?? "");
    })();
  }, [open, clientOrgId, onOpenChange]);

  const savedDomain = org?.custom_domain ?? "";
  const verificationToken = org?.domain_verification_token ?? "";
  const isDomainVerified = !!org?.domain_verified_at;
  const domainChanged = customDomain !== savedDomain;

  const handleSave = async () => {
    if (!clientOrgId) return;
    setSaving(true);
    const nextDomain = customDomain.trim().toLowerCase() || null;
    const previousDomain = savedDomain || null;
    const { error } = await supabase
      .from("organizations")
      .update({
        brand_name: brandName.trim() || null,
        primary_color: primaryColor || null,
        logo_url: logoUrl.trim() || null,
        custom_domain: nextDomain,
      })
      .eq("id", clientOrgId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Client white-label settings saved");

    // Sync Cloudflare for SaaS state to match the new domain. Best-effort:
    // a 503 means the operator hasn't finished the CF dashboard setup yet,
    // anything else is a real failure but we don't unwind the save — the
    // operator can retry from the panel once CF is healthy.
    if (previousDomain && previousDomain !== nextDomain) {
      try {
        await tearDownCf({
          data: { organizationId: clientOrgId, hostname: previousDomain },
        });
      } catch (err) {
        if (!isNotConfigured(err)) {
          toast.error(`Couldn't tear down old hostname on Cloudflare: ${describeError(err)}`);
        }
      }
    }
    if (nextDomain && nextDomain !== previousDomain) {
      try {
        await provisionCf({
          data: { organizationId: clientOrgId, hostname: nextDomain },
        });
        toast.success("Cloudflare custom hostname provisioned");
      } catch (err) {
        if (isNotConfigured(err)) {
          toast.warning(
            "Domain saved, but Cloudflare for SaaS isn't configured on this worker yet — customer DNS won't resolve until that's done.",
          );
        } else {
          toast.error(`Cloudflare provisioning failed: ${describeError(err)}`);
        }
      }
    }

    // Refresh local org so verification UI reflects the new domain
    const { data } = await supabase
      .from("organizations")
      .select(
        "id, brand_name, primary_color, logo_url, custom_domain, domain_verification_token, domain_verified_at",
      )
      .eq("id", clientOrgId)
      .maybeSingle();
    if (data) setOrg(data as ClientOrgRow);
    onSaved?.();
  };

  const verifyDomain = async () => {
    if (!clientOrgId || !savedDomain) return;
    setVerifying(true);
    try {
      const lookupHost = `${TXT_VERIFICATION_PREFIX}.${savedDomain}`;
      const res = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(lookupHost)}&type=TXT`,
        { headers: { Accept: "application/dns-json" } },
      );
      const dns = (await res.json()) as { Answer?: { data: string }[] };
      const records = (dns.Answer || []).map((a) => a.data.replace(/^"|"$/g, ""));
      const matched = records.some((r) => r.includes(verificationToken));
      if (!matched) {
        toast.error(
          `No matching TXT record found at ${TXT_VERIFICATION_PREFIX}.${savedDomain}. DNS can take a few minutes to propagate.`,
        );
        return;
      }
      const { data, error } = await supabase.rpc("mark_domain_verified", {
        p_org_id: clientOrgId,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string } | null;
      if (!result?.success) throw new Error(result?.error || "Verification failed");
      toast.success("Domain verified! Your client's custom domain is now active.");
      // Refresh
      const { data: refreshed } = await supabase
        .from("organizations")
        .select(
          "id, brand_name, primary_color, logo_url, custom_domain, domain_verification_token, domain_verified_at",
        )
        .eq("id", clientOrgId)
        .maybeSingle();
      if (refreshed) setOrg(refreshed as ClientOrgRow);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const copyToken = () => {
    void navigator.clipboard.writeText(verificationToken);
    toast.success("Verification token copied");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            White-Label · {clientName ?? "Client"}
          </DialogTitle>
          <DialogDescription>
            Configure this client's branding and custom domain on their behalf.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Brand Name */}
            <div>
              <Label htmlFor="ec-brand" className="text-xs flex items-center gap-1.5 mb-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                Brand name
              </Label>
              <Input
                id="ec-brand"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Their brand name"
                disabled={saving}
              />
            </div>

            {/* Primary Color */}
            <div>
              <Label htmlFor="ec-color" className="text-xs flex items-center gap-1.5 mb-1.5">
                <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                Primary color
              </Label>
              <div className="flex items-center gap-2">
                <input
                  id="ec-color"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  disabled={saving}
                  className="h-9 w-12 cursor-pointer rounded-md border border-input bg-input"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#3b82f6"
                  disabled={saving}
                  className="font-mono text-xs"
                />
                <div
                  className="h-9 w-16 rounded-md border border-border"
                  style={{ backgroundColor: primaryColor }}
                />
              </div>
            </div>

            {/* Logo URL */}
            <div>
              <Label htmlFor="ec-logo" className="text-xs flex items-center gap-1.5 mb-1.5">
                <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                Logo URL
              </Label>
              <Input
                id="ec-logo"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://their-domain.com/logo.png"
                disabled={saving}
              />
              {logoUrl && (
                <div className="mt-2 flex items-center gap-2 rounded-md bg-secondary/50 p-2">
                  <img
                    src={logoUrl}
                    alt="Logo preview"
                    className="h-7 w-7 rounded object-contain"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                  <span className="text-[11px] text-muted-foreground">Logo preview</span>
                </div>
              )}
            </div>

            {/* Custom Domain */}
            <div className="rounded-lg border border-border bg-card p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="ec-domain" className="text-xs flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  Custom domain
                </Label>
                {savedDomain &&
                  (isDomainVerified ? (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <CheckCircle2 className="h-3 w-3" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <AlertCircle className="h-3 w-3" />
                      Pending
                    </Badge>
                  ))}
              </div>
              <Input
                id="ec-domain"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value.trim().toLowerCase())}
                placeholder="crm.theirdomain.com"
                disabled={saving}
              />

              {savedDomain && !isDomainVerified && !domainChanged && (
                <div className="rounded-md border border-border bg-secondary/30 p-3 space-y-2.5">
                  <div>
                    <h4 className="text-[11px] font-semibold text-foreground mb-0.5">
                      1 — Point DNS
                    </h4>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      At the registrar, add a CNAME for{" "}
                      <code className="text-foreground">{savedDomain}</code> →{" "}
                      <code className="text-foreground">{CRM_CNAME_TARGET}</code>.
                    </p>
                  </div>
                  <div>
                    <h4 className="text-[11px] font-semibold text-foreground mb-0.5">
                      2 — Add TXT verification
                    </h4>
                    <p className="text-[10px] text-muted-foreground mb-1.5 leading-relaxed">
                      TXT record at <code className="text-foreground">{TXT_VERIFICATION_PREFIX}.{savedDomain}</code>{" "}
                      with this value:
                    </p>
                    <div className="flex gap-1.5">
                      <Input
                        readOnly
                        value={verificationToken}
                        className="h-8 text-[10px] font-mono"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyToken}
                        className="h-8 gap-1 px-2"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                      <a
                        href={`/dns-check?domain=${encodeURIComponent(savedDomain)}${
                          clientOrgId ? `&org=${clientOrgId}` : ""
                        }`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Run DNS check
                      </a>
                    </Button>
                    <Button
                      variant="command"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={verifyDomain}
                      disabled={verifying}
                    >
                      {verifying && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                      Verify domain
                    </Button>
                  </div>
                </div>
              )}

              {domainChanged && customDomain && (
                <p className="text-[11px] text-muted-foreground">
                  Save changes first, then complete verification.
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Close
          </Button>
          <Button variant="command" onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
