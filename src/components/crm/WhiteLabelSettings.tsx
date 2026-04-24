import { useAuth } from "@/components/auth/AuthProvider";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Building2,
  Palette,
  Globe,
  Upload,
  Crown,
  Shield,
  Sparkles,
  Loader2,
  Copy,
  CheckCircle2,
  AlertCircle,
  Mail,
  Type,
  ImageIcon,
  PenLine,
  Eye,
} from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SUPPORTED_FONTS } from "@/lib/white-label-theme";

type OrgWithDomain = {
  is_reseller?: boolean;
  domain_verification_token?: string;
  domain_verified_at?: string | null;
  support_email?: string | null;
  favicon_url?: string | null;
  font_family?: string | null;
  email_signature?: string | null;
};

export function WhiteLabelSettings() {
  const { organization, role, refreshProfile } = useAuth();
  const orgExt = organization as (typeof organization & OrgWithDomain) | null;
  const [brandName, setBrandName] = useState(organization?.brand_name || "");
  const [primaryColor, setPrimaryColor] = useState(organization?.primary_color || "#3b82f6");
  const [logoUrl, setLogoUrl] = useState(organization?.logo_url || "");
  const [faviconUrl, setFaviconUrl] = useState(orgExt?.favicon_url || "");
  const [fontFamily, setFontFamily] = useState(orgExt?.font_family || "");
  const [emailSignature, setEmailSignature] = useState(orgExt?.email_signature || "");
  const [customDomain, setCustomDomain] = useState(organization?.custom_domain || "");
  const [supportEmail, setSupportEmail] = useState(orgExt?.support_email || "");
  const initialIsReseller = !!orgExt?.is_reseller;
  const [isReseller, setIsReseller] = useState(initialIsReseller);
  const [saving, setSaving] = useState(false);
  const [togglingReseller, setTogglingReseller] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const verificationToken = orgExt?.domain_verification_token || "";
  const isDomainVerified = !!orgExt?.domain_verified_at;
  const savedDomain = organization?.custom_domain || "";
  const domainChanged = customDomain !== savedDomain;

  const verifyDomain = async () => {
    if (!organization?.id || !savedDomain) return;
    setVerifying(true);
    try {
      // Use Cloudflare DNS-over-HTTPS to look up TXT records for _vireon.<domain>
      const lookupHost = `_vireon.${savedDomain}`;
      const res = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(lookupHost)}&type=TXT`,
        { headers: { Accept: "application/dns-json" } }
      );
      const dns = (await res.json()) as { Answer?: { data: string }[] };
      const records = (dns.Answer || []).map((a) => a.data.replace(/^"|"$/g, ""));
      const matched = records.some((r) => r.includes(verificationToken));

      if (!matched) {
        toast.error(`No matching TXT record found at _vireon.${savedDomain}. DNS can take up to a few minutes to propagate.`);
        return;
      }

      const { data, error } = await supabase.rpc("mark_domain_verified", {
        p_org_id: organization.id,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string } | null;
      if (!result?.success) throw new Error(result?.error || "Verification failed");
      toast.success("Domain verified! Your custom domain is now active.");
      await refreshProfile();
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

  const isEnterprise = organization?.plan === "enterprise";
  const isOwner = role?.role === "owner";

  if (!isOwner) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <Shield className="mx-auto h-8 w-8 text-muted-foreground" />
        <h3 className="mt-3 text-sm font-semibold text-foreground">Access Restricted</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Only organization owners can manage white-label settings.
        </p>
      </div>
    );
  }

  const handleSave = async () => {
    if (!organization?.id) return;
    const trimmedSupport = supportEmail.trim();
    if (trimmedSupport && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedSupport)) {
      toast.error("Please enter a valid support email address");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("organizations")
      .update({
        brand_name: brandName || null,
        primary_color: primaryColor,
        logo_url: logoUrl || null,
        favicon_url: faviconUrl || null,
        font_family: fontFamily || null,
        email_signature: emailSignature.trim() || null,
        custom_domain: customDomain || null,
        support_email: trimmedSupport || null,
      } as never)
      .eq("id", organization.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("White-label settings saved");
      await refreshProfile();
    }
  };

  const handleToggleReseller = async (next: boolean) => {
    if (!organization?.id) return;
    setTogglingReseller(true);
    const { error } = await supabase
      .from("organizations")
      .update({ is_reseller: next } as never)
      .eq("id", organization.id);
    setTogglingReseller(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setIsReseller(next);
    toast.success(next ? "Reseller mode enabled" : "Reseller mode disabled");
    await refreshProfile();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            White-Label Settings
          </h2>
          <p className="text-sm text-muted-foreground">
            Customize your CRM branding
          </p>
        </div>
        {!isEnterprise && (
          <Badge variant="warning" className="gap-1">
            <Crown className="h-3 w-3" />
            Enterprise Only
          </Badge>
        )}
      </div>

      {/* Reseller toggle */}
      {isEnterprise && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-foreground">Reseller Mode</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Onboard your own clients under your branded CRM. Each client gets an isolated workspace.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {togglingReseller && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Switch
                checked={isReseller}
                onCheckedChange={handleToggleReseller}
                disabled={togglingReseller}
              />
            </div>
          </div>

          {isReseller && organization?.slug && (
            <div className="rounded-lg border border-border bg-background/60 p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground">Your public storefront</p>
              <p className="text-xs text-muted-foreground">
                Share this link to let prospects see your branded landing page, plans, and signup.
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/r/${organization.slug}`}
                  className="h-9 flex-1 rounded-md border border-input bg-input px-2 text-xs text-foreground font-mono outline-none"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    void navigator.clipboard.writeText(
                      `${window.location.origin}/r/${organization.slug}`
                    );
                    toast.success("Storefront link copied");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`/r/${organization.slug}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className={`space-y-4 ${!isEnterprise ? "opacity-50 pointer-events-none" : ""}`}>
        {/* Brand Name */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <label className="text-sm font-medium text-foreground">Brand Name</label>
          </div>
          <input
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="Your Brand Name"
            className="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Primary Color */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <label className="text-sm font-medium text-foreground">Primary Color</label>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded-lg border border-input"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-10 flex-1 rounded-lg border border-input bg-input px-3 text-sm text-foreground font-mono outline-none focus:ring-1 focus:ring-ring"
            />
            <div
              className="h-10 w-24 rounded-lg"
              style={{ backgroundColor: primaryColor }}
            />
          </div>
        </div>

        {/* Logo URL */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <label className="text-sm font-medium text-foreground">Logo URL</label>
          </div>
          <input
            type="text"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://your-logo.com/logo.png"
            className="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
          />
          {logoUrl && (
            <div className="mt-3 flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
              <img
                src={logoUrl}
                alt="Logo preview"
                className="h-8 w-8 rounded object-contain"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
              <span className="text-xs text-muted-foreground">Logo preview</span>
            </div>
          )}
        </div>

        {/* Favicon URL */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            <label className="text-sm font-medium text-foreground">Favicon URL</label>
          </div>
          <input
            type="text"
            value={faviconUrl}
            onChange={(e) => setFaviconUrl(e.target.value)}
            placeholder="https://your-cdn.com/favicon.png"
            className="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Square image (32×32 or 64×64 recommended). Shown in the browser tab on
            your custom domain and reseller storefront. Supports PNG, SVG, or ICO.
          </p>
          {faviconUrl && (
            <div className="mt-3 flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
              <img
                src={faviconUrl}
                alt="Favicon preview"
                className="h-6 w-6 rounded object-contain"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
              <span className="text-xs text-muted-foreground">Favicon preview</span>
            </div>
          )}
        </div>

        {/* Font Family */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <Type className="h-4 w-4 text-muted-foreground" />
            <label className="text-sm font-medium text-foreground">Brand Font</label>
          </div>
          <select
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Default (Inter)</option>
            {SUPPORTED_FONTS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          {fontFamily && (
            <div
              className="mt-3 rounded-lg bg-secondary/50 p-3 text-base text-foreground"
              style={{ fontFamily }}
            >
              The quick brown fox jumps over the lazy dog
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Applied across the CRM, reseller landing page, and emails so your
            brand reads consistently everywhere.
          </p>
        </div>

        {/* Email Signature */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <PenLine className="h-4 w-4 text-muted-foreground" />
            <label className="text-sm font-medium text-foreground">Email Signature</label>
          </div>
          <textarea
            value={emailSignature}
            onChange={(e) => setEmailSignature(e.target.value)}
            placeholder={"— The Acme team\nhello@acme.com"}
            rows={3}
            className="w-full rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring resize-none"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Appended to outbound emails sent through Genesis. Leave blank to use
            the default sign-off ("— {brandName || "Your brand"}").
          </p>
        </div>

        {/* Custom Domain */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <label className="text-sm font-medium text-foreground">Custom Domain</label>
            </div>
            {savedDomain && (
              isDomainVerified ? (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Verified
                </Badge>
              ) : (
                <Badge variant="warning" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Pending verification
                </Badge>
              )
            )}
          </div>
          <input
            type="text"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value.trim().toLowerCase())}
            placeholder="crm.yourdomain.com"
            className="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
          />

          {savedDomain && !isDomainVerified && !domainChanged && (
            <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
              <div>
                <h4 className="text-xs font-semibold text-foreground mb-1">Step 1 — Point your domain</h4>
                <p className="text-xs text-muted-foreground">
                  Add a CNAME or A record at your DNS provider so <code className="text-foreground">{savedDomain}</code> points to this app.
                </p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-foreground mb-1">Step 2 — Add the verification TXT record</h4>
                <p className="text-xs text-muted-foreground mb-2">
                  Create a TXT record at <code className="text-foreground">_vireon.{savedDomain}</code> with the value below:
                </p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={verificationToken}
                    className="h-9 flex-1 rounded-md border border-input bg-input px-2 text-xs text-foreground font-mono outline-none"
                  />
                  <Button variant="outline" size="sm" onClick={copyToken} className="gap-1.5">
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
              </div>
              <Button
                variant="command"
                size="sm"
                className="w-full"
                onClick={verifyDomain}
                disabled={verifying}
              >
                {verifying && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Verify Domain
              </Button>
            </div>
          )}

          {domainChanged && customDomain && (
            <p className="text-xs text-muted-foreground">
              Save changes first, then complete verification below.
            </p>
          )}
        </div>

        {/* Business / Reply-to Email */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <label className="text-sm font-medium text-foreground">Business Email</label>
          </div>
          <input
            type="email"
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
            placeholder="you@yourcompany.com"
            className="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Used as the <strong className="text-foreground">Reply-To</strong> on outreach
            emails sent through Genesis, and as the support address on your branded error
            screens. When a lead hits Reply, the message lands in this inbox. To also
            send <em>from</em> your own domain, connect SendGrid under Integrations.
          </p>
        </div>

        <Button variant="command" className="w-full" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save White-Label Settings
        </Button>
      </div>

      {!isEnterprise && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-center">
          <Crown className="mx-auto h-6 w-6 text-primary" />
          <h3 className="mt-2 text-sm font-semibold text-foreground">
            Upgrade to Enterprise
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            White-labeling is available on the Enterprise plan. Customize your logo, colors, domain, and sell the CRM as your own.
          </p>
          <Button variant="command" size="sm" className="mt-3" asChild>
            <Link to="/billing" search={{ required: undefined, plan: undefined }}>Upgrade Now</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
