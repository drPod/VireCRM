import { Building2, ImageIcon, Upload } from "lucide-react";

const INPUT_CLASS =
  "h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring";

export function BrandNameField({
  brandName,
  setBrandName,
}: {
  brandName: string;
  setBrandName: (next: string) => void;
}) {
  return (
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
        className={INPUT_CLASS}
      />
    </div>
  );
}

export function LogoUploadForm({
  logoUrl,
  setLogoUrl,
  faviconUrl,
  setFaviconUrl,
}: {
  logoUrl: string;
  setLogoUrl: (next: string) => void;
  faviconUrl: string;
  setFaviconUrl: (next: string) => void;
}) {
  return (
    <>
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
          className={INPUT_CLASS}
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
          className={INPUT_CLASS}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Square image (32×32 or 64×64 recommended). Shown in the browser tab on your custom domain.
          Supports PNG, SVG, or ICO.
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
    </>
  );
}
