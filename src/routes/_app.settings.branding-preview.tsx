import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  applyBrandFont,
  applyFavicon,
  applyWhiteLabelColor,
  SUPPORTED_FONTS,
} from "@/lib/white-label-theme";
import { ArrowLeft, Eye, Mail, Sparkles, Users, TrendingUp, Shield } from "lucide-react";

const searchSchema = z.object({
  brandName: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  sidebarColor: z.string().optional(),
  buttonColor: z.string().optional(),
  logoUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
  fontFamily: z.string().optional(),
  emailSignature: z.string().optional(),
});

export const Route = createFileRoute("/_app/settings/branding-preview")({
  validateSearch: searchSchema,
  component: BrandingPreviewPage,
  head: () => ({
    meta: [
      { title: "Genesis — Branding Preview" },
      {
        name: "description",
        content: "Preview your white-label branding before publishing.",
      },
    ],
  }),
});

type DraftBranding = {
  brandName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  sidebarColor: string;
  buttonColor: string;
  logoUrl: string;
  faviconUrl: string;
  fontFamily: string;
  emailSignature: string;
};

function BrandingPreviewPage() {
  const { organization } = useAuth();
  const search = useSearch({ from: "/_app/settings/branding-preview" });

  type OrgExt = {
    favicon_url?: string | null;
    font_family?: string | null;
    email_signature?: string | null;
    secondary_color?: string | null;
    accent_color?: string | null;
    sidebar_color?: string | null;
    button_color?: string | null;
  };
  const orgExt = organization as (typeof organization & OrgExt) | null;

  // Draft state: start from URL params (passed from settings) or fall back
  // to the org's currently saved branding so the user always sees something.
  const initial: DraftBranding = useMemo(
    () => ({
      brandName: search.brandName ?? organization?.brand_name ?? "Acme CRM",
      primaryColor: search.primaryColor ?? organization?.primary_color ?? "#7c3aed",
      secondaryColor: search.secondaryColor ?? orgExt?.secondary_color ?? "",
      accentColor: search.accentColor ?? orgExt?.accent_color ?? "",
      sidebarColor: search.sidebarColor ?? orgExt?.sidebar_color ?? "",
      buttonColor: search.buttonColor ?? orgExt?.button_color ?? "",
      logoUrl: search.logoUrl ?? organization?.logo_url ?? "",
      faviconUrl: search.faviconUrl ?? orgExt?.favicon_url ?? "",
      fontFamily: search.fontFamily ?? orgExt?.font_family ?? "",
      emailSignature: search.emailSignature ?? orgExt?.email_signature ?? "",
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [draft, setDraft] = useState<DraftBranding>(initial);

  // Apply the draft palette to the live document so the surrounding chrome
  // (sidebar, buttons, focus rings) re-themes in real time.
  useEffect(
    () =>
      applyWhiteLabelColor({
        primary: draft.primaryColor,
        secondary: draft.secondaryColor || undefined,
        accent: draft.accentColor || undefined,
        sidebar: draft.sidebarColor || undefined,
        button: draft.buttonColor || undefined,
      }),
    [
      draft.primaryColor,
      draft.secondaryColor,
      draft.accentColor,
      draft.sidebarColor,
      draft.buttonColor,
    ],
  );
  useEffect(() => applyFavicon(draft.faviconUrl), [draft.faviconUrl]);
  useEffect(() => applyBrandFont(draft.fontFamily), [draft.fontFamily]);

  const update = <K extends keyof DraftBranding>(key: K, value: DraftBranding[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const reset = () => setDraft(initial);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Link
              to="/settings"
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to Settings
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Branding Preview
          </h1>
          <p className="text-sm text-muted-foreground">
            Tweak your branding here to see it live across the CRM, storefront, and emails. Nothing
            is saved until you publish from Settings.
          </p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Sparkles className="h-3 w-3" />
          Draft preview
        </Badge>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        {/* Draft controls */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Draft branding</h3>

            <Field label="Brand name">
              <input
                type="text"
                value={draft.brandName}
                onChange={(e) => update("brandName", e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-input px-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>

            <PaletteField
              label="Primary"
              value={draft.primaryColor}
              onChange={(v) => update("primaryColor", v)}
            />
            <PaletteField
              label="Secondary"
              value={draft.secondaryColor}
              onChange={(v) => update("secondaryColor", v)}
              optional
            />
            <PaletteField
              label="Accent"
              value={draft.accentColor}
              onChange={(v) => update("accentColor", v)}
              optional
            />
            <PaletteField
              label="Sidebar"
              value={draft.sidebarColor}
              onChange={(v) => update("sidebarColor", v)}
              optional
            />
            <PaletteField
              label="CTA button"
              value={draft.buttonColor}
              onChange={(v) => update("buttonColor", v)}
              optional
            />

            <Field label="Logo URL">
              <input
                type="text"
                value={draft.logoUrl}
                onChange={(e) => update("logoUrl", e.target.value)}
                placeholder="https://…/logo.png"
                className="h-9 w-full rounded-md border border-input bg-input px-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>

            <Field label="Favicon URL">
              <input
                type="text"
                value={draft.faviconUrl}
                onChange={(e) => update("faviconUrl", e.target.value)}
                placeholder="https://…/favicon.png"
                className="h-9 w-full rounded-md border border-input bg-input px-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>

            <Field label="Brand font">
              <select
                value={draft.fontFamily}
                onChange={(e) => update("fontFamily", e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-input px-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Default (Inter)</option>
                {SUPPORTED_FONTS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Email signature">
              <textarea
                value={draft.emailSignature}
                onChange={(e) => update("emailSignature", e.target.value)}
                rows={3}
                placeholder={"— The Acme team\nhello@acme.com"}
                className="w-full rounded-md border border-input bg-input px-2.5 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </Field>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={reset} className="flex-1">
                Reset
              </Button>
              <Button size="sm" asChild className="flex-1">
                <Link to="/settings" search={{ tab: "branding" }}>
                  Publish in Settings
                </Link>
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Changes here only affect your current browser tab. Use the Settings page to save them
              for everyone on your team.
            </p>
          </div>
        </aside>

        {/* Live previews */}
        <div className="space-y-6 min-w-0">
          <PreviewBlock title="CRM dashboard" description="How your team sees the app every day.">
            <CrmPreview draft={draft} />
          </PreviewBlock>

          <PreviewBlock
            title="Public storefront"
            description="What prospects see at your reseller landing page."
          >
            <StorefrontPreview draft={draft} />
          </PreviewBlock>

          <PreviewBlock title="Outbound email" description="Branded outreach sent on your behalf.">
            <EmailPreview draft={draft} />
          </PreviewBlock>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function PaletteField({
  label,
  value,
  onChange,
  optional,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  optional?: boolean;
}) {
  const swatch = value || "#cccccc";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">
          {label}
          {optional && <span className="ml-1 text-[10px] text-muted-foreground/70">optional</span>}
        </label>
        {optional && value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
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
          placeholder={optional ? "Inherits primary" : "#7c3aed"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 flex-1 rounded-md border border-input bg-input px-2.5 text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
    </div>
  );
}

function PreviewBlock({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <header className="px-5 py-3 border-b border-border bg-secondary/30">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

/* ----------------------------- Sample previews ---------------------------- */

function CrmPreview({ draft }: { draft: DraftBranding }) {
  const fontStyle = draft.fontFamily ? { fontFamily: draft.fontFamily } : undefined;
  const sidebar = draft.sidebarColor || withAlpha(draft.primaryColor, 0.06);
  const sidebarFg = pickReadableTextColor(sidebar);
  const cta = draft.buttonColor || draft.primaryColor;
  const secondary = draft.secondaryColor || withAlpha(draft.primaryColor, 0.1);
  return (
    <div
      className="rounded-lg border border-border overflow-hidden bg-background"
      style={fontStyle}
    >
      {/* App top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          {draft.logoUrl ? (
            <img
              src={draft.logoUrl}
              alt=""
              className="h-6 w-6 rounded object-contain"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <div className="h-6 w-6 rounded" style={{ backgroundColor: draft.primaryColor }} />
          )}
          <span className="text-sm font-semibold text-foreground">
            {draft.brandName || "Your brand"}
          </span>
        </div>
        <div
          className="h-7 w-7 rounded-full"
          style={{ backgroundColor: draft.primaryColor, opacity: 0.9 }}
          aria-hidden
        />
      </div>

      {/* Body */}
      <div className="grid grid-cols-[160px_1fr]">
        {/* Sidebar */}
        <div
          className="border-r border-border p-3 space-y-1"
          style={{ backgroundColor: sidebar, color: sidebarFg }}
        >
          {[
            { icon: TrendingUp, label: "Dashboard", active: true },
            { icon: Users, label: "Leads" },
            { icon: Mail, label: "Inbox" },
            { icon: Shield, label: "Settings" },
          ].map(({ icon: Icon, label, active }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs"
              style={
                active
                  ? {
                      backgroundColor: draft.primaryColor,
                      color: pickReadableTextColor(draft.primaryColor),
                    }
                  : { color: sidebarFg }
              }
            >
              <Icon
                className="h-3.5 w-3.5"
                style={!active ? { color: draft.primaryColor } : undefined}
              />
              <span className={active ? "font-semibold" : undefined}>{label}</span>
            </div>
          ))}
        </div>

        {/* Main */}
        <div className="p-4 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">Welcome back</p>
            <h2 className="text-base font-semibold text-foreground">Pipeline this week</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "New", value: "12" },
              { label: "Contacted", value: "34" },
              { label: "Won", value: "7" },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-md border border-border p-3"
                style={{ backgroundColor: secondary }}
              >
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {m.label}
                </p>
                <p className="text-lg font-bold" style={{ color: draft.primaryColor }}>
                  {m.value}
                </p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-xs font-semibold"
              style={{
                backgroundColor: cta,
                color: pickReadableTextColor(cta),
              }}
            >
              New lead
            </button>
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-xs font-semibold"
              style={{
                backgroundColor: secondary,
                color: pickReadableTextColor(secondary),
              }}
            >
              Import
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StorefrontPreview({ draft }: { draft: DraftBranding }) {
  const fontStyle = draft.fontFamily ? { fontFamily: draft.fontFamily } : undefined;
  return (
    <div
      className="rounded-lg border border-border overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${withAlpha(draft.primaryColor, 0.08)}, transparent 60%)`,
        ...fontStyle,
      }}
    >
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          {draft.logoUrl ? (
            <img
              src={draft.logoUrl}
              alt=""
              className="h-6 w-6 rounded object-contain"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <div className="h-6 w-6 rounded" style={{ backgroundColor: draft.primaryColor }} />
          )}
          <span className="text-sm font-semibold text-foreground">
            {draft.brandName || "Your brand"}
          </span>
        </div>
        <button
          type="button"
          className="rounded-md px-3 py-1.5 text-xs font-semibold"
          style={{
            backgroundColor: draft.buttonColor || draft.primaryColor,
            color: pickReadableTextColor(draft.buttonColor || draft.primaryColor),
          }}
        >
          Get started
        </button>
      </div>

      <div className="px-6 py-10 text-center space-y-3">
        <span
          className="inline-block rounded-full px-3 py-1 text-[11px] font-semibold"
          style={{
            backgroundColor: draft.accentColor || withAlpha(draft.primaryColor, 0.15),
            color: pickReadableTextColor(draft.accentColor || withAlpha(draft.primaryColor, 0.15)),
          }}
        >
          Built for {draft.brandName || "your business"}
        </span>
        <h2 className="text-2xl font-bold text-foreground">The CRM your team will actually use.</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Capture leads, automate follow-ups, and close more deals — all under your brand.
        </p>
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            className="rounded-md px-4 py-2 text-xs font-semibold"
            style={{
              backgroundColor: draft.buttonColor || draft.primaryColor,
              color: pickReadableTextColor(draft.buttonColor || draft.primaryColor),
            }}
          >
            Start free trial
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-4 py-2 text-xs font-semibold text-foreground"
            style={
              draft.secondaryColor
                ? {
                    backgroundColor: draft.secondaryColor,
                    color: pickReadableTextColor(draft.secondaryColor),
                  }
                : undefined
            }
          >
            See pricing
          </button>
        </div>
      </div>
    </div>
  );
}

function EmailPreview({ draft }: { draft: DraftBranding }) {
  const fontStyle = draft.fontFamily ? { fontFamily: draft.fontFamily } : undefined;
  const signature = draft.emailSignature.trim() || `— The ${draft.brandName || "Your brand"} team`;
  return (
    <div
      className="rounded-lg border border-border bg-background overflow-hidden"
      style={fontStyle}
    >
      <div
        className="px-5 py-4 flex items-center gap-3"
        style={{
          borderBottom: `3px solid ${draft.primaryColor}`,
        }}
      >
        {draft.logoUrl ? (
          <img
            src={draft.logoUrl}
            alt=""
            className="h-8 w-8 rounded object-contain"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        ) : (
          <div className="h-8 w-8 rounded" style={{ backgroundColor: draft.primaryColor }} />
        )}
        <div>
          <p className="text-sm font-semibold text-foreground">{draft.brandName || "Your brand"}</p>
          <p className="text-[11px] text-muted-foreground">
            no-reply@{(draft.brandName || "yourbrand").toLowerCase().replace(/\s+/g, "")}.com
          </p>
        </div>
      </div>
      <div className="p-5 space-y-3 text-sm text-foreground">
        <p>Hi Jordan,</p>
        <p>
          I noticed your team has been growing fast — congrats! I'd love to show you how{" "}
          {draft.brandName || "we"} can help you keep every new lead warm without lifting a finger.
        </p>
        <p>Are you open to a 15-minute call this week?</p>
        <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans">
          {signature}
        </pre>
      </div>
    </div>
  );
}

/* --------------------------------- helpers -------------------------------- */

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.replace("#", "").trim();
  if (m.length !== 3 && m.length !== 6) return null;
  const full =
    m.length === 3
      ? m
          .split("")
          .map((c) => c + c)
          .join("")
      : m;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return null;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function pickReadableTextColor(bg: string): string {
  const rgb = hexToRgb(bg);
  if (!rgb) return "#ffffff";
  const [r, g, b] = rgb;
  // Standard luminance check
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#0b0b0f" : "#ffffff";
}

function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
