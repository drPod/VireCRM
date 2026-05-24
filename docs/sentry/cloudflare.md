---
title: "Cloudflare"
description: "Learn how to manually set up Sentry for Cloudflare Workers and Cloudflare Pages and capture your first errors."
url: https://docs.sentry.io/platforms/javascript/guides/cloudflare/
---

# Cloudflare | Sentry for Cloudflare

Use this guide for general instructions on using the Sentry SDK with Cloudflare. If you're using any of the listed frameworks, follow their specific setup instructions:

* **[Astro](https://docs.sentry.io/platforms/javascript/guides/cloudflare/frameworks/astro.md)**
* **[Hono](https://docs.sentry.io/platforms/javascript/guides/hono.md)** (with @sentry/hono)
* **[Hydrogen](https://docs.sentry.io/platforms/javascript/guides/cloudflare/frameworks/hydrogen-react-router.md)**
* **[Next.js](https://docs.sentry.io/platforms/javascript/guides/cloudflare/frameworks/nextjs.md)**
* **[Nuxt](https://docs.sentry.io/platforms/javascript/guides/cloudflare/frameworks/nuxt.md)**
* **[Remix](https://docs.sentry.io/platforms/javascript/guides/cloudflare/frameworks/remix.md)**
* **[SvelteKit](https://docs.sentry.io/platforms/javascript/guides/cloudflare/frameworks/sveltekit.md)**
* **[TanStack Start](https://docs.sentry.io/platforms/javascript/guides/cloudflare/frameworks/tanstack-start.md)**

##### Cloudflare Workers limitations

The Cloudflare Workers runtime has some platform-specific limitations that affect tracing. See [Known Limitations](https://docs.sentry.io/platforms/javascript/guides/cloudflare.md#known-limitations) for details.

## [Prerequisites](https://docs.sentry.io/platforms/javascript/guides/cloudflare.md#prerequisites)

You need:

* A Sentry [account](https://sentry.io/signup/) and [project](https://docs.sentry.io/product/projects.md)
* Your application up and running

## [Install](https://docs.sentry.io/platforms/javascript/guides/cloudflare.md#install)

Choose the features you want to configure, and this guide will show you how:

Error Monitoring\[ ]Tracing\[ ]Logs

Want to learn more about these features?

* [**Issues**](https://docs.sentry.io/product/issues.md) (always enabled)
  <!-- -->
  :
  <!-- -->
  Sentry's core error monitoring product that automatically reports errors, uncaught exceptions, and unhandled rejections. If you have something that looks like an exception, Sentry can capture it.
* [**Tracing**](https://docs.sentry.io/product/tracing.md):
  <!-- -->
  Track software performance while seeing the impact of errors across multiple systems. For example, distributed tracing allows you to follow a request from the frontend to the backend and back.
* [**Logs**](https://docs.sentry.io/product/explore/logs.md):
  <!-- -->
  Centralize and analyze your application logs to correlate them with errors and performance issues. Search, filter, and visualize log data to understand what's happening in your applications.

### [Install the Sentry SDK](https://docs.sentry.io/platforms/javascript/guides/cloudflare.md#install-the-sentry-sdk)

Run the command for your preferred package manager to add the Sentry SDK to your application:

**npm**

```bash
npm install @sentry/cloudflare --save
```

**yarn**

```bash
yarn add @sentry/cloudflare
```

**pnpm**

```bash
pnpm add @sentry/cloudflare
```

## [Configure](https://docs.sentry.io/platforms/javascript/guides/cloudflare.md#configure)

The main Sentry configuration should happen as early as possible in your app's lifecycle.

### [Wrangler Configuration](https://docs.sentry.io/platforms/javascript/guides/cloudflare.md#wrangler-configuration)

Since the SDK needs access to the `AsyncLocalStorage` API, you need to set the `nodejs_compat` compatibility flag in your `wrangler.(jsonc|toml)` configuration file:

**\[JSON] wrangler.jsonc**

```jsonc
{
  "compatibility_flags": ["nodejs_compat"],
}
```

**\[Toml] wrangler.toml**

```toml
compatibility_flags = ["nodejs_compat"]
```

### [Release Configuration (Optional)](https://docs.sentry.io/platforms/javascript/guides/cloudflare.md#release-configuration-optional)

If you don't set the `release` option manually, the SDK automatically detects it from these sources (in order of priority):

1. The `SENTRY_RELEASE` environment variable
2. The `CF_VERSION_METADATA.id` binding (if configured)

To enable automatic release detection via Cloudflare's version metadata, add the `CF_VERSION_METADATA` binding in your wrangler configuration. This provides access to the [Cloudflare version metadata](https://developers.cloudflare.com/workers/runtime-apis/bindings/version-metadata/).

**\[JSON] wrangler.jsonc**

```jsonc
{
  // ...
  "version_metadata": {
    "binding": "CF_VERSION_METADATA",
  },
}
```

**\[Toml] wrangler.toml**

```toml
[version_metadata]
binding = "CF_VERSION_METADATA"
```

Using an SDK version before 10.35.0?

In earlier versions, you need to manually extract `CF_VERSION_METADATA.id` and pass it as the `release` option:

**javascript**

```javascript
Sentry.withSentry(
  (env) => ({
    dsn: "___PUBLIC_DSN___",
    release: env.CF_VERSION_METADATA?.id,
  }),
  // ...
);
```

### [Setup for Cloudflare Workers](https://docs.sentry.io/platforms/javascript/guides/cloudflare.md#setup-for-cloudflare-workers)

Wrap your worker handler with the `withSentry` function, for example, in your `index.ts` file, to initialize the Sentry SDK and hook into the environment:

**\[typescript] index.ts**

```typescript
import * as Sentry from "@sentry/cloudflare";

export default Sentry.withSentry(
  (env: Env) => ({
    dsn: "___PUBLIC_DSN___",

    // Adds request headers and IP for users, for more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/cloudflare/configuration/options/#sendDefaultPii
    sendDefaultPii: true,
    // ___PRODUCT_OPTION_START___ logs

    // Enable logs to be sent to Sentry
    enableLogs: true,
    // ___PRODUCT_OPTION_END___ logs
    // ___PRODUCT_OPTION_START___ performance

    // Set tracesSampleRate to 1.0 to capture 100% of spans for tracing.
    // Learn more at
    // https://docs.sentry.io/platforms/javascript/guides/cloudflare/configuration/options/#tracesSampleRate
    tracesSampleRate: 1.0,
    // ___PRODUCT_OPTION_END___ performance
  }),
  {
    async fetch(request, env, ctx) {
      // Your worker logic here
      return new Response("Hello World!");
    },
  },
);
```

### [Setup for Cloudflare Pages](https://docs.sentry.io/platforms/javascript/guides/cloudflare.md#setup-for-cloudflare-pages)

To use the Sentry SDK, add the `sentryPagesPlugin` as [middleware to your Cloudflare Pages application](https://developers.cloudflare.com/pages/functions/middleware/).

Create a `_middleware.js` file in your [`functions` directory](https://developers.cloudflare.com/pages/functions/) (Cloudflare Pages [middleware](https://developers.cloudflare.com/pages/functions/middleware/)). Create the directory in the root of your project if it doesn't already exist, then create the file and import and initialize the Sentry Cloudflare SDK:

**\[javascript] functions/\_middleware.js**

```javascript
import * as Sentry from "@sentry/cloudflare";

export const onRequest = [
  // Make sure Sentry is the first middleware
  Sentry.sentryPagesPlugin((context) => ({
    dsn: "___PUBLIC_DSN___",

    // Adds request headers and IP for users, for more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/cloudflare/configuration/options/#sendDefaultPii
    sendDefaultPii: true,
    // ___PRODUCT_OPTION_START___ logs

    // Enable logs to be sent to Sentry
    enableLogs: true,
    // ___PRODUCT_OPTION_END___ logs
    // ___PRODUCT_OPTION_START___ performance

    // Set tracesSampleRate to 1.0 to capture 100% of spans for tracing.
    // Learn more at
    // https://docs.sentry.io/platforms/javascript/guides/cloudflare/configuration/options/#tracesSampleRate
    tracesSampleRate: 1.0,
    // ___PRODUCT_OPTION_END___ performance
  })),
  // Add more middlewares here
];
```

Don't have access to onRequest?

If you don't have access to the `onRequest` middleware API, you can use the `wrapRequestHandler` API instead. For example:

**javascript**

```javascript
// hooks.server.js
import * as Sentry from "@sentry/cloudflare";

export const handle = ({ event, resolve }) => {
  const requestHandlerOptions = {
    options: {
      dsn: event.platform.env.SENTRY_DSN,
      tracesSampleRate: 1.0,
    },
    request: event.request,
    context: event.platform.ctx,
  };
  return Sentry.wrapRequestHandler(requestHandlerOptions, () =>
    resolve(event),
  );
};
```

### [Add Readable Stack Traces With Source Maps (Optional)](https://docs.sentry.io/platforms/javascript/guides/cloudflare.md#add-readable-stack-traces-with-source-maps-optional)

The stack traces in your Sentry errors probably won't look like your actual code without unminifying them. To fix this, upload your [source maps](https://docs.sentry.io/platforms/javascript/guides/cloudflare/sourcemaps.md) to Sentry.

First, set the `upload_source_maps` option to `true` in your `wrangler.(jsonc|toml)` config file to enable source map uploading:

**\[JSON] wrangler.jsonc**

```jsonc
{
  "upload_source_maps": true,
}
```

**\[Toml] wrangler.toml**

```toml
upload_source_maps = true
```

Next, run the Sentry Wizard to finish your setup:

**bash**

```bash
npx @sentry/wizard@latest -i sourcemaps
```

## [Verify Your Setup](https://docs.sentry.io/platforms/javascript/guides/cloudflare.md#verify-your-setup)

Let's test your setup and confirm that Sentry is working correctly and sending data to your Sentry project.

### [Issues](https://docs.sentry.io/platforms/javascript/guides/cloudflare.md#issues)

First, let's make sure Sentry is correctly capturing errors and creating issues in your project.

#### [Cloudflare Workers](https://docs.sentry.io/platforms/javascript/guides/cloudflare.md#cloudflare-workers)

Add the following code snippet to your main worker file to create a `/debug-sentry` route that triggers an error when called:

**\[javascript] index.js**

```javascript
export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/debug-sentry") {
      throw new Error("My first Sentry error!");
    }

    // Your existing routes and logic here...
    return new Response("...");
  },
};
```

#### [Cloudflare Pages](https://docs.sentry.io/platforms/javascript/guides/cloudflare.md#cloudflare-pages)

Create a new route that throws an error when called by adding the following code snippet to a file in your `functions` directory, such as `functions/debug-sentry.js`:

**\[javascript] debug-sentry.js**

```javascript
export async function onRequest(context) {
  throw new Error("My first Sentry error!");
}
```

### [Tracing](https://docs.sentry.io/platforms/javascript/guides/cloudflare.md#tracing)

To test your tracing configuration, update the previous code snippet by starting a trace to measure the time it takes to run your code.

#### [Cloudflare Workers](https://docs.sentry.io/platforms/javascript/guides/cloudflare.md#cloudflare-workers-1)

**\[javascript] index.js**

```javascript
export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/debug-sentry") {
      await Sentry.startSpan(
        {
          op: "test",
          name: "My First Test Transaction",
        },
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for 100ms
          throw new Error("My first Sentry error!");
        },
      );
    }

    // Your existing routes and logic here...
    return new Response("...");
  },
};
```

#### [Cloudflare Pages](https://docs.sentry.io/platforms/javascript/guides/cloudflare.md#cloudflare-pages-1)

**\[javascript] debug-sentry.js**

```javascript
export async function onRequest(context) {
  await Sentry.startSpan(
    {
      op: "test",
      name: "My First Test Transaction",
    },
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for 100ms
      throw new Error("My first Sentry error!");
    },
  );
}
```

### [Logs NEW](https://docs.sentry.io/platforms/javascript/guides/cloudflare.md#logs-)

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

### [View Captured Data in Sentry](https://docs.sentry.io/platforms/javascript/guides/cloudflare.md#view-captured-data-in-sentry)

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
  [**Logs**](https://sentry.io/orgredirect/organizations/:orgslug/explore/logs/)
  <!-- -->
  page and filter by service, environment, or search keywords to view log entries from your application. For an interactive UI walkthrough, click
  <!-- -->
  [here](https://docs.sentry.io/product/explore/logs.md#overview).

## [Known Limitations](https://docs.sentry.io/platforms/javascript/guides/cloudflare.md#known-limitations)

### [Span Durations](https://docs.sentry.io/platforms/javascript/guides/cloudflare.md#span-durations)

Server-side spans will display `0ms` for their durations. In the Cloudflare Workers runtime, `performance.now()` and `Date.now()` only advance after I/O occurs. CPU-bound operations will show zero duration. This is a security measure Cloudflare implements to [mitigate against timing attacks](https://developers.cloudflare.com/workers/runtime-apis/performance/).

This is expected behavior in the Cloudflare Workers environment and affects all frameworks deployed to Cloudflare Workers, including Next.js, Astro, Remix, and others.

### [Missing Spans in `waitUntil()`](https://docs.sentry.io/platforms/javascript/guides/cloudflare.md#missing-spans-in-waituntil)

If you're using Cloudflare's [`waitUntil()`](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/#contextwaituntil) to run background tasks, spans created inside `waitUntil()` may not appear in Sentry because the request's root span has already finished before the background work starts.

To capture spans inside `waitUntil()`, wrap your deferred work with `startSpan` and set `forceTransaction: true`. This creates a separate transaction for the background work.

The `forceTransaction: true` option is required because it creates a separate transaction for the `waitUntil()` work. Without it, spans created after the request ends might get lost.

**\[javascript] index.js**

```javascript
import * as Sentry from "@sentry/cloudflare";

export default {
  async fetch(request, env, ctx) {
    // Main request handling
    const response = processRequest(request);

    // Background work with proper tracing
    ctx.waitUntil(
      Sentry.startSpan(
        { name: "background.task", op: "task", forceTransaction: true },
        () => updateCacheAndDatabase(),
      ),
    );

    return response;
  },
};

async function updateCacheAndDatabase() {
  // Database operations
  // Any spans created here will be captured
}
```

## [Next Steps](https://docs.sentry.io/platforms/javascript/guides/cloudflare.md#next-steps)

At this point, you should have integrated Sentry and should already be sending data to your Sentry project.

Now's a good time to customize your setup and look into more advanced topics. Our next recommended steps for you are:

* Explore [practical guides](https://docs.sentry.io/guides.md) on what to monitor, log, track, and investigate after setup
* Learn how to [manually capture errors](https://docs.sentry.io/platforms/javascript/guides/cloudflare/usage.md)
* Continue to [customize your configuration](https://docs.sentry.io/platforms/javascript/guides/cloudflare/configuration.md)
* Make use of [Cloudflare-specific features](https://docs.sentry.io/platforms/javascript/guides/cloudflare/features.md)
* Get familiar with [Sentry's product features](https://docs.sentry.io/product.md) like tracing, insights, and alerts

Are you having problems setting up the SDK?

* Check out setup instructions for popular [frameworks on Cloudflare](https://docs.sentry.io/platforms/javascript/guides/cloudflare/frameworks.md)
* Find various support topics in [troubleshooting](https://docs.sentry.io/platforms/javascript/guides/cloudflare/troubleshooting.md)
* [Get support](https://www.sentry.help/en/)

## Other JavaScript Frameworks

- [Angular](https://docs.sentry.io/platforms/javascript/guides/angular.md)
- [Astro](https://docs.sentry.io/platforms/javascript/guides/astro.md)
- [AWS Lambda](https://docs.sentry.io/platforms/javascript/guides/aws-lambda.md)
- [Azure Functions](https://docs.sentry.io/platforms/javascript/guides/azure-functions.md)
- [Bun](https://docs.sentry.io/platforms/javascript/guides/bun.md)
- [Capacitor](https://docs.sentry.io/platforms/javascript/guides/capacitor.md)
- [Cloud Functions for Firebase](https://docs.sentry.io/platforms/javascript/guides/firebase.md)
- [Connect](https://docs.sentry.io/platforms/javascript/guides/connect.md)
- [Cordova](https://docs.sentry.io/platforms/javascript/guides/cordova.md)
- [Deno](https://docs.sentry.io/platforms/javascript/guides/deno.md)
- [Effect](https://docs.sentry.io/platforms/javascript/guides/effect.md)
- [Electron](https://docs.sentry.io/platforms/javascript/guides/electron.md)
- [Elysia](https://docs.sentry.io/platforms/javascript/guides/elysia.md)
- [Ember](https://docs.sentry.io/platforms/javascript/guides/ember.md)
- [Express](https://docs.sentry.io/platforms/javascript/guides/express.md)
- [Fastify](https://docs.sentry.io/platforms/javascript/guides/fastify.md)
- [Gatsby](https://docs.sentry.io/platforms/javascript/guides/gatsby.md)
- [Google Cloud Functions](https://docs.sentry.io/platforms/javascript/guides/gcp-functions.md)
- [Hapi](https://docs.sentry.io/platforms/javascript/guides/hapi.md)
- [Hono](https://docs.sentry.io/platforms/javascript/guides/hono.md)
- [Koa](https://docs.sentry.io/platforms/javascript/guides/koa.md)
- [Nest.js](https://docs.sentry.io/platforms/javascript/guides/nestjs.md)
- [Next.js](https://docs.sentry.io/platforms/javascript/guides/nextjs.md)
- [Nitro](https://docs.sentry.io/platforms/javascript/guides/nitro.md)
- [Node.js](https://docs.sentry.io/platforms/javascript/guides/node.md)
- [Nuxt](https://docs.sentry.io/platforms/javascript/guides/nuxt.md)
- [React](https://docs.sentry.io/platforms/javascript/guides/react.md)
- [React Router Framework](https://docs.sentry.io/platforms/javascript/guides/react-router.md)
- [Remix](https://docs.sentry.io/platforms/javascript/guides/remix.md)
- [Solid](https://docs.sentry.io/platforms/javascript/guides/solid.md)
- [SolidStart](https://docs.sentry.io/platforms/javascript/guides/solidstart.md)
- [Svelte](https://docs.sentry.io/platforms/javascript/guides/svelte.md)
- [SvelteKit](https://docs.sentry.io/platforms/javascript/guides/sveltekit.md)
- [TanStack Start React](https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react.md)
- [Vue](https://docs.sentry.io/platforms/javascript/guides/vue.md)
- [Wasm](https://docs.sentry.io/platforms/javascript/guides/wasm.md)

## Topics

- [Capturing Errors](https://docs.sentry.io/platforms/javascript/guides/cloudflare/usage.md)
- [Source Maps](https://docs.sentry.io/platforms/javascript/guides/cloudflare/sourcemaps.md)
- [Logs](https://docs.sentry.io/platforms/javascript/guides/cloudflare/logs.md)
- [Tracing](https://docs.sentry.io/platforms/javascript/guides/cloudflare/tracing.md)
- [AI Agent Monitoring](https://docs.sentry.io/platforms/javascript/guides/cloudflare/ai-agent-monitoring.md)
- [Application Metrics](https://docs.sentry.io/platforms/javascript/guides/cloudflare/metrics.md)
- [Crons](https://docs.sentry.io/platforms/javascript/guides/cloudflare/crons.md)
- [User Feedback](https://docs.sentry.io/platforms/javascript/guides/cloudflare/user-feedback.md)
- [Sampling](https://docs.sentry.io/platforms/javascript/guides/cloudflare/sampling.md)
- [Enriching Events](https://docs.sentry.io/platforms/javascript/guides/cloudflare/enriching-events.md)
- [Extended Configuration](https://docs.sentry.io/platforms/javascript/guides/cloudflare/configuration.md)
- [Feature Flags](https://docs.sentry.io/platforms/javascript/guides/cloudflare/feature-flags.md)
- [Data Management](https://docs.sentry.io/platforms/javascript/guides/cloudflare/data-management.md)
- [Security Policy Reporting](https://docs.sentry.io/platforms/javascript/guides/cloudflare/security-policy-reporting.md)
- [Special Use Cases](https://docs.sentry.io/platforms/javascript/guides/cloudflare/best-practices.md)
- [Migration Guide](https://docs.sentry.io/platforms/javascript/guides/cloudflare/migration.md)
- [Troubleshooting](https://docs.sentry.io/platforms/javascript/guides/cloudflare/troubleshooting.md)
- [Cloudflare Features](https://docs.sentry.io/platforms/javascript/guides/cloudflare/features.md)
- [Frameworks on Cloudflare](https://docs.sentry.io/platforms/javascript/guides/cloudflare/frameworks.md)
