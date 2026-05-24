---
title: "Vite"
description: "Upload your source maps with the Sentry Vite Plugin."
url: https://docs.sentry.io/platforms/javascript/sourcemaps/uploading/vite/
---

# Vite | Sentry for JavaScript

This guide assumes you're using a Sentry **SDK version `7.47.0` or higher**. If you're on an older version and you want to upload source maps, we recommend upgrading your SDK to the newest version.

You can use the Sentry Vite plugin to automatically create releases and upload source maps to Sentry when bundling your app.

## [Automatic Setup](https://docs.sentry.io/platforms/javascript/sourcemaps/uploading/vite.md#automatic-setup)

The easiest way to configure uploading source maps with Vite is by using the Sentry Wizard:

**bash**

```bash
npx @sentry/wizard@latest -i sourcemaps
```

The wizard will guide you through the following steps:

* Logging into Sentry and selecting a project
* Installing the necessary Sentry packages
* Configuring your build tool to generate and upload source maps
* Configuring your CI to upload source maps

If you'd rather configure source map uploading with Vite manually, follow the steps below.

## [Manual Setup](https://docs.sentry.io/platforms/javascript/sourcemaps/uploading/vite.md#manual-setup)

Install the Sentry Vite plugin:

**npm**

```bash
npm install @sentry/vite-plugin --save-dev
```

**yarn**

```bash
yarn add @sentry/vite-plugin --dev
```

**pnpm**

```bash
pnpm add @sentry/vite-plugin --save-dev
```

### [Configuration](https://docs.sentry.io/platforms/javascript/sourcemaps/uploading/vite.md#configuration)

To upload source maps you have to configure an [Organization Token](https://sentry.io/orgredirect/organizations/:orgslug/settings/auth-tokens/).

Alternatively, you can also use a [Personal Token](https://sentry.io/orgredirect/organizations/:orgslug/settings/account/api/auth-tokens/), with the "Project: Read & Write" and "Release: Admin" permissions.

Auth tokens can be passed to the plugin explicitly with the `authToken` option, with a `SENTRY_AUTH_TOKEN` environment variable, or with an `.env.sentry-build-plugin` file (don't forget to add it to your `.gitignore` file, as this is sensitive data) in the working directory when building your project. We recommend you add the auth token to your CI/CD environment as an environment variable.

Learn more about configuring the plugin in our [Sentry Vite Plugin documentation](https://www.npmjs.com/package/@sentry/vite-plugin).

**\[bash] .env.sentry-build-plugin**

```bash
SENTRY_AUTH_TOKEN=___ORG_AUTH_TOKEN___
```

Using environment variables in Vite configs

Vite doesn't automatically load `.env` files into `process.env` when evaluating the config file. If you store your auth token in a `.env` file and want to access it via `process.env.SENTRY_AUTH_TOKEN`, use Vite's [`loadEnv`](https://vite.dev/guide/api-javascript#loadenv) helper:

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

Alternatively, use a `.env.sentry-build-plugin` file, which the Sentry plugin reads automatically.

##### Plugin Order Matters

Place the Sentry Vite plugin **after all other plugins** in your `plugins` array. This ensures source maps are generated correctly and tree-shaking doesn't remove Sentry's instrumentation.

Example:

**\[javascript] vite.config.js**

```javascript
import { defineConfig } from "vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig({
  build: {
    sourcemap: "hidden", // Source map generation must be turned on ("hidden", true, etc.)
  },
  plugins: [
    // Put the Sentry Vite plugin after all other plugins
    sentryVitePlugin({
      org: "___ORG_SLUG___",
      project: "___PROJECT_SLUG___",
      authToken: process.env.SENTRY_AUTH_TOKEN,

      sourcemaps: {
        // As you're enabling client source maps, you probably want to delete them after they're uploaded to Sentry.
        // Set the appropriate glob pattern for your output folder - some glob examples below:
        filesToDeleteAfterUpload: [
          "./**/*.map",
          ".*/**/public/**/*.map",
          "./dist/**/client/**/*.map",
        ],
      },
    }),
  ],
});
```

Generating source maps **may expose them to the public**, potentially causing your source code to be leaked. You can prevent this by configuring your server to deny access to `.js.map` files, or by using [Sentry Vite Plugin's `sourcemaps.filesToDeleteAfterUpload`](https://www.npmjs.com/package/@sentry/vite-plugin#sourcemapsfilestodeleteafterupload) option to delete source maps after they've been uploaded to Sentry.

The Sentry Vite plugin doesn't upload source maps in watch-mode/development-mode. We recommend running a production build to test your configuration.

## [Troubleshooting](https://docs.sentry.io/platforms/javascript/sourcemaps/uploading/vite.md#troubleshooting)

Sentry Vite plugin shows high plugin timings warning

When using Vite 6+ with the Rolldown bundler, you may see a `[PLUGIN_TIMINGS]` warning reporting that `sentry-vite-plugin` is taking a high percentage of total build time. This warning comes from [Rolldown's plugin timings check](https://rolldown.rs/reference/InputOptions.checks#plugintimings), not from Sentry, and appears when a single plugin uses more than 50% of total build time.

This is expected behavior. The Sentry Vite plugin uploads source maps to Sentry during the build, which involves network requests. In projects with fast compilation (common with Rolldown), the upload step can dominate the total build time percentage even though the absolute duration hasn't increased.

Make sure you only upload source maps for production builds and in CI. See the [configuration section](https://docs.sentry.io/platforms/javascript/sourcemaps/uploading/vite.md#configuration) above for setup details.
