import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { WhiteLabelTheme } from "@/components/auth/WhiteLabelTheme";
import { DomainBrandingProvider } from "@/components/auth/DomainBrandingProvider";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import { GlobalAuthErrorListener } from "@/components/GlobalAuthErrorListener";
import { PageTransition } from "@/components/PageTransition";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  // Root route's `head` only fires on the root match; not-found renders inside
  // it, so override the title imperatively so 404s don't inherit the landing-page title.
  useEffect(() => {
    const prev = document.title;
    document.title = "Page not found — Genesis";
    return () => {
      document.title = prev;
    };
  }, []);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Genesis — AI CRM that follows up so your team can close" },
      {
        name: "description",
        content:
          "Genesis is the AI-powered CRM that follows up, nurtures, and surfaces hot leads for you — so your sales team focuses on closing, not chasing.",
      },
      { name: "theme-color", content: "#9333EA" },
      { property: "og:site_name", content: "Genesis" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Genesis — AI CRM that follows up so your team can close" },
      {
        property: "og:description",
        content:
          "Genesis is the AI-powered CRM that follows up, nurtures, and surfaces hot leads for you — so your sales team focuses on closing, not chasing.",
      },
      { name: "twitter:title", content: "Genesis — AI CRM that follows up so your team can close" },
      {
        name: "twitter:description",
        content:
          "Genesis is the AI-powered CRM that follows up, nurtures, and surfaces hot leads for you — so your sales team focuses on closing, not chasing.",
      },
      {
        property: "og:image",
        content: "https://genesisx.space/genesis-logo.png",
      },
      {
        name: "twitter:image",
        content: "https://genesisx.space/genesis-logo.png",
      },
    ],
    links: [
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "icon", type: "image/png", href: "/genesis-logo.png" },
      { rel: "apple-touch-icon", href: "/genesis-logo.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Genesis",
          url: "https://genesisx.space",
          logo: "https://genesisx.space/genesis-logo.png",
          sameAs: [],
          contactPoint: {
            "@type": "ContactPoint",
            telephone: "+1-940-365-6600",
            contactType: "customer support",
            email: "support@genesisx.space",
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Genesis",
          url: "https://genesisx.space",
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <GlobalErrorBoundary>
      <GlobalAuthErrorListener />
      <DomainBrandingProvider>
        <AuthProvider>
          <WhiteLabelTheme />
          <PageTransition>
            <Outlet />
          </PageTransition>
          <Toaster />
        </AuthProvider>
      </DomainBrandingProvider>
    </GlobalErrorBoundary>
  );
}
