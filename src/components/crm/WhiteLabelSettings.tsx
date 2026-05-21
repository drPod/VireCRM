import { useAuth } from "@/components/auth/AuthProvider";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Eye, Loader2, Palette, Shield } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CustomDomainsSection } from "@/components/crm/CustomDomainsPanel";
import { CustomerDomainOnboardingDialog } from "@/components/crm/CustomerDomainOnboardingDialog";
import { BrandColorGrid } from "@/components/crm/BrandColorGrid";
import { BrandNameField, LogoUploadForm } from "@/components/crm/LogoUploadForm";
import { FontFamilyPicker } from "@/components/crm/FontFamilyPicker";
import { BusinessEmailField, EmailSignatureField } from "@/components/crm/EmailBrandingFields";
import { isValidHexColor } from "@/lib/white-label-hex";
import {
  buildThemePayload,
  downloadThemeFile,
  parseThemeFile,
  slugifyBrandName,
} from "@/lib/white-label-theme-io";

type OrgWithDomain = {
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
  const [saving, setSaving] = useState(false);

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
          : `${invalidColor.label} color must be a valid hex like #7c3aed`,
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

  const handleExportTheme = () => {
    const payload = buildThemePayload({
      brandName,
      primaryColor,
      secondaryColor,
      accentColor,
      sidebarColor,
      buttonColor,
      logoUrl,
      faviconUrl,
      fontFamily,
      emailSignature,
    });
    const safeName = slugifyBrandName(brandName || organization?.slug || "brand");
    downloadThemeFile(payload, `${safeName}-theme.json`);
    toast.success("Theme exported");
  };

  const handleImportTheme = async (file: File) => {
    try {
      const text = await file.text();
      const patch = parseThemeFile(text);

      // Apply to local form state — user still has to click Save to persist.
      if (patch.brandName !== undefined) setBrandName(patch.brandName);
      if (patch.primaryColor !== undefined) setPrimaryColor(patch.primaryColor);
      if (patch.secondaryColor !== undefined) setSecondaryColor(patch.secondaryColor);
      if (patch.accentColor !== undefined) setAccentColor(patch.accentColor);
      if (patch.sidebarColor !== undefined) setSidebarColor(patch.sidebarColor);
      if (patch.buttonColor !== undefined) setButtonColor(patch.buttonColor);
      if (patch.logoUrl !== undefined) setLogoUrl(patch.logoUrl);
      if (patch.faviconUrl !== undefined) setFaviconUrl(patch.faviconUrl);
      if (patch.fontFamily !== undefined) setFontFamily(patch.fontFamily);
      if (patch.emailSignature !== undefined) setEmailSignature(patch.emailSignature);

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
          <p className="text-sm text-muted-foreground">Customize your CRM branding</p>
        </div>
        {!isEnterprise && (
          <Badge variant="warning" className="gap-1">
            <Crown className="h-3 w-3" />
            Enterprise Only
          </Badge>
        )}
      </div>

      <div className={`space-y-4 ${!isEnterprise ? "opacity-50 pointer-events-none" : ""}`}>
        <BrandNameField brandName={brandName} setBrandName={setBrandName} />

        <BrandColorGrid
          palette={{ primaryColor, secondaryColor, accentColor, sidebarColor, buttonColor }}
          setters={{
            setPrimaryColor,
            setSecondaryColor,
            setAccentColor,
            setSidebarColor,
            setButtonColor,
          }}
          onExport={handleExportTheme}
          onImport={(file) => void handleImportTheme(file)}
        />

        <LogoUploadForm
          logoUrl={logoUrl}
          setLogoUrl={setLogoUrl}
          faviconUrl={faviconUrl}
          setFaviconUrl={setFaviconUrl}
        />

        <FontFamilyPicker fontFamily={fontFamily} setFontFamily={setFontFamily} />

        <EmailSignatureField
          emailSignature={emailSignature}
          setEmailSignature={setEmailSignature}
          brandName={brandName}
        />

        {/* Custom Hostnames — primary + aliases, each verified independently */}
        <div className="flex justify-end">
          <CustomerDomainOnboardingDialog />
        </div>
        <CustomDomainsSection organizationId={organization?.id} />

        <BusinessEmailField supportEmail={supportEmail} setSupportEmail={setSupportEmail} />

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
          <h3 className="mt-2 text-sm font-semibold text-foreground">Upgrade to Enterprise</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            White-labeling is available on the Enterprise plan. Customize your logo, colors, domain,
            and sell the CRM as your own.
          </p>
          <Button variant="command" size="sm" className="mt-3" asChild>
            <Link to="/billing" search={{ required: undefined, plan: undefined }}>
              Upgrade Now
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
