import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { WhiteLabelTheme } from "@/components/auth/WhiteLabelTheme";
import { DomainBrandingProvider } from "@/components/auth/DomainBrandingProvider";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
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
      { title: "Vireon — Autonomous Sales System" },
      { name: "description", content: "Vireon: AI-powered CRM with autonomous sales workflows, white-labeling, and tiered access." },
      { property: "og:title", content: "Vireon — Autonomous Sales System" },
      { property: "og:description", content: "Vireon: AI-powered CRM with autonomous sales workflows, white-labeling, and tiered access." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Vireon — Autonomous Sales System" },
      { name: "twitter:description", content: "Vireon: AI-powered CRM with autonomous sales workflows, white-labeling, and tiered access." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/8be2d2ac-a57a-4813-9099-b62302767639" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/8be2d2ac-a57a-4813-9099-b62302767639" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  return (
    <DomainBrandingProvider>
      <AuthProvider>
        <WhiteLabelTheme />
        <Outlet />
      </AuthProvider>
    </DomainBrandingProvider>
  );
}
