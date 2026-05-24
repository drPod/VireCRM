---
title: "Releases & Health"
description: "Learn how to configure your SDK to tell Sentry about your releases."
url: https://docs.sentry.io/platforms/javascript/guides/cloudflare/configuration/releases/
---

# Releases & Health | Sentry for Cloudflare

A release is a version of your code that is deployed to an [environment](https://docs.sentry.io/platforms/javascript/guides/cloudflare/configuration/environments.md). When you give Sentry information about your releases, you can:

* Determine issues and regressions introduced in a new release
* Predict which commit caused an issue and who is likely responsible
* Resolve issues by including the issue number in your commit message
* Receive email notifications when your code gets deployed

Additionally, releases are used for applying [source maps](https://docs.sentry.io/platforms/javascript/sourcemaps.md) to minified JavaScript to view original, untransformed source code.

## [Bind the Version](https://docs.sentry.io/platforms/javascript/guides/cloudflare/configuration/releases.md#bind-the-version)

Include a release ID (often called a "version") when you initialize the SDK.

There are some release name restrictions and conventions to be aware of. [Learn more about naming releases](https://docs.sentry.io/product/releases/naming-releases.md).

Releases can also be auto-created by different systems—for example, when uploading a source map, or by some clients when an event that is tagged with a release is ingested. Therefore, it's important to set the release name when building and deploying your application. Learn more in our [Releases](https://docs.sentry.io/platform-redirect.md?next=/configuration/releases/) documentation.

## [Setting a Release](https://docs.sentry.io/platforms/javascript/guides/cloudflare/configuration/releases.md#setting-a-release)

**javascript**

```javascript
Sentry.init({
  release: "my-project-name@2.3.12",
});
```

A common way to do this with JavaScript in a Node/npm environment would be to use the [`process.env.npm_package_version`](https://docs.npmjs.com/misc/scripts#packagejson-vars) like so:

**javascript**

```javascript
Sentry.init({
  release: "my-project-name@" + process.env.npm_package_version,
});
```

How you make the release name (or version) available to your code is up to you. For example, you could use an environment variable that is set during the build process or during initial start-up.

Setting the release name tags each event with that release name. We recommend that you tell Sentry about a new release before sending events with that release name, as this will unlock a few more features. Learn more in our [Releases](https://docs.sentry.io/product/releases.md) documentation.

If you don't tell Sentry about a new release, Sentry will automatically create a release entity in the system the first time it sees an event with that release ID.

After configuring your SDK, you can install a repository integration or manually supply Sentry with your own commit metadata. Read our documentation about [setting up releases](https://docs.sentry.io/product/releases/setup.md) for further information about integrations, associating commits, and telling Sentry when deploying releases.

## [Release Health](https://docs.sentry.io/platforms/javascript/guides/cloudflare/configuration/releases.md#release-health)

Monitor the [health of releases](https://docs.sentry.io/product/releases/health.md) by observing user adoption, usage of the application, percentage of [crashes](https://docs.sentry.io/product/releases/health.md#crashes), and [session data](https://docs.sentry.io/product/releases/health.md#sessions). Release health will provide insight into the impact of crashes and bugs as it relates to user experience, and reveal trends with each new issue through the [Release Details](https://docs.sentry.io/product/releases/release-details.md) graphs and filters.

In order to monitor release health, the SDK sends session data.

### [Sessions](https://docs.sentry.io/platforms/javascript/guides/cloudflare/configuration/releases.md#sessions)

A session represents the interaction between the user and the application. Sessions contain a timestamp, a status (if the session was OK or if it crashed), and are always linked to a release. Most Sentry SDKs can manage sessions automatically.

Sessions are marked as:

* `crashed` if an *unhandled error* or *unhandled promise rejection* bubbled up to the global handler.
* `errored` if the SDK captures an event that contains an exception (this includes manually captured errors).

To receive data on user adoption, such as users crash free rate percentage, and the number of users that have adopted a specific release, set the user on the [`initialScope`](https://docs.sentry.io/platforms/javascript/configuration/options.md#initial-scope) when initializing the SDK.

See [Session APIs](https://docs.sentry.io/platforms/javascript/guides/cloudflare/apis.md#sessions) for more information on how to manually capturing sessions.
