---
title: "Manual Setup"
description: "Learn how to manually set up Sentry in your React Router v7 app and capture your first errors."
url: https://docs.sentry.io/platforms/javascript/guides/react-router/manual-setup/
---

# Manual Setup | Sentry for React Router Framework

##### Important

This SDK is currently in **beta**. Beta features are still in progress and may have bugs. Please reach out on [GitHub](https://github.com/getsentry/sentry-javascript/issues/new/choose) if you have any feedback or concerns.

For the fastest setup, we recommend using the [wizard installer](https://docs.sentry.io/platforms/javascript/guides/react-router.md).

## [Prerequisites](https://docs.sentry.io/platforms/javascript/guides/react-router/manual-setup.md#prerequisites)

You need:

* A Sentry [account](https://sentry.io/signup/) and [project](https://docs.sentry.io/product/projects.md)
* Your application up and running

## [Install](https://docs.sentry.io/platforms/javascript/guides/react-router/manual-setup.md#install)

Choose the features you want to configure, and this guide will show you how:

Error Monitoring\[ ]Tracing\[ ]Profiling\[ ]Session Replay\[ ]Logs\[ ]User Feedback

Want to learn more about these features?

* [**Issues**](https://docs.sentry.io/product/issues.md) (always enabled)
  <!-- -->
  :
  <!-- -->
  Sentry's core error monitoring product that automatically reports errors, uncaught exceptions, and unhandled rejections. If you have something that looks like an exception, Sentry can capture it.
* [**Tracing**](https://docs.sentry.io/product/tracing.md):
  <!-- -->
  Track software performance while seeing the impact of errors across multiple systems. For example, distributed tracing allows you to follow a request from the frontend to the backend and back.
* [**Profiling**](https://docs.sentry.io/product/explore/profiling.md):
  <!-- -->
  Gain deeper insight than traditional tracing without custom instrumentation, letting you discover slow-to-execute or resource-intensive functions in your app.
* [**Session Replay**](https://docs.sentry.io/product/explore/session-replay/web.md):
  <!-- -->
  Get to the root cause of an issue faster by viewing a video-like reproduction of what was happening in the user's browser before, during, and after the problem.
* [**Logs**](https://docs.sentry.io/product/explore/logs.md):
  <!-- -->
  Centralize and analyze your application logs to correlate them with errors and performance issues. Search, filter, and visualize log data to understand what's happening in your applications.
* [**User Feedback**](https://docs.sentry.io/product/user-feedback.md):
  <!-- -->
  Collect feedback directly from users when they encounter errors, allowing them to describe what happened and provide context that helps you understand and resolve issues faster.

### [Install the Sentry SDK](https://docs.sentry.io/platforms/javascript/guides/react-router/manual-setup.md#install-the-sentry-sdk)

Run the command for your preferred package manager to add the SDK package to your application:

**npm**

```bash
npm install @sentry/react-router @sentry/profiling-node
```

**yarn**

```bash
yarn add @sentry/react-router @sentry/profiling-node
```

**pnpm**

```bash
pnpm add @sentry/react-router @sentry/profiling-node
```

**npm**

```bash
npm install @sentry/react-router
```

**yarn**

```bash
yarn add @sentry/react-router
```

**pnpm**

```bash
pnpm add @sentry/react-router
```

## [Configure](https://docs.sentry.io/platforms/javascript/guides/react-router/manual-setup.md#configure)

### [Expose Entry Point Files](https://docs.sentry.io/platforms/javascript/guides/react-router/manual-setup.md#expose-entry-point-files)

Before configuring Sentry, you need to make React Router's entry files (`entry.client.tsx` and `entry.server.tsx`) visible in your project. Run this command to expose them:

**bash**

```bash
npx react-router reveal
```

### [Configure Client-Side Sentry](https://docs.sentry.io/platforms/javascript/guides/react-router/manual-setup.md#configure-client-side-sentry)

Initialize Sentry in your `entry.client.tsx` file.

The `sentryOnError` handler integrates with React Router's [`onError` hook](https://reactrouter.com/how-to/error-reporting) to automatically capture and report client-side errors to Sentry.

**\[tsx] entry.client.tsx**

```tsx
+import * as Sentry from "@sentry/react-router";
 import { startTransition, StrictMode } from "react";
 import { hydrateRoot } from "react-dom/client";
 import { HydratedRouter } from "react-router/dom";

+Sentry.init({
+  dsn: "___PUBLIC_DSN___",
+
+  // Adds request headers and IP for users, for more info visit:
+  // https://docs.sentry.io/platforms/javascript/guides/react-router/configuration/options/#sendDefaultPii
+  sendDefaultPii: true,
+
+  integrations: [
+    // ___PRODUCT_OPTION_START___ performance
+    // Registers and configures the Tracing integration,
+    // which automatically instruments your application to monitor its
+    // performance, including custom React Router routing instrumentation
+    Sentry.reactRouterTracingIntegration(),
+    // ___PRODUCT_OPTION_END___ performance
+    // ___PRODUCT_OPTION_START___ session-replay
+    // Registers the Replay integration,
+    // which automatically captures Session Replays
+    Sentry.replayIntegration(),
+    // ___PRODUCT_OPTION_END___ session-replay
+    // ___PRODUCT_OPTION_START___ user-feedback
+    Sentry.feedbackIntegration({
+      // Additional SDK configuration goes in here, for example:
+      colorScheme: "system",
+    }),
+    // ___PRODUCT_OPTION_END___ user-feedback
+  ],
+  // ___PRODUCT_OPTION_START___ logs
+
+  // Enable logs to be sent to Sentry
+  enableLogs: true,
+  // ___PRODUCT_OPTION_END___ logs
+  // ___PRODUCT_OPTION_START___ performance
+
+  // Set tracesSampleRate to 1.0 to capture 100%
+  // of transactions for tracing.
+  // We recommend adjusting this value in production
+  // Learn more at
+  // https://docs.sentry.io/platforms/javascript/guides/react-router/configuration/options/#traces-sample-rate
+  tracesSampleRate: 1.0,
+
+  // Set `tracePropagationTargets` to declare which URL(s) should have trace propagation enabled
+  tracePropagationTargets: [/^\//, /^https:\/\/yourserver\.io\/api/],
+  // ___PRODUCT_OPTION_END___ performance
+  // ___PRODUCT_OPTION_START___ session-replay
+
+  // Capture Replay for 10% of all sessions,
+  // plus 100% of sessions with an error
+  // Learn more at
+  // https://docs.sentry.io/platforms/javascript/guides/react-router/session-replay/configuration/#general-integration-configuration
+  replaysSessionSampleRate: 0.1,
+  replaysOnErrorSampleRate: 1.0,
+  // ___PRODUCT_OPTION_END___ session-replay
+});

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter onError={Sentry.sentryOnError} />
    </StrictMode>
  );
});
```

### [Configure Server-Side Sentry](https://docs.sentry.io/platforms/javascript/guides/react-router/manual-setup.md#configure-server-side-sentry)

Limited Node support for auto-instrumentation

Automatic server-side instrumentation is currently only supported on:

* **Node 20:** Version <20.19
* **Node 22:** Version <22.12

If you're on a different version, you have two options:

1. **Recommended**: Use the [Instrumentation API](https://docs.sentry.io/platforms/javascript/guides/react-router/features/instrumentation-api.md) (React Router 7.9.5+) for automatic tracing without Node version restrictions
2. **Alternative**: Use our manual server wrappers (shown below)

For server loaders use `wrapServerLoader`:

**ts**

```ts
import * as Sentry from "@sentry/react-router";

export const loader = Sentry.wrapServerLoader(
  {
    name: "Load Some Data",
    description: "Loads some data from the db",
  },
  async ({ params }) => {
    // ... your loader logic
  }
);
```

For server actions use `wrapServerAction`:

**ts**

```ts
import * as Sentry from "@sentry/react-router";

export const action = Sentry.wrapServerAction(
  {
    name: "Submit Form Data",
    description: "Processes form submission data",
  },
  async ({ request }) => {
    // ... your action logic
  }
);
```

First, create a file called `instrument.server.mjs` in the root of your project to initialize Sentry:

**\[js] instrument.server.mjs**

```js
import * as Sentry from "@sentry/react-router";
// ___PRODUCT_OPTION_START___ profiling
import { nodeProfilingIntegration } from "@sentry/profiling-node";
// ___PRODUCT_OPTION_END___ profiling

Sentry.init({
  dsn: "___PUBLIC_DSN___",

  // Adds request headers and IP for users, for more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/react-router/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
  // ___PRODUCT_OPTION_START___ logs

  // Enable logs to be sent to Sentry
  enableLogs: true,
  // ___PRODUCT_OPTION_END___ logs
  // ___PRODUCT_OPTION_START___ profiling

  // Add our Profiling integration
  integrations: [nodeProfilingIntegration()],
  // ___PRODUCT_OPTION_END___ profiling
  // ___PRODUCT_OPTION_START___ performance
  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for tracing.
  // We recommend adjusting this value in production
  // Learn more at
  // https://docs.sentry.io/platforms/javascript/guides/react-router/configuration/options/#tracesSampleRate
  tracesSampleRate: 1.0,
  // ___PRODUCT_OPTION_END___ performance
  // ___PRODUCT_OPTION_START___ profiling
  // Enable profiling for a percentage of sessions
  // Learn more at
  // https://docs.sentry.io/platforms/javascript/configuration/options/#profileSessionSampleRate
  profileSessionSampleRate: 1.0,
  // ___PRODUCT_OPTION_END___ profiling
});
```

Next, replace the default `handleRequest` and `handleError` functions in your `entry.server.tsx` file with Sentry's wrapped versions:

**\[tsx] entry.server.tsx**

```tsx
+import * as Sentry from '@sentry/react-router';
 import { createReadableStreamFromReadable } from '@react-router/node';
 import { renderToPipeableStream } from 'react-dom/server';
 import { ServerRouter } from 'react-router';
 import { type HandleErrorFunction } from 'react-router';

+const handleRequest = Sentry.createSentryHandleRequest({
+  ServerRouter,
+  renderToPipeableStream,
+  createReadableStreamFromReadable,
+});

 export default handleRequest;

+export const handleError = Sentry.createSentryHandleError({
+  logErrors: false
+});

// ... rest of your server entry
```

Do you need to customize your handleRequest function?

If you need to customize the logic of your `handleRequest` function, you'll need to use Sentry's helper functions (`getMetaTagTransformer` and `wrapSentryHandleRequest`) manually:

**tsx**

```tsx
import {
  getMetaTagTransformer,
  wrapSentryHandleRequest,
} from "@sentry/react-router";
// ... other imports

const handleRequest = function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const userAgent = request.headers.get("user-agent");

    // Determine if we should use onAllReady or onShellReady
    const isBot =
      typeof userAgent === "string" && botRegex.test(userAgent);
    const isSpaMode = !!(routerContext as { isSpaMode?: boolean })
      .isSpaMode;

    const readyOption = isBot || isSpaMode ? "onAllReady" : "onShellReady";

    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        [readyOption]() {
          shellRendered = true;
          const body = new PassThrough();

          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );

          // this enables distributed tracing between client and server
          pipe(getMetaTagTransformer(body));
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          // eslint-disable-next-line no-param-reassign
          responseStatusCode = 500;
          // Log streaming rendering errors from inside the shell.  Don't log
          // errors encountered during initial shell rendering since they'll
          // reject and get logged in handleDocumentRequest.
          if (shellRendered) {
            // eslint-disable-next-line no-console
            console.error(error);
          }
        },
      },
    );

    // Abort the rendering stream after the `streamTimeout`
    setTimeout(abort, streamTimeout);
  });
};

// wrap the default export
export default wrapSentryHandleRequest(handleRequest);

// ... rest of your entry.server.ts file
```

Do you need to customize your handleError function?

If you have custom logic in your `handleError` function, you'll need to capture errors manually:

**tsx**

```tsx
import {
  getMetaTagTransformer,
  wrapSentryHandleRequest,
} from "@sentry/react-router";
// ... other imports

export function handleError(
  error: unknown,
  { request, params, context }: LoaderFunctionArgs | ActionFunctionArgs,
) {
  if (!request.signal.aborted) {
    Sentry.captureException(error);
    console.error(formatErrorForJsonLogging(error));
  }
}

// ... rest of your entry.server.ts file
```

#### [Load Instrumentation on Startup](https://docs.sentry.io/platforms/javascript/guides/react-router/manual-setup.md#load-instrumentation-on-startup)

React Router runs in ESM mode, which means you need to load the Sentry instrumentation file before the application starts. Update your `package.json` scripts:

**\[json] package.json**

```json
"scripts": {
  "dev": "NODE_OPTIONS='--import ./instrument.server.mjs' react-router dev",
  "start": "NODE_OPTIONS='--import ./instrument.server.mjs' react-router-serve ./build/server/index.js",
}
```

Are you using Windows?

If you're on Windows, set the `NODE_OPTIONS` environment variable manually before running your app.

**cmd**

```bash
set NODE_OPTIONS=--import ./instrument.server.mjs
```

**PowerShell**

```powershell
$env:NODE_OPTIONS="--import ./instrument.server.mjs"
```

Read more about [environment variables](https://learn.microsoft.com/en-us/windows/win32/procthread/environment-variables).

**Deploying to Vercel, Netlify, and similar platforms**

If you're deploying to platforms where you can't set the `NODE_OPTIONS` flag, import the instrumentation file directly at the top of your `entry.server.tsx`:

**\[tsx] entry.server.tsx**

```tsx
+import './instrument.server';
 import * as Sentry from '@sentry/react-router';
 import { createReadableStreamFromReadable } from '@react-router/node';
 import { renderToPipeableStream } from 'react-dom/server';
 // ... rest of your imports
```

##### Incomplete Auto-instrumentation

When you import the instrumentation file directly instead of using the `--import` flag, automatic instrumentation will be incomplete. You'll miss automatically captured spans and traces for some server-side operations. Only use this approach when the `NODE_OPTIONS` method isn't available.

### [Add Readable Stack Traces With Source Maps (Optional)](https://docs.sentry.io/platforms/javascript/guides/react-router/manual-setup.md#add-readable-stack-traces-with-source-maps-optional)

The stack traces in your Sentry errors probably won't look like your actual code without unminifying them. To fix this, upload your source maps to Sentry.

First, update `vite.config.ts` to include the `sentryReactRouter` plugin, making sure to pass both the Vite and Sentry configurations to it:

**\[typescript] vite.config.ts**

```typescript
import { reactRouter } from '@react-router/dev/vite';
import { sentryReactRouter, type SentryReactRouterBuildOptions } from '@sentry/react-router';
import { defineConfig } from 'vite';

const sentryConfig: SentryReactRouterBuildOptions = {
  org: "___ORG_SLUG___",
  project: "___PROJECT_SLUG___",

  // An auth token is required for uploading source maps;
  // store it in an environment variable to keep it secure.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // ...
};

export default defineConfig(config => {
  return {
+   plugins: [reactRouter(),sentryReactRouter(sentryConfig, config)],
  };
});
```

To keep your auth token secure, always store it in an environment variable instead of directly in your files:

**\[bash] .env**

```bash
SENTRY_AUTH_TOKEN=___ORG_AUTH_TOKEN___
```

Using environment variables in Vite configs

Vite doesn't automatically load `.env` files into `process.env` when evaluating the config file. If you store your auth token in a `.env` file and want to access it via `process.env.SENTRY_AUTH_TOKEN`, use Vite's [`loadEnv`](https://vite.dev/guide/api-javascript#loadenv) helper.

Alternatively, use a `.env.sentry-build-plugin` file, which the Sentry plugin reads automatically.

**\[javascript] vite.config.js**

```javascript
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      sentryVitePlugin({
        authToken: env.SENTRY_AUTH_TOKEN,
        // ...
      }),
    ],
  };
});
```

Next, include the `sentryOnBuildEnd` hook in `react-router.config.ts`:

**\[typescript] react-router.config.ts**

```typescript
import type { Config } from "@react-router/dev/config";
import { sentryOnBuildEnd } from "@sentry/react-router";

export default {
  ssr: true,
  buildEnd: async ({ viteConfig, reactRouterConfig, buildManifest }) => {
    // ...
    // Call this at the end of the hook
    +(await sentryOnBuildEnd({ viteConfig, reactRouterConfig, buildManifest }));
  },
} satisfies Config;
```

### [Avoid Ad Blockers With Tunneling (Optional)](https://docs.sentry.io/platforms/javascript/guides/react-router/manual-setup.md#avoid-ad-blockers-with-tunneling-optional)

You can prevent ad blockers from blocking Sentry events using tunneling. Use the `tunnel` option in `Sentry.init` to add an API endpoint in your application that forwards Sentry events to Sentry servers.

This will send all events to the `tunnel` endpoint. However, the events need to be parsed and redirected to Sentry, so you'll need to do additional configuration on the server. You can find a detailed explanation on how to do this on our [Troubleshooting page](https://docs.sentry.io/platforms/javascript/guides/react-router/troubleshooting.md#using-the-tunnel-option).

**javascript**

```javascript
Sentry.init({
  dsn: "___PUBLIC_DSN___",
  tunnel: "/tunnel",
});
```

## [Verify Your Setup](https://docs.sentry.io/platforms/javascript/guides/react-router/manual-setup.md#verify-your-setup)

Let's test your setup and confirm that Sentry is working correctly and sending data to your Sentry project.

### [Issues](https://docs.sentry.io/platforms/javascript/guides/react-router/manual-setup.md#issues)

To verify that Sentry captures errors and creates issues in your Sentry project, throw an error in a loader.

Then, open the route in your browser and you should trigger an error.

##### Important

Errors triggered from within your browser's developer tools (like the browser console) are sandboxed, so they will not trigger Sentry's error monitoring.

**\[tsx] error.tsx**

```tsx
import type { Route } from "./+types/example-page";

export async function loader() {
  throw new Error("My first Sentry error!");
}

export default function ExamplePage() {
  return <div>Loading this page will throw an error</div>;
}
```

### [Tracing](https://docs.sentry.io/platforms/javascript/guides/react-router/manual-setup.md#tracing)

To test your tracing configuration, update the previous code snippet by starting a trace to measure the time it takes for the execution of your code.

Then, open the route in your browser. You should start a trace and trigger an error.

**\[tsx] error.tsx**

```tsx
import * as Sentry from "@sentry/react-router";
import type { Route } from "./+types/example-page";

export async function loader() {
  return Sentry.startSpan(
    {
      op: "test",
      name: "My First Test Transaction",
    },
    () => {
      throw new Error("My first Sentry error!");
    },
  );
}

export default function ExamplePage() {
  return <div>Loading this page will throw an error</div>;
}
```

### [Logs NEW](https://docs.sentry.io/platforms/javascript/guides/react-router/manual-setup.md#logs-)

To verify that Sentry catches your logs, add some log statements to your application:

**javascript**

```javascript
Sentry.logger.info("User example action completed");

Sentry.logger.warn("Slow operation detected", {
  operation: "data_fetch",
  duration: 3500,
});

Sentry.logger.error("Validation failed", {
  field: "email",
  reason: "Invalid email",
});
```

### [View Captured Data in Sentry](https://docs.sentry.io/platforms/javascript/guides/react-router/manual-setup.md#view-captured-data-in-sentry)

Now, head over to your project on [Sentry.io](https://sentry.io) to view the collected data (it takes a couple of moments for the data to appear).

Need help locating the captured errors in your Sentry project?

* Open the
  <!-- -->
  [**Issues**](https://sentry.io/orgredirect/organizations/:orgslug/issues/)
  <!-- -->
  page and select an error from the issues list to view the full details and context of this error. For more details, see this
  <!-- -->
  [interactive walkthrough](https://docs.sentry.io/product/sentry-basics/integrate-frontend/generate-first-error.md#ui-walkthrough).
* Open the
  <!-- -->
  [**Traces**](https://sentry.io/orgredirect/organizations/:orgslug/explore/traces/)
  <!-- -->
  page and select a trace to reveal more information about each span, its duration, and any errors. For an interactive UI walkthrough, click
  <!-- -->
  [here](https://docs.sentry.io/product/sentry-basics/distributed-tracing/generate-first-error.md#ui-walkthrough).
* Open the
  <!-- -->
  [**Profiles**](https://sentry.io/orgredirect/organizations/:orgslug/profiling/)
  <!-- -->
  page, select a transaction, and then a profile ID to view its flame graph. For more information, click
  <!-- -->
  [here](https://docs.sentry.io/product/explore/profiling/profile-details.md).
* Open the
  <!-- -->
  [**Replays**](https://sentry.io/orgredirect/organizations/:orgslug/replays/)
  <!-- -->
  page and select an entry from the list to get a detailed view where you can replay the interaction and get more information to help you troubleshoot.
* Open the
  <!-- -->
  [**Logs**](https://sentry.io/orgredirect/organizations/:orgslug/explore/logs/)
  <!-- -->
  page and filter by service, environment, or search keywords to view log entries from your application. For an interactive UI walkthrough, click
  <!-- -->
  [here](https://docs.sentry.io/product/explore/logs.md#overview).
* Open the
  <!-- -->
  [**User Feedback**](https://sentry.io/orgredirect/organizations/:orgslug/feedback/)
  <!-- -->
  page and click on individual feedback to see more details all in one view. For more information, click [here](https://docs.sentry.io/product/user-feedback.md).

## [Next Steps](https://docs.sentry.io/platforms/javascript/guides/react-router/manual-setup.md#next-steps)

At this point, you should have integrated Sentry into your React Router Framework application and should already be sending data to your Sentry project.

Now's a good time to customize your setup and look into more advanced topics. Our next recommended steps for you are:

* Explore [practical guides](https://docs.sentry.io/guides.md) on what to monitor, log, track, and investigate after setup
* Learn how to [manually capture errors](https://docs.sentry.io/platforms/javascript/guides/react-router/usage.md)
* Continue to [customize your configuration](https://docs.sentry.io/platforms/javascript/guides/react-router/configuration.md)
* Get familiar with [Sentry's product features](https://docs.sentry.io/product.md) like tracing, insights, and alerts

Are you having problems setting up the SDK?

* Find various topics in [Troubleshooting](https://docs.sentry.io/platforms/javascript/guides/react-router/troubleshooting.md)
* [Get support](https://www.sentry.help/en/)
