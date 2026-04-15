import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Palette,
  Globe,
  Upload,
  Crown,
  Users,
  Shield,
} from "lucide-react";
import { useState } from "react";

export function WhiteLabelSettings() {
  const { organization, role } = useAuth();
  const [brandName, setBrandName] = useState(organization?.brand_name || "");
  const [primaryColor, setPrimaryColor] = useState(organization?.primary_color || "#3b82f6");
  const [logoUrl, setLogoUrl] = useState(organization?.logo_url || "");
  const [customDomain, setCustomDomain] = useState(organization?.custom_domain || "");

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

        <Button variant="command" className="w-full">
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
