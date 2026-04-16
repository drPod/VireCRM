import { useAuth } from "@/components/auth/AuthProvider";
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
} from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function WhiteLabelSettings() {
  const { organization, role, refreshProfile } = useAuth();
  const [brandName, setBrandName] = useState(organization?.brand_name || "");
  const [primaryColor, setPrimaryColor] = useState(organization?.primary_color || "#3b82f6");
  const [logoUrl, setLogoUrl] = useState(organization?.logo_url || "");
  const [customDomain, setCustomDomain] = useState(organization?.custom_domain || "");
  const initialIsReseller = !!(organization as { is_reseller?: boolean } | null)?.is_reseller;
  const [isReseller, setIsReseller] = useState(initialIsReseller);
  const [saving, setSaving] = useState(false);
  const [togglingReseller, setTogglingReseller] = useState(false);

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
    setSaving(true);
    const { error } = await supabase
      .from("organizations")
      .update({
        brand_name: brandName || null,
        primary_color: primaryColor,
        logo_url: logoUrl || null,
        custom_domain: customDomain || null,
      })
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
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
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

        {/* Custom Domain */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <label className="text-sm font-medium text-foreground">Custom Domain</label>
          </div>
          <input
            type="text"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            placeholder="crm.yourdomain.com"
            className="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
          />
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
          <Button variant="command" size="sm" className="mt-3">
            Upgrade Now
          </Button>
        </div>
      )}
    </div>
  );
}
