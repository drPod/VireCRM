---
title: "React Router Framework"
description: "Learn how to set up and configure Sentry in your React Router v7 application using the installation wizard, capture your first errors, and view them in Sentry."
url: https://docs.sentry.io/platforms/javascript/guides/react-router/
---

# React Router Framework | Sentry for React Router Framework

##### Important

This SDK is currently in **beta**. Beta features are still in progress and may have bugs. Please reach out on [GitHub](https://github.com/getsentry/sentry-javascript/issues/new/choose) if you have any feedback or concerns.

##### Looking for data/declarative mode?

If you're using React Router in data or declarative mode, follow the instructions in our [React guide](https://docs.sentry.io/platforms/javascript/guides/react/features/react-router/v7.md).

## [Prerequisites](https://docs.sentry.io/platforms/javascript/guides/react-router.md#prerequisites)

You need:

* A Sentry [account](https://sentry.io/signup/) and [project](https://docs.sentry.io/product/projects.md)
* Your application up and running

## [Install](https://docs.sentry.io/platforms/javascript/guides/react-router.md#install)

To install Sentry using the installation wizard, run the command on the right within your project directory.

The wizard guides you through the setup process, asking you to enable additional (optional) Sentry features for your application beyond error monitoring.

**bash**

```bash
npx @sentry/wizard@latest -i reactRouter
```

This guide assumes that you enable all features and allow the wizard to create an example page and route. You can add or remove features at any time, but setting them up now will save you the effort of configuring them manually later.

What does the installation wizard change inside your application?

* Installs the `@sentry/react-router` package (and optionally `@sentry/profiling-node`)
* Reveals React Router entry point files (`entry.client.tsx` and `entry.server.tsx`) if not already visible
* Initializes Sentry in your client and server entry files with default configuration
* Creates `instrument.server.mjs` for server-side instrumentation
* Updates your `app/root.tsx` to capture errors in the error boundary
* Configures source map upload in `vite.config.ts` and `react-router.config.ts`
* Creates `.env.sentry-build-plugin` with an auth token to upload source maps (this file is automatically added to `.gitignore`)
* Creates example page and API route to help verify your Sentry setup

## [Configure](https://docs.sentry.io/platforms/javascript/guides/react-router.md#configure)

If you prefer to configure Sentry manually, here are the configuration files the wizard would create:

In addition to capturing errors, you can monitor interactions between multiple services or applications by [enabling tracing](https://docs.sentry.io/concepts/key-terms/tracing.md). You can also get to the root of an error or performance issue faster, by watching a video-like reproduction of a user session with [session replay](https://docs.sentry.io/product/explore/session-replay/web/getting-started.md).

Select which Sentry features you'd like to install in addition to Error Monitoring to get the corresponding installation and configuration instructions below.

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

### [Client-Side Configuration](https://docs.sentry.io/platforms/javascript/guides/react-router.md#client-side-configuration)

The wizard creates a client configuration file that initializes the Sentry SDK in your browser.

The configuration includes your DSN (Data Source Name), which connects your app to your Sentry project, and enables the features you selected during installation.

**\[Client] entry.client.tsx**

```tsx
import * as Sentry from "@sentry/react-router";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

Sentry.init({
  dsn: "___PUBLIC_DSN___",

  // Adds request headers and IP for users, for more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/react-router/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  integrations: [
    // ___PRODUCT_OPTION_START___ performance
    // Registers and configures the Tracing integration,
    // which automatically instruments your application to monitor its
    // performance, including custom React Router routing instrumentation
    Sentry.reactRouterTracingIntegration(),
    // ___PRODUCT_OPTION_END___ performance
    // ___PRODUCT_OPTION_START___ session-replay
    // Registers the Replay integration,
    // which automatically captures Session Replays
    Sentry.replayIntegration(),
    // ___PRODUCT_OPTION_END___ session-replay
    // ___PRODUCT_OPTION_START___ user-feedback
    Sentry.feedbackIntegration({
      // Additional SDK configuration goes in here, for example:
      colorScheme: "system",
    }),
    // ___PRODUCT_OPTION_END___ user-feedback
  ],
  // ___PRODUCT_OPTION_START___ logs

  // Enable logs to be sent to Sentry
  enableLogs: true,
  // ___PRODUCT_OPTION_END___ logs
  // ___PRODUCT_OPTION_START___ performance

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for tracing.
  // We recommend adjusting this value in production
  // Learn more at
  // https://docs.sentry.io/platforms/javascript/guides/react-router/configuration/options/#traces-sample-rate
  tracesSampleRate: 1.0,

  // Set `tracePropagationTargets` to declare which URL(s) should have trace propagation enabled
  tracePropagationTargets: [/^\//, /^https:\/\/yourserver\.io\/api/],
  // ___PRODUCT_OPTION_END___ performance
  // ___PRODUCT_OPTION_START___ session-replay

  // Capture Replay for 10% of all sessions,
  // plus 100% of sessions with an error
  // Learn more at
  // https://docs.sentry.io/platforms/javascript/guides/react-router/session-replay/configuration/#general-integration-configuration
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  // ___PRODUCT_OPTION_END___ session-replay
});

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
```

### [Server-Side Configuration](https://docs.sentry.io/platforms/javascript/guides/react-router.md#server-side-configuration)

The wizard also creates a server configuration file for Node.js runtime.

For more advanced configuration options or to set up Sentry manually, check out our [manual setup guide](https://docs.sentry.io/platforms/javascript/guides/react-router/manual-setup.md).

**\[Server] instrument.server.mjs**

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

## [Verify Your Setup](https://docs.sentry.io/platforms/javascript/guides/react-router.md#verify-your-setup)

If you haven't tested your Sentry configuration yet, let's do it now. You can confirm that Sentry is working properly and sending data to your Sentry project by using the example page created by the installation wizard:

1. Open the example page `/sentry-example-page` in your browser. For most React Router applications, this will be at localhost.
2. Observe the example page with a button that triggers test errors.

##### Important

Errors triggered from within your browser's developer tools (like the browser console) are sandboxed, so they will not trigger Sentry's error monitoring.

Clicking the button triggers an error that Sentry captures for you. The example also demonstrates how to test performance tracing.

##### Tip

Don't forget to explore the example files' code in your project to understand what's happening after your button click.

### [View Captured Data in Sentry](https://docs.sentry.io/platforms/javascript/guides/react-router.md#view-captured-data-in-sentry)

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

## [Next Steps](https://docs.sentry.io/platforms/javascript/guides/react-router.md#next-steps)

At this point, you should have integrated Sentry into your React Router Framework application and should already be sending data to your Sentry project.

Now's a good time to customize your setup and look into more advanced topics. Our next recommended steps for you are:

* Explore [practical guides](https://docs.sentry.io/guides.md) on what to monitor, log, track, and investigate after setup
* Learn how to [manually capture errors](https://docs.sentry.io/platforms/javascript/guides/react-router/usage.md)
* Continue to [customize your configuration](https://docs.sentry.io/platforms/javascript/guides/react-router/configuration.md)
* Get familiar with [Sentry's product features](https://docs.sentry.io/product.md) like tracing, insights, and alerts

Are you having problems setting up the SDK?

* If you encountered issues with our installation wizard, try [setting up Sentry manually](https://docs.sentry.io/platforms/javascript/guides/react-router/manual-setup.md)
* Find various topics in [Troubleshooting](https://docs.sentry.io/platforms/javascript/guides/react-router/troubleshooting.md)
* [Get support](https://www.sentry.help/en/)

## Other JavaScript Frameworks

- [Angular](https://docs.sentry.io/platforms/javascript/guides/angular.md)
- [Astro](https://docs.sentry.io/platforms/javascript/guides/astro.md)
- [AWS Lambda](https://docs.sentry.io/platforms/javascript/guides/aws-lambda.md)
- [Azure Functions](https://docs.sentry.io/platforms/javascript/guides/azure-functions.md)
- [Bun](https://docs.sentry.io/platforms/javascript/guides/bun.md)
- [Capacitor](https://docs.sentry.io/platforms/javascript/guides/capacitor.md)
- [Cloud Functions for Firebase](https://docs.sentry.io/platforms/javascript/guides/firebase.md)
- [Cloudflare](https://docs.sentry.io/platforms/javascript/guides/cloudflare.md)
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
- [Remix](https://docs.sentry.io/platforms/javascript/guides/remix.md)
- [Solid](https://docs.sentry.io/platforms/javascript/guides/solid.md)
- [SolidStart](https://docs.sentry.io/platforms/javascript/guides/solidstart.md)
- [Svelte](https://docs.sentry.io/platforms/javascript/guides/svelte.md)
- [SvelteKit](https://docs.sentry.io/platforms/javascript/guides/sveltekit.md)
- [TanStack Start React](https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react.md)
- [Vue](https://docs.sentry.io/platforms/javascript/guides/vue.md)
- [Wasm](https://docs.sentry.io/platforms/javascript/guides/wasm.md)

## Topics

- [Manual Setup](https://docs.sentry.io/platforms/javascript/guides/react-router/manual-setup.md)
- [Capturing Errors](https://docs.sentry.io/platforms/javascript/guides/react-router/usage.md)
- [Source Maps](https://docs.sentry.io/platforms/javascript/guides/react-router/sourcemaps.md)
- [Logs](https://docs.sentry.io/platforms/javascript/guides/react-router/logs.md)
- [React Router Features](https://docs.sentry.io/platforms/javascript/guides/react-router/features.md)
- [Session Replay](https://docs.sentry.io/platforms/javascript/guides/react-router/session-replay.md)
- [Tracing](https://docs.sentry.io/platforms/javascript/guides/react-router/tracing.md)
- [Application Metrics](https://docs.sentry.io/platforms/javascript/guides/react-router/metrics.md)
- [Profiling](https://docs.sentry.io/platforms/javascript/guides/react-router/profiling.md)
- [Crons](https://docs.sentry.io/platforms/javascript/guides/react-router/crons.md)
- [User Feedback](https://docs.sentry.io/platforms/javascript/guides/react-router/user-feedback.md)
- [Sampling](https://docs.sentry.io/platforms/javascript/guides/react-router/sampling.md)
- [Enriching Events](https://docs.sentry.io/platforms/javascript/guides/react-router/enriching-events.md)
- [Extended Configuration](https://docs.sentry.io/platforms/javascript/guides/react-router/configuration.md)
- [OpenTelemetry Support](https://docs.sentry.io/platforms/javascript/guides/react-router/opentelemetry.md)
- [Feature Flags](https://docs.sentry.io/platforms/javascript/guides/react-router/feature-flags.md)
- [Data Management](https://docs.sentry.io/platforms/javascript/guides/react-router/data-management.md)
- [Security Policy Reporting](https://docs.sentry.io/platforms/javascript/guides/react-router/security-policy-reporting.md)
- [Special Use Cases](https://docs.sentry.io/platforms/javascript/guides/react-router/best-practices.md)
- [Migration Guide](https://docs.sentry.io/platforms/javascript/guides/react-router/migration.md)
- [Troubleshooting](https://docs.sentry.io/platforms/javascript/guides/react-router/troubleshooting.md)
