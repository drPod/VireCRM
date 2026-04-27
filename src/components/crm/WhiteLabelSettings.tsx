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
  Download,
  FileUp,
} from "lucide-react";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SUPPORTED_FONTS } from "@/lib/white-label-theme";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { CustomDomainsPanel } from "@/components/crm/CustomDomainsPanel";

type OrgWithDomain = {
  is_reseller?: boolean;
  domain_verification_token?: string;
  domain_verified_at?: string | null;
  support_email?: string | null;
  favicon_url?: string | null;
  font_family?: string | null;
  email_signature?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  sidebar_color?: string | null;
  button_color?: string | null;
};

export function WhiteLabelSettings() {
  const { organization, role, refreshProfile } = useAuth();
  const orgExt = organization as (typeof organization & OrgWithDomain) | null;
  const [brandName, setBrandName] = useState(organization?.brand_name || "");
  const [primaryColor, setPrimaryColor] = useState(organization?.primary_color || "#3b82f6");
  const [secondaryColor, setSecondaryColor] = useState(orgExt?.secondary_color || "");
  const [accentColor, setAccentColor] = useState(orgExt?.accent_color || "");
  const [sidebarColor, setSidebarColor] = useState(orgExt?.sidebar_color || "");
  const [buttonColor, setButtonColor] = useState(orgExt?.button_color || "");
  const [logoUrl, setLogoUrl] = useState(organization?.logo_url || "");
  const [faviconUrl, setFaviconUrl] = useState(orgExt?.favicon_url || "");
  const [fontFamily, setFontFamily] = useState(orgExt?.font_family || "");
  const [emailSignature, setEmailSignature] = useState(orgExt?.email_signature || "");
  const [supportEmail, setSupportEmail] = useState(orgExt?.support_email || "");
  const initialIsReseller = !!orgExt?.is_reseller;
  const [isReseller, setIsReseller] = useState(initialIsReseller);
  const [saving, setSaving] = useState(false);
  const [togglingReseller, setTogglingReseller] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Validate the entire palette up-front so we can both block Save and
  // disable the button visually. Empty optional colors are fine; primary
  // must be a real hex.
  const paletteChecks: Array<{ label: string; value: string; required: boolean }> = [
    { label: "Primary", value: primaryColor, required: true },
    { label: "Secondary", value: secondaryColor, required: false },
    { label: "Accent", value: accentColor, required: false },
    { label: "Sidebar", value: sidebarColor, required: false },
    { label: "Call-to-action button", value: buttonColor, required: false },
  ];
  const invalidColor = paletteChecks.find((c) => {
    const t = c.value.trim();
    if (t === "") return c.required;
    return !isValidHexColor(t);
  });
  const paletteValid = !invalidColor;

  const handleSave = async () => {
    if (!organization?.id) return;
    if (invalidColor) {
      toast.error(
        invalidColor.value.trim() === ""
          ? `${invalidColor.label} color is required`
          : `${invalidColor.label} color must be a valid hex like #7c3aed`
      );
      return;
    }
    const trimmedSupport = supportEmail.trim();
    if (trimmedSupport && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedSupport)) {
      toast.error("Please enter a valid support email address");
      return;
    }
    setSaving(true);

    const updates: Record<string, unknown> = {
      brand_name: brandName || null,
      primary_color: primaryColor,
      secondary_color: secondaryColor || null,
      accent_color: accentColor || null,
      sidebar_color: sidebarColor || null,
      button_color: buttonColor || null,
      logo_url: logoUrl || null,
      favicon_url: faviconUrl || null,
      font_family: fontFamily || null,
      email_signature: emailSignature.trim() || null,
      support_email: trimmedSupport || null,
    };
    // Only attempt to write custom_domain when the org actually has the
    // entitlement — otherwise the DB trigger will reject the whole update.
    if (customDomainEnabled) {
      updates.custom_domain = customDomain || null;
    }

    const { error } = await supabase
      .from("organizations")
      .update(updates as never)
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

  /* ---------------------------------------------------------------------- */
  /* Theme export / import                                                   */
  /* ---------------------------------------------------------------------- */


  const handleExportTheme = () => {
    const payload = {
      schema: "genesis.brand-theme",
      version: 1,
      exportedAt: new Date().toISOString(),
      brandName: brandName || null,
      palette: {
        primary: primaryColor || null,
        secondary: secondaryColor || null,
        accent: accentColor || null,
        sidebar: sidebarColor || null,
        button: buttonColor || null,
      },
      assets: {
        logoUrl: logoUrl || null,
        faviconUrl: faviconUrl || null,
      },
      typography: {
        fontFamily: fontFamily || null,
      },
      email: {
        signature: emailSignature || null,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = (brandName || organization?.slug || "brand")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    a.href = url;
    a.download = `${safeName}-theme.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Theme exported");
  };

  const handleImportTheme = async (file: File) => {
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("File is not a valid theme JSON");
      }
      const theme = parsed as Record<string, unknown>;
      const palette = (theme.palette as Record<string, unknown>) || {};
      const assets = (theme.assets as Record<string, unknown>) || {};
      const typography = (theme.typography as Record<string, unknown>) || {};
      const email = (theme.email as Record<string, unknown>) || {};

      const str = (v: unknown) => (typeof v === "string" ? v : "");
      // For palette colors: keep "" (means "inherit") but reject anything
      // that's neither empty nor a real hex so a corrupt file can't poison
      // the form.
      const hex = (v: unknown): string | null => {
        if (v === null || v === undefined) return "";
        if (typeof v !== "string") return null;
        const trimmed = v.trim();
        if (trimmed === "") return "";
        return isValidHexColor(trimmed) ? trimmed : null;
      };

      const paletteFields: Array<[string, unknown]> = [
        ["primary", palette.primary],
        ["secondary", palette.secondary],
        ["accent", palette.accent],
        ["sidebar", palette.sidebar],
        ["button", palette.button],
      ];
      for (const [key, raw] of paletteFields) {
        if (raw !== undefined && hex(raw) === null) {
          throw new Error(`Theme file has an invalid hex value for "${key}"`);
        }
      }

      // Apply to local form state — user still has to click Save to persist.
      if (typeof theme.brandName === "string") setBrandName(theme.brandName);
      if (palette.primary !== undefined) {
        const next = hex(palette.primary);
        setPrimaryColor(next && next !== "" ? next : "#3b82f6");
      }
      if (palette.secondary !== undefined) setSecondaryColor(hex(palette.secondary) ?? "");
      if (palette.accent !== undefined) setAccentColor(hex(palette.accent) ?? "");
      if (palette.sidebar !== undefined) setSidebarColor(hex(palette.sidebar) ?? "");
      if (palette.button !== undefined) setButtonColor(hex(palette.button) ?? "");

      if (assets.logoUrl !== undefined) setLogoUrl(str(assets.logoUrl));
      if (assets.faviconUrl !== undefined) setFaviconUrl(str(assets.faviconUrl));
      if (typography.fontFamily !== undefined) setFontFamily(str(typography.fontFamily));
      if (email.signature !== undefined) setEmailSignature(str(email.signature));

      toast.success("Theme loaded — review and click Save to apply");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read theme file");
    }
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

        {/* Brand Palette */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <div>
                <label className="text-sm font-medium text-foreground">Brand Palette</label>
                <p className="text-xs text-muted-foreground">
                  Primary is required. The other colors are optional — leave them blank to derive them from primary.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImportTheme(file);
                  // Reset so re-importing the same file fires onChange.
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                title="Load a previously exported theme JSON"
              >
                <FileUp className="h-3.5 w-3.5" />
                Import
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleExportTheme}
                title="Download the current theme as JSON to share or back up"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
            </div>
          </div>

          <ColorRow
            label="Primary"
            description="Buttons, links, focus rings, active sidebar item."
            value={primaryColor}
            onChange={setPrimaryColor}
          />
          <ColorRow
            label="Secondary"
            description="Soft surfaces, badges, secondary buttons."
            value={secondaryColor}
            onChange={setSecondaryColor}
            optional
          />
          <ColorRow
            label="Accent"
            description="Hover states, subtle highlights."
            value={accentColor}
            onChange={setAccentColor}
            optional
          />
          <ColorRow
            label="Sidebar"
            description="Background of the left navigation rail."
            value={sidebarColor}
            onChange={setSidebarColor}
            optional
          />
          <ColorRow
            label="Call-to-action button"
            description="Distinct CTA color (e.g. green for sign-ups)."
            value={buttonColor}
            onChange={setButtonColor}
            optional
          />
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

        {/* Custom Hostnames — primary + aliases, each verified independently */}
        <CustomDomainsPanel organizationId={organization?.id} />

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

        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="flex-1 gap-2" asChild>
            <Link
              to="/settings/branding-preview"
              search={{
                brandName: brandName || undefined,
                primaryColor: primaryColor || undefined,
                secondaryColor: secondaryColor || undefined,
                accentColor: accentColor || undefined,
                sidebarColor: sidebarColor || undefined,
                buttonColor: buttonColor || undefined,
                logoUrl: logoUrl || undefined,
                faviconUrl: faviconUrl || undefined,
                fontFamily: fontFamily || undefined,
                emailSignature: emailSignature || undefined,
              }}
            >
              <Eye className="h-4 w-4" />
              Preview live
            </Link>
          </Button>
          <Button
            variant="command"
            className="flex-1"
            onClick={handleSave}
            disabled={saving || !paletteValid}
            title={paletteValid ? undefined : "Fix the highlighted color values before saving"}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save White-Label Settings
          </Button>
        </div>
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

/**
 * Strict 3- or 6-digit hex with leading #. We deliberately reject 4/8-digit
 * (alpha) hex because the theming engine's luminance math expects RGB only.
 */
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_RE.test(value.trim());
}

/**
 * Reusable color-picker row used by the brand palette card. Optional rows
 * show a "Clear" button so the value can be reset to "use default" (empty
 * string) and then derived from primary by the theming engine.
 *
 * Shows an inline error when the typed value isn't a valid hex color so the
 * user can self-correct before saving. The native color picker only ever
 * emits valid hex, so picking from it implicitly clears the error.
 */
function ColorRow({
  label,
  description,
  value,
  onChange,
  optional,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (next: string) => void;
  optional?: boolean;
}) {
  const trimmed = value.trim();
  const isEmpty = trimmed === "";
  const isValid = isEmpty ? optional === true : isValidHexColor(trimmed);
  const showError = !isValid;
  // Only feed a real color into native swatches when valid — otherwise fall
  // back to a neutral grey so we never throw a CSS parse warning.
  const swatch = isValid && !isEmpty ? trimmed : "#cccccc";

  const errorId = `color-error-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <p className="text-xs font-semibold text-foreground">
            {label}
            {optional && (
              <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                Optional
              </span>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
        {optional && value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={swatch}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-md border border-input"
        />
        <input
          type="text"
          value={value}
          placeholder={optional ? "Inherits from primary" : "#7c3aed"}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={showError}
          aria-describedby={showError ? errorId : undefined}
          className={`h-9 flex-1 rounded-md border bg-input px-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 ${
            showError
              ? "border-destructive focus:ring-destructive"
              : "border-input focus:ring-ring"
          }`}
        />
        <div
          className="h-9 w-16 rounded-md border border-border"
          style={{ backgroundColor: swatch }}
          aria-hidden
        />
      </div>
      {showError && (
        <p
          id={errorId}
          className="mt-1 flex items-center gap-1 text-[11px] text-destructive"
        >
          <AlertCircle className="h-3 w-3 shrink-0" />
          {isEmpty
            ? "Primary color is required."
            : "Use a 3- or 6-digit hex like #7c3aed."}
        </p>
      )}
    </div>
  );
}

