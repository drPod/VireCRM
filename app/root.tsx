import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { Toaster } from "~/components/ui/sonner";
import { TooltipProvider } from "~/components/ui/tooltip";
// `sentry.client.ts` runs `Sentry.init` as a side effect and re-exports
// `captureException`. RR v7 strips `*.client.ts` from the server bundle, so
// `captureException` is `undefined` during SSR — hence the optional call below.
import { captureException } from "./sentry.client";

// Geist Variable ships bundled via @fontsource-variable/geist (imported in
// app.css) — no external font hosts needed.
export const links: Route.LinksFunction = () => [];

// Supabase config lives in Worker vars (wrangler.jsonc), not VITE_ env — the
// server loader hands it to the browser via window.__ENV__ below.
export function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  return {
    supabaseUrl: env.SUPABASE_URL,
    supabasePublishableKey: env.SUPABASE_PUBLISHABLE_KEY,
  };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {data ? (
          <script
            // Inline (not module) so it runs before hydration; `<` escaped to
            // keep the JSON inert inside a script tag.
            // biome-ignore lint/security/noDangerouslySetInnerHtml: controlled config values
            dangerouslySetInnerHTML={{
              __html: `window.__ENV__=${JSON.stringify(data).replace(/</g, "\\u003c")}`,
            }}
          />
        ) : null}
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <Toaster richColors position="top-right" />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (error && error instanceof Error) {
    captureException?.(error);
    if (import.meta.env.DEV) {
      details = error.message;
      stack = error.stack;
    }
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
