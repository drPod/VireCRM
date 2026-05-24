---
title: "Troubleshooting Source Maps"
description: "Troubleshooting for source maps."
url: https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/
---

# Troubleshooting Source Maps | Sentry for JavaScript

If you previously set up source maps, we suggest updating your tools (SDK, bundler plugins, Sentry CLI). It is generally easier to upgrade to the latest versions and follow the current process rather than troubleshooting with older versions.

For information on the legacy method of uploading source maps, please see the guide on [Legacy Uploading Methods](https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/legacy-uploading-methods.md).

Dependency versions that require the legacy method of uploading source maps include:

* JavaScript SDK version `7.46.0` or lower

* `@sentry/webpack-plugin` package version `1.x` or lower

* `sentry-cli` version `2.16.1` or lower

* Sentry self-hosted or single-tenant on version `23.6.1` or lower

Setting up source maps can be tricky, but it's worth it to get it right. You can follow the steps below to troubleshoot your source maps set up.

## [Troubleshooting Steps](https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js.md#troubleshooting-steps)

"Sentry not part of build pipeline" error

This error means your deployed JavaScript doesn't contain Debug IDs, so Sentry can't match it to uploaded source maps.

**To fix:**

1. Run the wizard to configure source map uploads for your bundler:

   **bash**

   ```bash
   npx @sentry/wizard@latest -i sourcemaps
   ```

2. Verify you're running a **production build** (not dev/watch mode)

3. Check your [Source Maps](https://sentry.io/orgredirect/organizations/:orgslug/settings/projects/:projectId/source-maps/) settings show uploaded artifacts

### [Verify Artifacts Are Uploaded](https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js.md#verify-artifacts-are-uploaded)

Verify your artifacts are being uploaded to Sentry. You can find them at **\[Settings] > Projects > Select your project > Source Maps**. For Sentry to de-minify your stack traces you must provide both the minified files (for example, app.min.js) and the corresponding source maps.

### [Verify That You're Building Source Maps](https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js.md#verify-that-youre-building-source-maps)

Bundlers and tools (like `tsc`) that generate code, often require you to manually set specific options to generate source maps.

If you followed one of our tool-specific guides, verify you configured your tool to emit source maps and that the source maps contain your original source code in the `sourcesContent` field.

### [Verify That You're Running a Production Build](https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js.md#verify-that-youre-running-a-production-build)

When running JavaScript build tools (like webpack, Vite, ...) in development-mode/watch-mode, the generated code is sometimes incompatible with our source map uploading processes.

We recommend, especially when testing locally, to run a production build to verify your source maps uploading setup.

### [Verify Your Source Files Contain Debug ID Injection Snippets](https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js.md#verify-your-source-files-contain-debug-id-injection-snippets)

In the JavaScript files you uploaded to Sentry, search for code that roughly looks like `e._sentryDebugIds=e._sentryDebugIds||{}`. This code snippet might look different depending on how you process your code.

If this code exists in a bundle, that bundle will be able to be matched to a source file. Every bundle you deploy in your app needs to have this snippet in order to be correctly source mapped.

If your source code does not contain this snippet and you're using a Sentry plugin for your bundler, please check that you are using the latest version and please verify that the plugin is correctly processing your files. Set the `debug` option to `true` to print useful debugging information.

If you're using the Sentry CLI, verify that you're running the `inject` command **before** you upload to Sentry and **before** you deploy your files.

## [Verify Your SDK is Up-to-Date](https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js.md#verify-your-sdk-is-up-to-date)

When inspecting the event payload JSON data in Sentry, verify that the events have a `debug_meta` property. If this property is missing and you already made sure your source files contain debug ID injection snippets, this likely means that you're using an outdated SDK.

We generally recommend upgrading to the latest version, and for source maps to work you need to at least use version `7.47.0`.

After you verified your event has a `debug_meta` property, the next thing to check is whether all frames inside the `raw_stacktrace` property inside the events have an `abs_path` property that exactly matches one of the `code_file` properties inside the `debug_meta` images.

If a stack frame doesn't match an entry inside `debug_meta`, make sure that the relevant file contains a debug ID injection snippet.

### [Verify Artifacts Are Uploaded Before Errors Occur](https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js.md#verify-artifacts-are-uploaded-before-errors-occur)

Sentry expects that source code and source maps in a given release are uploaded to Sentry **before** errors occur in that release.

If you upload artifacts **after** an error is captured by Sentry, Sentry will not go back and retroactively apply any source annotations to those errors. Only new errors triggered after the artifact was uploaded will be affected.

### [Verify Your Source Maps Are Built Correctly](https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js.md#verify-your-source-maps-are-built-correctly)

We maintain an online validation tool that can be used to test your source maps against your **hosted** source: [sourcemaps.io](https://sourcemaps.io).

Alternatively, if you are using Sentry CLI to upload source maps to Sentry, you can use the `--validate` command line option to verify your source maps are correct.

### [Verify Your Source Maps Work Locally](https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js.md#verify-your-source-maps-work-locally)

If you find that Sentry is not mapping filename, line, or column mappings correctly, you should verify that your source maps are functioning locally. To do so, you can use Node.js coupled with Mozilla's [source-map library](https://github.com/mozilla/source-map).

First, install `source-map` globally as an npm module:

**bash**

```bash
npm install -g source-map
```

Then, write a Node.js script that reads your source map file and tests a mapping. Here's an example:

**javascript**

```javascript
var fs = require("fs"),
  path = require("path"),
  sourceMap = require("source-map");

// Path to file that is generated by your build tool (webpack, tsc, ...)
var GENERATED_FILE = path.join(".", "app.min.js.map");

// Line and column located in your generated file (for example, the source
// of the error from your minified file)
var GENERATED_LINE_AND_COLUMN = { line: 1, column: 1000 };

var rawSourceMap = fs.readFileSync(GENERATED_FILE).toString();
new sourceMap.SourceMapConsumer(rawSourceMap).then(function (smc) {
  var pos = smc.originalPositionFor(GENERATED_LINE_AND_COLUMN);

  // You should see something like:
  // { source: 'original.js', line: 57, column: 9, name: 'myfunc' }
  console.log(pos);
});
```

If you have the same (incorrect) results locally as you do via Sentry, double-check your source map generation configuration.

### [Verify That Artifacts Aren't Gzipped](https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js.md#verify-that-artifacts-arent-gzipped)

The Sentry API currently only works with source maps and source files that are uploaded as plain text (UTF-8 encoded). If the files are uploaded in a compressed format (for example, gzip), they will be not be interpreted correctly.

If you are using `sentry-cli` to upload your artifacts, starting with version `2.4.0` you can add the `--decompress` flag to your `sourcemaps upload` commands.

Sometimes build scripts and plugins produce pre-compressed minified files (for example, webpack's [compression plugin](https://github.com/webpack/compression-webpack-plugin)). In these cases, you'll need to disable such plugins and perform the compression **after** the generated source maps/source files have been uploaded to Sentry.

### [Verify Source Fetching is Enabled](https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js.md#verify-source-fetching-is-enabled)

If you're [hosting your source maps publicly](https://docs.sentry.io/platforms/javascript/sourcemaps/uploading/hosting-publicly.md), make sure you have the "Enable JavaScript source fetching" option activated under **\[Settings] > Projects > Select your project > General Settings**.

### [(Self-Hosted Sentry) Verify the `symbolicator` service is operating normally](https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js.md#self-hosted-sentry-verify-the-symbolicator-service-is-operating-normally)

If you're running a self-hosted version of Sentry, you can verify that the `symbolicator` service/container is operating normally by checking the container's logs.

### [(Self-Hosted Sentry via Docker) Verify workers are sharing the same volume as web](https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js.md#self-hosted-sentry-via-docker-verify-workers-are-sharing-the-same-volume-as-web)

Sentry does source map calculation in its workers. This means the workers need access to the files uploaded through the front end. Double check that the cron workers and web workers can read/write files from the same disk.

### [Verify You Aren't Using the `source-map-support` Package](https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js.md#verify-you-arent-using-the-source-map-support-package)

The Sentry Node.js SDK generally works well with the [source-map-support](https://www.npmjs.com/package/source-map-support) package if you don't already have source maps uploaded to Sentry.

If you are uploading source maps to Sentry or if you are using a Sentry SDK in the browser, your code cannot use the `source-map-support` package. `source-map-support` overwrites the captured stack trace in a way that prevents our source map processors from correctly parsing it.

### [Third-Party Integrations](https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js.md#third-party-integrations)

In rare cases, faulty or outdated third-party integrations may modify the error sent to Sentry, causing essential information to be lost and preventing Sentry from displaying the source map. If you're using a third party integration or other community-maintained packages, try to temporarily disable them to rule out this possibility.

We will collect known instances of conflicting third-party packages here:

* `posthog-js` versions from `1.207.4` to `1.229.0` (fixed in `posthog-js` version `1.229.1`)

## Pages in this section

- [Legacy Uploading Methods](https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/legacy-uploading-methods.md)
- [What are Debug IDs](https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/debug-ids.md)
