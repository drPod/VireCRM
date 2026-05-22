---
title: Vite plugin
description: A full-featured integration between Vite and the Workers runtime
image: https://developers.cloudflare.com/dev-products-preview.png
---

> Documentation Index  
> Fetch the complete documentation index at: https://developers.cloudflare.com/workers/llms.txt  
> Use this file to discover all available pages before exploring further.

[Skip to content](#%5Ftop) 

# Vite plugin

The Cloudflare Vite plugin enables a full-featured integration between [Vite ↗](https://vite.dev/) and the [Workers runtime](https://developers.cloudflare.com/workers/runtime-apis/). Your Worker code runs inside [workerd ↗](https://github.com/cloudflare/workerd), matching the production behavior as closely as possible and providing confidence as you develop and deploy your applications.

## Features

* Uses the Vite [Environment API ↗](https://vite.dev/guide/api-environment) to integrate Vite with the Workers runtime
* Provides direct access to [Workers runtime APIs](https://developers.cloudflare.com/workers/runtime-apis/) and [bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/)
* Builds your front-end assets for deployment to Cloudflare, enabling you to build static sites, SPAs, and full-stack applications
* Official support for [TanStack Start ↗](https://tanstack.com/start/) and [React Router v7 ↗](https://reactrouter.com/) with server-side rendering
* Leverages Vite's hot module replacement for consistently fast updates
* Supports `vite preview` for previewing your build output in the Workers runtime prior to deployment

## Use cases

* [TanStack Start ↗](https://tanstack.com/start/)
* [React Router v7 ↗](https://reactrouter.com/)
* Static sites, such as single-page applications, with or without an integrated backend API
* Standalone Workers
* Multi-Worker applications

## Get started

To create a new application from a ready-to-go template, refer to the [TanStack Start](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/), [React Router](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/), [React](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/) or [Vue](https://developers.cloudflare.com/workers/framework-guides/web-apps/vue/) framework guides.

To create a standalone Worker from scratch, refer to [Get started](https://developers.cloudflare.com/workers/vite-plugin/get-started/).

For a more in-depth look at adapting an existing Vite project and an introduction to key concepts, refer to the [Tutorial](https://developers.cloudflare.com/workers/vite-plugin/tutorial/).

```json
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"item":{"@id":"/directory/","name":"Directory"}},{"@type":"ListItem","position":2,"item":{"@id":"/workers/","name":"Workers"}},{"@type":"ListItem","position":3,"item":{"@id":"/workers/vite-plugin/","name":"Vite plugin"}}]}
```

---

---
title: Vite plugin
description: A full-featured integration between Vite and the Workers runtime
image: https://developers.cloudflare.com/dev-products-preview.png
---

> Documentation Index  
> Fetch the complete documentation index at: https://developers.cloudflare.com/workers/llms.txt  
> Use this file to discover all available pages before exploring further.

[Skip to content](#%5Ftop) 

# Vite plugin

The Cloudflare Vite plugin enables a full-featured integration between [Vite ↗](https://vite.dev/) and the [Workers runtime](https://developers.cloudflare.com/workers/runtime-apis/). Your Worker code runs inside [workerd ↗](https://github.com/cloudflare/workerd), matching the production behavior as closely as possible and providing confidence as you develop and deploy your applications.

## Features

* Uses the Vite [Environment API ↗](https://vite.dev/guide/api-environment) to integrate Vite with the Workers runtime
* Provides direct access to [Workers runtime APIs](https://developers.cloudflare.com/workers/runtime-apis/) and [bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/)
* Builds your front-end assets for deployment to Cloudflare, enabling you to build static sites, SPAs, and full-stack applications
* Official support for [TanStack Start ↗](https://tanstack.com/start/) and [React Router v7 ↗](https://reactrouter.com/) with server-side rendering
* Leverages Vite's hot module replacement for consistently fast updates
* Supports `vite preview` for previewing your build output in the Workers runtime prior to deployment

## Use cases

* [TanStack Start ↗](https://tanstack.com/start/)
* [React Router v7 ↗](https://reactrouter.com/)
* Static sites, such as single-page applications, with or without an integrated backend API
* Standalone Workers
* Multi-Worker applications

## Get started

To create a new application from a ready-to-go template, refer to the [TanStack Start](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/), [React Router](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/), [React](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/) or [Vue](https://developers.cloudflare.com/workers/framework-guides/web-apps/vue/) framework guides.

To create a standalone Worker from scratch, refer to [Get started](https://developers.cloudflare.com/workers/vite-plugin/get-started/).

For a more in-depth look at adapting an existing Vite project and an introduction to key concepts, refer to the [Tutorial](https://developers.cloudflare.com/workers/vite-plugin/tutorial/).

```json
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"item":{"@id":"/directory/","name":"Directory"}},{"@type":"ListItem","position":2,"item":{"@id":"/workers/","name":"Workers"}},{"@type":"ListItem","position":3,"item":{"@id":"/workers/vite-plugin/","name":"Vite plugin"}}]}
```

---

---
title: Get started
description: Get started with the Vite plugin
image: https://developers.cloudflare.com/dev-products-preview.png
---

> Documentation Index  
> Fetch the complete documentation index at: https://developers.cloudflare.com/workers/llms.txt  
> Use this file to discover all available pages before exploring further.

[Skip to content](#%5Ftop) 

# Get started

Note

This guide demonstrates creating a standalone Worker from scratch. If you would instead like to create a new application from a ready-to-go template, refer to the [TanStack Start](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/), [React Router](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/), [React](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/) or [Vue](https://developers.cloudflare.com/workers/framework-guides/web-apps/vue/) framework guides.

## Start with a basic `package.json`

package.json

```

{

  "name": "cloudflare-vite-get-started",

  "private": true,

  "version": "0.0.0",

  "type": "module",

  "scripts": {

    "dev": "vite dev",

    "build": "vite build",

    "preview": "npm run build && vite preview",

    "deploy": "npm run build && wrangler deploy"

  }

}


```

Note

Ensure that you include `"type": "module"` in order to use ES modules by default.

## Install the dependencies

 npm  yarn  pnpm  bun 

```
npm i -D vite @cloudflare/vite-plugin wrangler
```

```
yarn add -D vite @cloudflare/vite-plugin wrangler
```

```
pnpm add -D vite @cloudflare/vite-plugin wrangler
```

```
bun add -d vite @cloudflare/vite-plugin wrangler
```

## Create your Vite config file and include the Cloudflare plugin

vite.config.ts

```

import { defineConfig } from "vite";

import { cloudflare } from "@cloudflare/vite-plugin";


export default defineConfig({

  plugins: [cloudflare()],

});


```

The Cloudflare Vite plugin doesn't require any configuration by default and will look for a `wrangler.jsonc`, `wrangler.json` or `wrangler.toml` in the root of your application.

Refer to the [API reference](https://developers.cloudflare.com/workers/vite-plugin/reference/api/) for configuration options.

## Create your Worker config file

* [  wrangler.jsonc ](#tab-panel-10023)
* [  wrangler.toml ](#tab-panel-10024)

JSONC

```

{

  "$schema": "./node_modules/wrangler/config-schema.json",

  "name": "cloudflare-vite-get-started",

  // Set this to today's date

  "compatibility_date": "2026-05-21",

  "main": "./src/index.ts"

}


```

TOML

```

"$schema" = "./node_modules/wrangler/config-schema.json"

name = "cloudflare-vite-get-started"

# Set this to today's date

compatibility_date = "2026-05-21"

main = "./src/index.ts"


```

The `name` field specifies the name of your Worker. By default, this is also used as the name of the Worker's Vite Environment (see [Vite Environments](https://developers.cloudflare.com/workers/vite-plugin/reference/vite-environments/) for more information). The `main` field specifies the entry file for your Worker code.

For more information about the Worker configuration, see [Configuration](https://developers.cloudflare.com/workers/wrangler/configuration/).

## Create your Worker entry file

src/index.ts

```

export default {

  fetch() {

    return new Response(`Running in ${navigator.userAgent}!`);

  },

};


```

A request to this Worker will return **'Running in Cloudflare-Workers!'**, demonstrating that the code is running inside the Workers runtime.

## Dev, build, preview and deploy

You can now start the Vite development server (`npm run dev`), build the application (`npm run build`), preview the built application (`npm run preview`), and deploy to Cloudflare (`npm run deploy`).

```json
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"item":{"@id":"/directory/","name":"Directory"}},{"@type":"ListItem","position":2,"item":{"@id":"/workers/","name":"Workers"}},{"@type":"ListItem","position":3,"item":{"@id":"/workers/vite-plugin/","name":"Vite plugin"}},{"@type":"ListItem","position":4,"item":{"@id":"/workers/vite-plugin/get-started/","name":"Get started"}}]}
```

---

---
title: API
description: Vite plugin API
image: https://developers.cloudflare.com/dev-products-preview.png
---

> Documentation Index  
> Fetch the complete documentation index at: https://developers.cloudflare.com/workers/llms.txt  
> Use this file to discover all available pages before exploring further.

[Skip to content](#%5Ftop) 

# API

## `cloudflare()`

The `cloudflare` plugin should be included in the Vite `plugins` array:

vite.config.ts

```

import { defineConfig } from "vite";

import { cloudflare } from "@cloudflare/vite-plugin";


export default defineConfig({

  plugins: [cloudflare()],

});


```

It accepts an optional `PluginConfig` parameter.

## `interface PluginConfig`

* `configPath` ` string ` optional  
An optional path to your entry Worker config file.  
For the entry Worker, the plugin resolves the config path in this order:  
   1. `configPath`  
   2. `CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH` (typically set by a framework or other external tool)  
   3. `wrangler.jsonc`, `wrangler.json`, or `wrangler.toml` in the root of your application  
This applies in `vite dev` and `vite build`.  
For more information about the Worker configuration, see [Configuration](https://developers.cloudflare.com/workers/wrangler/configuration/).
* `config` ` WorkerConfigCustomizer<true> ` optional  
Customize or override Worker configuration programmatically. Accepts a partial configuration object or a function that receives the current config.  
Applied after any config file loads. Use it to override values, modify the existing config, or define Workers entirely in code.  
See [Programmatic configuration](https://developers.cloudflare.com/workers/vite-plugin/reference/programmatic-configuration/) for details.
* `viteEnvironment` ` { name?: string; childEnvironments?: string[] } ` optional  
Optional Vite environment options. By default, the environment name is the Worker name with `-` characters replaced with `_`. Setting the name here will override this. A typical use case is setting `viteEnvironment: { name: "ssr" }` to apply the Worker to the SSR environment.  
The `childEnvironments` option is for supporting React Server Components via [@vitejs/plugin-rsc ↗](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-rsc) and frameworks that build on top of it. This enables embedding additional environments with separate module graphs inside a single Worker.  
See [Vite Environments](https://developers.cloudflare.com/workers/vite-plugin/reference/vite-environments/) for more information.
* `persistState` ` boolean | { path: string } ` optional  
An optional override for state persistence. By default, state is persisted to `.wrangler/state`. A custom `path` can be provided or, alternatively, persistence can be disabled by setting the value to `false`.
* `inspectorPort` ` number | false ` optional  
An optional override for debugging your Workers. By default, the debugging inspector is enabled and listens on port `9229`. A custom port can be provided or, alternatively, setting this to `false` will disable the debugging inspector.  
See [Debugging](https://developers.cloudflare.com/workers/vite-plugin/reference/debugging/) for more information.
* `tunnel` ` boolean | { name?: string; autoStart?: boolean } ` optional  
Expose your local dev server over a [Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/).  
Provide an object to configure a named tunnel or control whether the tunnel starts automatically. Press `t + Enter` to start or close the tunnel. Set `tunnel.autoStart` to `true` if you want the tunnel to open when Vite starts.  
   * [  JavaScript ](#tab-panel-10025)  
   * [  TypeScript ](#tab-panel-10026)  
vite.config.js  
```  
import { defineConfig } from "vite";  
import { cloudflare } from "@cloudflare/vite-plugin";  
export default defineConfig({  
  plugins: [  
    cloudflare({  
      tunnel: { name: "my-tunnel" },  
    }),  
  ],  
});  
```  
vite.config.ts  
```  
import { defineConfig } from "vite";  
import { cloudflare } from "@cloudflare/vite-plugin";  
export default defineConfig({  
  plugins: [  
    cloudflare({  
      tunnel: { name: "my-tunnel" },  
    }),  
  ],  
});  
```  
See [Share a local dev server](https://developers.cloudflare.com/workers/development-testing/local-dev-tunnels/) for more information.
* `auxiliaryWorkers` ` Array<AuxiliaryWorkerConfig> ` optional  
An optional array of auxiliary Workers. Auxiliary Workers are additional Workers that are used as part of your application. You can use [service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/) to call auxiliary Workers from your main (entry) Worker. All requests are routed through your entry Worker. During the build, each Worker is output to a separate subdirectory of `dist`.  
Note  
When running `wrangler deploy`, only your main (entry) Worker will be deployed. If using multiple Workers, each auxiliary Worker must be deployed individually. You can inspect the `dist` directory and then run `wrangler deploy -c dist/<auxiliary-worker>/wrangler.json` for each.
* `remoteBindings` ` boolean ` optional  
Whether or not [remote bindings](https://developers.cloudflare.com/workers/development-testing/#remote-bindings) should be enabled. Defaults to `true`.

## `interface AuxiliaryWorkerConfig`

Auxiliary Workers require a `configPath`, a `config` option, or both.`CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH` only applies to the entry Worker. Auxiliary Workers do not use this environment variable. If you use a config file for an auxiliary Worker, set `configPath` explicitly.

* `configPath` ` string ` optional  
The path to your Worker config file. This field is required unless `config` is provided.  
For more information about the Worker configuration, see [Configuration](https://developers.cloudflare.com/workers/wrangler/configuration/).
* `config` ` WorkerConfigCustomizer<false> ` optional  
Customize or override Worker configuration programmatically. When used without `configPath`, this allows defining auxiliary Workers entirely in code.  
See [Programmatic configuration](https://developers.cloudflare.com/workers/vite-plugin/reference/programmatic-configuration/) for usage examples.
* `viteEnvironment` ` { name?: string; childEnvironments?: string[] } ` optional  
Optional Vite environment options. By default, the environment name is the Worker name with `-` characters replaced with `_`. Setting the name here will override this.  
The `childEnvironments` option is for supporting React Server Components via [@vitejs/plugin-rsc ↗](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-rsc) and frameworks that build on top of it. This enables embedding additional environments with separate module graphs inside a single Worker.  
See [Vite Environments](https://developers.cloudflare.com/workers/vite-plugin/reference/vite-environments/) for more information.

```json
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"item":{"@id":"/directory/","name":"Directory"}},{"@type":"ListItem","position":2,"item":{"@id":"/workers/","name":"Workers"}},{"@type":"ListItem","position":3,"item":{"@id":"/workers/vite-plugin/","name":"Vite plugin"}},{"@type":"ListItem","position":4,"item":{"@id":"/workers/vite-plugin/reference/","name":"Reference"}},{"@type":"ListItem","position":5,"item":{"@id":"/workers/vite-plugin/reference/api/","name":"API"}}]}
```

---

---
title: Cloudflare Environments
description: Using Cloudflare environments with the Vite plugin
image: https://developers.cloudflare.com/dev-products-preview.png
---

> Documentation Index  
> Fetch the complete documentation index at: https://developers.cloudflare.com/workers/llms.txt  
> Use this file to discover all available pages before exploring further.

[Skip to content](#%5Ftop) 

# Cloudflare Environments

A Worker config file may contain configuration for multiple [Cloudflare environments](https://developers.cloudflare.com/workers/wrangler/environments/). With the Cloudflare Vite plugin, you select a Cloudflare environment at dev or build time by providing the `CLOUDFLARE_ENV` environment variable. Consider the following example Worker config file:

* [  wrangler.jsonc ](#tab-panel-10027)
* [  wrangler.toml ](#tab-panel-10028)

JSONC

```

{

  "$schema": "./node_modules/wrangler/config-schema.json",

  "name": "my-worker",

  // Set this to today's date

  "compatibility_date": "2026-05-21",

  "main": "./src/index.ts",

  "vars": {

    "MY_VAR": "Top-level var"

  },

  "env": {

    "staging": {

      "vars": {

        "MY_VAR": "Staging var"

      }

    },

    "production": {

      "vars": {

        "MY_VAR": "Production var"

      }

    }

  }

}


```

TOML

```

"$schema" = "./node_modules/wrangler/config-schema.json"

name = "my-worker"

# Set this to today's date

compatibility_date = "2026-05-21"

main = "./src/index.ts"


[vars]

MY_VAR = "Top-level var"


[env.staging.vars]

MY_VAR = "Staging var"


[env.production.vars]

MY_VAR = "Production var"


```

If you run `CLOUDFLARE_ENV=production vite build` then the output `wrangler.json` file generated by the build will be a flattened configuration for the 'production' Cloudflare environment, as shown in the following example:

dist/wrangler.json

```

{

  "name": "my-worker",

  "compatibility_date": "2025-04-03",

  "main": "index.js",

  "vars": { "MY_VAR": "Production var" }

}


```

Notice that the value of `MY_VAR` is `Production var`. This flattened configuration combines [top-level only](https://developers.cloudflare.com/workers/wrangler/configuration/#top-level-only-keys), [inheritable](https://developers.cloudflare.com/workers/wrangler/configuration/#inheritable-keys), and [non-inheritable](https://developers.cloudflare.com/workers/wrangler/configuration/#non-inheritable-keys) keys.

Note

The default Vite environment name for a Worker is always the top-level Worker name. This enables you to reference the Worker consistently in your Vite config when using multiple Cloudflare environments. See [Vite Environments](https://developers.cloudflare.com/workers/vite-plugin/reference/vite-environments/) for more information.

Cloudflare environments can also be used in development. For example, you could run `CLOUDFLARE_ENV=development vite dev`. It is common to use the default top-level environment as the development environment and then add additional environments as necessary.

Note

Running `vite dev` or `vite build` without providing `CLOUDFLARE_ENV` will use the default top-level Cloudflare environment. As Cloudflare environments are applied at dev and build time, specifying `CLOUDFLARE_ENV` when running `vite preview` or `wrangler deploy` will have no effect.

## Secrets in local development

Warning

Do not use `vars` to store sensitive information in your Worker's Wrangler configuration file. Use secrets instead.

Put secrets for use in local development in either a `.dev.vars` file or a `.env` file, in the same directory as the Wrangler configuration file.

Note

You can use the [secrets configuration property](https://developers.cloudflare.com/workers/wrangler/configuration/#secrets-configuration-property) to declare which secret names your Worker requires. When defined, only the keys listed in `secrets.required` are loaded from `.dev.vars` or `.env`. Additional keys are excluded and missing keys produce a warning.

Choose to use either `.dev.vars` or `.env` but not both. If you define a `.dev.vars` file, then values in `.env` files will not be included in the `env` object during local development.

These files should be formatted using the [dotenv ↗](https://hexdocs.pm/dotenvy/dotenv-file-format.html) syntax. For example:

.dev.vars / .env

```

SECRET_KEY="value"

API_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"


```

Do not commit secrets to git

The `.dev.vars` and `.env` files should not committed to git. Add `.dev.vars*` and `.env*` to your project's `.gitignore` file.

To set different secrets for each Cloudflare environment, create files named `.dev.vars.<environment-name>` or `.env.<environment-name>`.

When you select a Cloudflare environment in your local development, the corresponding environment-specific file will be loaded ahead of the generic `.dev.vars` (or `.env`) file.

* When using `.dev.vars.<environment-name>` files, all secrets must be defined per environment. If `.dev.vars.<environment-name>` exists then only this will be loaded; the `.dev.vars` file will not be loaded.
* In contrast, all matching `.env` files are loaded and the values are merged. For each variable, the value from the most specific file is used, with the following precedence:  
   * `.env.<environment-name>.local` (most specific)  
   * `.env.local`  
   * `.env.<environment-name>`  
   * `.env` (least specific)

Controlling `.env` handling

It is possible to control how `.env` files are loaded in local development by setting environment variables on the process running the tools.

* To disable loading local dev vars from `.env` files without providing a `.dev.vars` file, set the `CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV` environment variable to `"false"`.
* To include every environment variable defined in your system's process environment as a local development variable, ensure there is no `.dev.vars` and then set the `CLOUDFLARE_INCLUDE_PROCESS_ENV` environment variable to `"true"`. This is not needed when using the [secrets configuration property](https://developers.cloudflare.com/workers/wrangler/configuration/#secrets-configuration-property), which loads from `process.env` automatically.

## Combining Cloudflare environments and Vite modes

You may wish to combine the concepts of [Cloudflare environments](https://developers.cloudflare.com/workers/wrangler/environments/) and [Vite modes ↗](https://vite.dev/guide/env-and-mode.html#modes). With this approach, the Vite mode can be used to select the Cloudflare environment and a single method can be used to determine environment specific configuration and code. Consider again the previous example:

* [  wrangler.jsonc ](#tab-panel-10029)
* [  wrangler.toml ](#tab-panel-10030)

JSONC

```

{

  "$schema": "./node_modules/wrangler/config-schema.json",

  "name": "my-worker",

  // Set this to today's date

  "compatibility_date": "2026-05-21",

  "main": "./src/index.ts",

  "vars": {

    "MY_VAR": "Top-level var"

  },

  "env": {

    "staging": {

      "vars": {

        "MY_VAR": "Staging var"

      }

    },

    "production": {

      "vars": {

        "MY_VAR": "Production var"

      }

    }

  }

}


```

TOML

```

"$schema" = "./node_modules/wrangler/config-schema.json"

name = "my-worker"

# Set this to today's date

compatibility_date = "2026-05-21"

main = "./src/index.ts"


[vars]

MY_VAR = "Top-level var"


[env.staging.vars]

MY_VAR = "Staging var"


[env.production.vars]

MY_VAR = "Production var"


```

Next, provide `.env.staging` and `.env.production` files:

.env.staging

```

CLOUDFLARE_ENV=staging


```

.env.production

```

CLOUDFLARE_ENV=production


```

By default, `vite build` uses the 'production' Vite mode. Vite will therefore load the `.env.production` file to get the environment variables that are used in the build. Since the `.env.production` file contains `CLOUDFLARE_ENV=production`, the Cloudflare Vite plugin will select the 'production' Cloudflare environment. The value of `MY_VAR` will therefore be `'Production var'`. If you run `vite build --mode staging` then the 'staging' Vite mode will be used and the 'staging' Cloudflare environment will be selected. The value of `MY_VAR` will therefore be `'Staging var'`.

For more information about using `.env` files with Vite, see the [relevant documentation ↗](https://vite.dev/guide/env-and-mode#env-files).

```json
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"item":{"@id":"/directory/","name":"Directory"}},{"@type":"ListItem","position":2,"item":{"@id":"/workers/","name":"Workers"}},{"@type":"ListItem","position":3,"item":{"@id":"/workers/vite-plugin/","name":"Vite plugin"}},{"@type":"ListItem","position":4,"item":{"@id":"/workers/vite-plugin/reference/","name":"Reference"}},{"@type":"ListItem","position":5,"item":{"@id":"/workers/vite-plugin/reference/cloudflare-environments/","name":"Cloudflare Environments"}}]}
```

---

---
title: Debugging
description: Debugging with the Vite plugin
image: https://developers.cloudflare.com/dev-products-preview.png
---

> Documentation Index  
> Fetch the complete documentation index at: https://developers.cloudflare.com/workers/llms.txt  
> Use this file to discover all available pages before exploring further.

[Skip to content](#%5Ftop) 

# Debugging

The Cloudflare Vite plugin has debugging enabled by default and listens on port `9229`. You may choose a custom port or disable debugging by setting the `inspectorPort` option in the [plugin config](https://developers.cloudflare.com/workers/vite-plugin/reference/api#interface-pluginconfig). There are two recommended methods for debugging your Workers during local development:

## DevTools

When running `vite dev` or `vite preview`, a `/__debug` route is added that provides access to [Cloudflare's implementation ↗](https://github.com/cloudflare/workers-sdk/tree/main/packages/chrome-devtools-patches) of [Chrome's DevTools ↗](https://developer.chrome.com/docs/devtools/overview). Navigating to this route will open a DevTools tab for each of the Workers in your application.

Once the tab(s) are open, you can make a request to your application and start debugging your Worker code.

Note

When debugging multiple Workers, you may need to allow your browser to open pop-ups.

## VS Code

To set up [VS Code ↗](https://code.visualstudio.com/) to support breakpoint debugging in your application, you should create a `.vscode/launch.json` file that contains the following configuration:

.vscode/launch.json

```

{

  "configurations": [

    {

      "name": "<NAME_OF_WORKER>",

      "type": "node",

      "request": "attach",

      "websocketAddress": "ws://localhost:9229/<NAME_OF_WORKER>",

      "resolveSourceMapLocations": null,

      "attachExistingChildren": false,

      "autoAttachChildProcesses": false,

      "sourceMaps": true

    }

  ],

  "compounds": [

    {

      "name": "Debug Workers",

      "configurations": ["<NAME_OF_WORKER>"],

      "stopAll": true

    }

  ]

}


```

Here, `<NAME_OF_WORKER>` indicates the name of the Worker as specified in your Worker config file. If you have used the `inspectorPort` option to set a custom port then this should be the value provided in the `websocketaddress` field.

Note

If you have more than one Worker in your application, you should add a configuration in the `configurations` field for each and include the configuration name in the `compounds` `configurations` array.

With this set up, you can run `vite dev` or `vite preview` and then select **Debug Workers** at the top of the **Run & Debug** panel to start debugging.

```json
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"item":{"@id":"/directory/","name":"Directory"}},{"@type":"ListItem","position":2,"item":{"@id":"/workers/","name":"Workers"}},{"@type":"ListItem","position":3,"item":{"@id":"/workers/vite-plugin/","name":"Vite plugin"}},{"@type":"ListItem","position":4,"item":{"@id":"/workers/vite-plugin/reference/","name":"Reference"}},{"@type":"ListItem","position":5,"item":{"@id":"/workers/vite-plugin/reference/debugging/","name":"Debugging"}}]}
```

---

---
title: Migrating from wrangler dev
description: Migrating from wrangler dev to the Vite plugin
image: https://developers.cloudflare.com/dev-products-preview.png
---

> Documentation Index  
> Fetch the complete documentation index at: https://developers.cloudflare.com/workers/llms.txt  
> Use this file to discover all available pages before exploring further.

[Skip to content](#%5Ftop) 

# Migrating from wrangler dev

In most cases, migrating from [wrangler dev](https://developers.cloudflare.com/workers/wrangler/commands/general/#dev) is straightforward and you can follow the instructions in [Get started](https://developers.cloudflare.com/workers/vite-plugin/get-started/). There are a few key differences to highlight:

## Input and output Worker config files

With the Cloudflare Vite plugin, your [Worker config file](https://developers.cloudflare.com/workers/wrangler/configuration/) (for example, `wrangler.jsonc`) is the input configuration and a separate output configuration is created as part of the build. This output file is a snapshot of your configuration at the time of the build and is modified to reference your build artifacts. It is the configuration that is used for preview and deployment. Once you have run `vite build`, running `wrangler deploy` or `vite preview` will automatically locate this output configuration file.

## Cloudflare Environments

With the Cloudflare Vite plugin, [Cloudflare Environments](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/) are applied at dev and build time. Running `wrangler deploy --env some-env` is therefore not applicable and the environment to deploy should instead be set by running `CLOUDFLARE_ENV=some-env vite build`.

## Redundant fields in the Wrangler config file

There are various options in the [Worker config file](https://developers.cloudflare.com/workers/wrangler/configuration/) that are ignored when using Vite, as they are either no longer applicable or are replaced by Vite equivalents. If these options are provided, then warnings will be printed to the console with suggestions for how to proceed.

### Not applicable

The following build-related options are handled by Vite and are not applicable when using the Cloudflare Vite plugin:

* `tsconfig`
* `rules`
* `build`
* `no_bundle`
* `find_additional_modules`
* `base_dir`
* `preserve_file_names`

### Not supported

* `site` — Use [Workers Assets](https://developers.cloudflare.com/workers/static-assets/) instead.

### Replaced by Vite equivalents

The following options have Vite equivalents that should be used instead:

| Wrangler option                                      | Vite equivalent                                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| define                                               | [define ↗](https://vite.dev/config/shared-options.html#define)               |
| alias                                                | [resolve.alias ↗](https://vite.dev/config/shared-options.html#resolve-alias) |
| minify                                               | [build.minify ↗](https://vite.dev/config/build-options.html#build-minify)    |
| Local dev settings (ip, port, local\_protocol, etc.) | [Server options ↗](https://vite.dev/config/server-options.html)              |

See [Vite Environments](https://developers.cloudflare.com/workers/vite-plugin/reference/vite-environments/) for more information about configuring your Worker environments in Vite.

### Inferred

If [build.sourcemap ↗](https://vite.dev/config/build-options#build-sourcemap) is enabled for a given Worker environment in the Vite config, `"upload_source_maps": true` is automatically added to the output Wrangler configuration file. This means that generated sourcemaps are uploaded by default. To override this setting, you can set the value of `upload_source_maps` explicitly in the input Worker config.

```json
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"item":{"@id":"/directory/","name":"Directory"}},{"@type":"ListItem","position":2,"item":{"@id":"/workers/","name":"Workers"}},{"@type":"ListItem","position":3,"item":{"@id":"/workers/vite-plugin/","name":"Vite plugin"}},{"@type":"ListItem","position":4,"item":{"@id":"/workers/vite-plugin/reference/","name":"Reference"}},{"@type":"ListItem","position":5,"item":{"@id":"/workers/vite-plugin/reference/migrating-from-wrangler-dev/","name":"Migrating from wrangler dev"}}]}
```

---

---
title: Non-JavaScript modules
description: Additional module types that can be imported in your Worker
image: https://developers.cloudflare.com/dev-products-preview.png
---

> Documentation Index  
> Fetch the complete documentation index at: https://developers.cloudflare.com/workers/llms.txt  
> Use this file to discover all available pages before exploring further.

[Skip to content](#%5Ftop) 

# Non-JavaScript modules

In addition to TypeScript and JavaScript, the following module types are automatically configured to be importable in your Worker code.

| Module extension    | Imported type      |
| ------------------- | ------------------ |
| .txt                | string             |
| .html               | string             |
| .sql                | string             |
| .bin                | ArrayBuffer        |
| .wasm, .wasm?module | WebAssembly.Module |

For example, with the following import, `text` will be a string containing the contents of `example.txt`:

JavaScript

```

import text from "./example.txt";


```

This is also the basis for importing Wasm, as in the following example:

TypeScript

```

import wasm from "./example.wasm";


// Instantiate Wasm modules in the module scope

const instance = await WebAssembly.instantiate(wasm);


export default {

  fetch() {

    const result = instance.exports.exported_func();


    return new Response(result);

  },

};


```

Note

Cloudflare Workers does not support `WebAssembly.instantiateStreaming()`.

```json
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"item":{"@id":"/directory/","name":"Directory"}},{"@type":"ListItem","position":2,"item":{"@id":"/workers/","name":"Workers"}},{"@type":"ListItem","position":3,"item":{"@id":"/workers/vite-plugin/","name":"Vite plugin"}},{"@type":"ListItem","position":4,"item":{"@id":"/workers/vite-plugin/reference/","name":"Reference"}},{"@type":"ListItem","position":5,"item":{"@id":"/workers/vite-plugin/reference/non-javascript-modules/","name":"Non-JavaScript modules"}}]}
```

---

---
title: Programmatic configuration
description: Configure Workers programmatically using the Vite plugin
image: https://developers.cloudflare.com/dev-products-preview.png
---

> Documentation Index  
> Fetch the complete documentation index at: https://developers.cloudflare.com/workers/llms.txt  
> Use this file to discover all available pages before exploring further.

[Skip to content](#%5Ftop) 

# Programmatic configuration

The Wrangler configuration file is optional when using the Cloudflare Vite plugin. Without one, the plugin uses default values. You can customize Worker configuration programmatically with the `config` option. This is useful when the Cloudflare plugin runs inside another plugin or framework.

Note

Programmatic configuration is primarily designed for use by frameworks and plugin developers. Users should normally use Wrangler config files instead. Configuration set via the `config` option will not be included when running `wrangler types` or resource based Wrangler CLI commands such as `wrangler kv` or `wrangler d1`.

## Default configuration

Without a configuration file, the plugin generates sensible defaults for an assets-only Worker. The `name` comes from `package.json` or the project directory name. The `compatibility_date` uses the latest date supported by your installed Miniflare version.

## The `config` option

The `config` option offers three ways to programmatically configure your Worker. You can set any property from the [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/), though some options are [ignored or replaced by Vite equivalents](https://developers.cloudflare.com/workers/vite-plugin/reference/migrating-from-wrangler-dev/#redundant-fields-in-the-wrangler-config-file).

Note

You cannot define [Cloudflare environments](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/) via `config`, as they are resolved before this option is applied.

### Configuration object

Set `config` to an object to provide values that merge with defaults and Wrangler config file settings:

vite.config.ts

```

import { defineConfig } from "vite";

import { cloudflare } from "@cloudflare/vite-plugin";


export default defineConfig({

  plugins: [

    cloudflare({

      config: {

        compatibility_date: "2025-01-01",

        vars: {

          API_URL: "https://api.example.com",

        },

      },

    }),

  ],

});


```

These values merge with Wrangler config file values, with the `config` values taking precedence.

### Dynamic configuration function

Use a function when configuration depends on existing config values or external data, or if you need to compute or conditionally set values:

vite.config.ts

```

import { defineConfig } from "vite";

import { cloudflare } from "@cloudflare/vite-plugin";


export default defineConfig({

  plugins: [

    cloudflare({

      config: (userConfig) => ({

        vars: {

          WORKER_NAME: userConfig.name,

          BUILD_TIME: new Date().toISOString(),

        },

      }),

    }),

  ],

});


```

The function receives the current configuration (defaults or loaded config file). Return an object with values to merge.

### In-place editing

A `config` function can mutate the config object directly instead of returning overrides. This is useful for deleting properties or removing array items:

vite.config.ts

```

import { defineConfig } from "vite";

import { cloudflare } from "@cloudflare/vite-plugin";


export default defineConfig({

  plugins: [

    cloudflare({

      config: (userConfig) => {

        // Replace all existing compatibility flags

        userConfig.compatibility_flags = ["nodejs_compat"];

      },

    }),

  ],

});


```

Note

When editing in place, do not return a value from the function.

## Auxiliary Workers

Auxiliary Workers also support the `config` option, enabling multi-Worker architectures without config files.

Define auxiliary Workers without config files using `config` inside the `auxiliaryWorkers` array:

vite.config.ts

```

import { defineConfig } from "vite";

import { cloudflare } from "@cloudflare/vite-plugin";


export default defineConfig({

  plugins: [

    cloudflare({

      config: {

        name: "entry-worker",

        main: "./src/entry.ts",

        compatibility_date: "2025-01-01",

        services: [{ binding: "API", service: "api-worker" }],

      },

      auxiliaryWorkers: [

        {

          config: {

            name: "api-worker",

            main: "./src/api.ts",

            compatibility_date: "2025-01-01",

          },

        },

      ],

    }),

  ],

});


```

### Configuration overrides

Combine a config file with `config` to override specific values:

vite.config.ts

```

import { defineConfig } from "vite";

import { cloudflare } from "@cloudflare/vite-plugin";


export default defineConfig({

  plugins: [

    cloudflare({

      configPath: "./wrangler.jsonc",

      auxiliaryWorkers: [

        {

          configPath: "./workers/api/wrangler.jsonc",

          config: {

            vars: {

              ENDPOINT: "https://api.example.com/v2",

            },

          },

        },

      ],

    }),

  ],

});


```

### Configuration inheritance

Auxiliary Workers receive the resolved entry Worker config in the second parameter to the `config` function. This makes it straightforward to inherit configuration from the entry Worker in auxiliary Workers.

vite.config.ts

```

import { defineConfig } from "vite";

import { cloudflare } from "@cloudflare/vite-plugin";


export default defineConfig({

  plugins: [

    cloudflare({

      auxiliaryWorkers: [

        {

          config: (_, { entryWorkerConfig }) => ({

            name: "auxiliary-worker",

            main: "./src/auxiliary-worker.ts",

            // Inherit compatibility settings from entry Worker

            compatibility_date: entryWorkerConfig.compatibility_date,

            compatibility_flags: entryWorkerConfig.compatibility_flags,

          }),

        },

      ],

    }),

  ],

});


```

## Configuration merging behavior

The `config` option uses [defu ↗](https://github.com/unjs/defu) for merging configuration objects.

* Object properties are recursively merged
* Arrays are concatenated (`config` values first, then existing values)
* Primitive values from `config` override existing values
* `undefined` values in `config` do not override existing values

```json
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"item":{"@id":"/directory/","name":"Directory"}},{"@type":"ListItem","position":2,"item":{"@id":"/workers/","name":"Workers"}},{"@type":"ListItem","position":3,"item":{"@id":"/workers/vite-plugin/","name":"Vite plugin"}},{"@type":"ListItem","position":4,"item":{"@id":"/workers/vite-plugin/reference/","name":"Reference"}},{"@type":"ListItem","position":5,"item":{"@id":"/workers/vite-plugin/reference/programmatic-configuration/","name":"Programmatic configuration"}}]}
```

---

---
title: Secrets
description: Using secrets with the Vite plugin
image: https://developers.cloudflare.com/dev-products-preview.png
---

> Documentation Index  
> Fetch the complete documentation index at: https://developers.cloudflare.com/workers/llms.txt  
> Use this file to discover all available pages before exploring further.

[Skip to content](#%5Ftop) 

# Secrets

[Secrets](https://developers.cloudflare.com/workers/configuration/secrets/) are typically used for storing sensitive information such as API keys and auth tokens. For deployed Workers, they are set via the dashboard or Wrangler CLI.

In local development, secrets can be provided to your Worker by using a [.dev.vars](https://developers.cloudflare.com/workers/configuration/secrets/#local-development-with-secrets) file. If you are using [Cloudflare Environments](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/) then the relevant `.dev.vars` file will be selected. For example, `CLOUDFLARE_ENV=staging vite dev` will load `.dev.vars.staging` if it exists and fall back to `.dev.vars`.

Note

The `vite build` command copies the relevant `.dev.vars` file to the output directory. This is only used when running `vite preview` and is not deployed with your Worker.

```json
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"item":{"@id":"/directory/","name":"Directory"}},{"@type":"ListItem","position":2,"item":{"@id":"/workers/","name":"Workers"}},{"@type":"ListItem","position":3,"item":{"@id":"/workers/vite-plugin/","name":"Vite plugin"}},{"@type":"ListItem","position":4,"item":{"@id":"/workers/vite-plugin/reference/","name":"Reference"}},{"@type":"ListItem","position":5,"item":{"@id":"/workers/vite-plugin/reference/secrets/","name":"Secrets"}}]}
```

---

---
title: Static Assets
description: Static assets and the Vite plugin
image: https://developers.cloudflare.com/dev-products-preview.png
---

> Documentation Index  
> Fetch the complete documentation index at: https://developers.cloudflare.com/workers/llms.txt  
> Use this file to discover all available pages before exploring further.

[Skip to content](#%5Ftop) 

# Static Assets

This guide focuses on the areas of working with static assets that are unique to the Vite plugin. For more general documentation, see [Static Assets](https://developers.cloudflare.com/workers/static-assets/).

## Configuration

The Vite plugin does not require that you provide the `assets` field in order to enable assets and instead determines whether assets should be included based on whether the `client` environment has been built. By default, the `client` environment is built if any of the following conditions are met:

* There is an `index.html` file in the root of your project
* `build.rollupOptions.input` or `environments.client.build.rollupOptions.input` is specified in your Vite config
* You have a non-empty [public directory ↗](https://vite.dev/guide/assets#the-public-directory)
* Your Worker [imports assets as URLs ↗](https://vite.dev/guide/assets#importing-asset-as-url)

On running `vite build`, an output `wrangler.json` configuration file is generated as part of the build output. The `assets.directory` field in this file is automatically populated with the path to your `client` build output. It is therefore not necessary to provide the `assets.directory` field in your input Worker configuration.

The `assets` configuration should be used, however, if you wish to set [routing configuration](https://developers.cloudflare.com/workers/static-assets/routing/) or enable the [assets binding](https://developers.cloudflare.com/workers/static-assets/binding/#binding). The following example configures the `not_found_handling` for a single-page application so that the fallback will always be the root `index.html` file.

* [  wrangler.jsonc ](#tab-panel-10031)
* [  wrangler.toml ](#tab-panel-10032)

JSONC

```

{

  "assets": {

    "not_found_handling": "single-page-application"

  }

}


```

TOML

```

[assets]

not_found_handling = "single-page-application"


```

## Features

The Vite plugin ensures that all of Vite's [static asset handling ↗](https://vite.dev/guide/assets) features are supported in your Worker as well as in your frontend. These include importing assets as URLs, importing as strings and importing from the `public` directory as well as inlining assets.

Assets [imported as URLs ↗](https://vite.dev/guide/assets#importing-asset-as-url) can be fetched via the [assets binding](https://developers.cloudflare.com/workers/static-assets/binding/#binding). As the binding's `fetch` method requires a full URL, we recommend using the request URL as the `base`. This is demonstrated in the following example:

TypeScript

```

import myImage from "./my-image.png";


export default {

  fetch(request, env) {

    return env.ASSETS.fetch(new URL(myImage, request.url));

  },

};


```

Assets imported as URLs in your Worker will automatically be moved to the client build output. When running `vite build` the paths of any moved assets will be displayed in the console.

Note

If you are developing a multi-Worker application, assets can only be accessed on the client and in your entry Worker.

## Headers and redirects

Custom [headers](https://developers.cloudflare.com/workers/static-assets/headers/) and [redirects](https://developers.cloudflare.com/workers/static-assets/redirects/) are supported at build, preview and deploy time by adding `_headers` and `_redirects` files to your [public directory ↗](https://vite.dev/guide/assets#the-public-directory). The paths in these files should reflect the structure of your client build output. For example, generated assets are typically located in an [assets subdirectory ↗](https://vite.dev/config/build-options#build-assetsdir).

```json
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"item":{"@id":"/directory/","name":"Directory"}},{"@type":"ListItem","position":2,"item":{"@id":"/workers/","name":"Workers"}},{"@type":"ListItem","position":3,"item":{"@id":"/workers/vite-plugin/","name":"Vite plugin"}},{"@type":"ListItem","position":4,"item":{"@id":"/workers/vite-plugin/reference/","name":"Reference"}},{"@type":"ListItem","position":5,"item":{"@id":"/workers/vite-plugin/reference/static-assets/","name":"Static Assets"}}]}
```

---

---
title: Vite Environments
description: Vite environments and the Vite plugin
image: https://developers.cloudflare.com/dev-products-preview.png
---

> Documentation Index  
> Fetch the complete documentation index at: https://developers.cloudflare.com/workers/llms.txt  
> Use this file to discover all available pages before exploring further.

[Skip to content](#%5Ftop) 

# Vite Environments

The [Vite Environment API ↗](https://vite.dev/guide/api-environment), released in Vite 6, is the key feature that enables the Cloudflare Vite plugin to integrate Vite directly with the Workers runtime. It is not necessary to understand all the intricacies of the Environment API as an end user, but it is useful to have a high-level understanding.

## Default behavior

Vite creates two environments by default: `client` and `ssr`. A front-end only application uses the `client` environment, whereas a full-stack application created with a framework typically uses the `client` environment for front-end code and the `ssr` environment for server-side rendering.

By default, when you add a Worker using the Cloudflare Vite plugin, an additional environment is created. Its name is derived from the Worker name, with any dashes replaced with underscores. This name can be used to reference the environment in your Vite config in order to apply environment specific configuration.

Note

The default Vite environment name for a Worker is always the top-level Worker name. This enables you to reference the Worker consistently in your Vite config when using multiple [Cloudflare Environments](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/).

## Environment configuration

In the following example we have a Worker named `my-worker` that is associated with a Vite environment named `my_worker`. We use the Vite config to set global constant replacements for this environment:

* [  wrangler.jsonc ](#tab-panel-10033)
* [  wrangler.toml ](#tab-panel-10034)

JSONC

```

{

  "$schema": "./node_modules/wrangler/config-schema.json",

  "name": "my-worker",

  // Set this to today's date

  "compatibility_date": "2026-05-21",

  "main": "./src/index.ts"

}


```

TOML

```

"$schema" = "./node_modules/wrangler/config-schema.json"

name = "my-worker"

# Set this to today's date

compatibility_date = "2026-05-21"

main = "./src/index.ts"


```

vite.config.ts

```

import { defineConfig } from "vite";

import { cloudflare } from "@cloudflare/vite-plugin";


export default defineConfig({

  environments: {

    my_worker: {

      define: {

        __APP_VERSION__: JSON.stringify("v1.0.0"),

      },

    },

  },

  plugins: [cloudflare()],

});


```

For more information about Vite's configuration options, see [Configuring Vite ↗](https://vite.dev/config/).

The default behavior of using the Worker name as the environment name is appropriate when you have a standalone Worker, such as an API that is accessed from your front-end application, or an [auxiliary Worker](https://developers.cloudflare.com/workers/vite-plugin/reference/api/#interface-pluginconfig) that is accessed via service bindings.

## Full-stack frameworks

If you are using the Cloudflare Vite plugin with [TanStack Start ↗](https://tanstack.com/start/) or [React Router v7 ↗](https://reactrouter.com/), then your Worker is used for server-side rendering and tightly integrated with the framework. To support this, you should assign it to the `ssr` environment by setting `viteEnvironment.name` in the plugin config.

vite.config.ts

```

import { defineConfig } from "vite";

import { cloudflare } from "@cloudflare/vite-plugin";

import { reactRouter } from "@react-router/dev/vite";


export default defineConfig({

  plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), reactRouter()],

});


```

This merges the Worker's environment configuration with the framework's SSR configuration and ensures that the Worker is included as part of the framework's build output.

```json
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"item":{"@id":"/directory/","name":"Directory"}},{"@type":"ListItem","position":2,"item":{"@id":"/workers/","name":"Workers"}},{"@type":"ListItem","position":3,"item":{"@id":"/workers/vite-plugin/","name":"Vite plugin"}},{"@type":"ListItem","position":4,"item":{"@id":"/workers/vite-plugin/reference/","name":"Reference"}},{"@type":"ListItem","position":5,"item":{"@id":"/workers/vite-plugin/reference/vite-environments/","name":"Vite Environments"}}]}
```

---

---
title: Tutorial - React SPA with an API
description: Create a React SPA with an API Worker using the Vite plugin
image: https://developers.cloudflare.com/dev-products-preview.png
---

> Documentation Index  
> Fetch the complete documentation index at: https://developers.cloudflare.com/workers/llms.txt  
> Use this file to discover all available pages before exploring further.

[Skip to content](#%5Ftop) 

# Tutorial - React SPA with an API

**Last reviewed:**  about 1 year ago 

This tutorial takes you through the steps needed to adapt a Vite project to use the Cloudflare Vite plugin. Much of the content can also be applied to adapting existing Vite projects and to front-end frameworks other than React.

Note

If you want to start a new app with a template already set up with Vite, React and the Cloudflare Vite plugin, refer to the [React framework guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/). To create a standalone Worker, refer to [Get started](https://developers.cloudflare.com/workers/vite-plugin/get-started/).

## Introduction

In this tutorial, you will create a React SPA that can be deployed as a Worker with static assets. You will then add an API Worker that can be accessed from the front-end code. You will develop, build, and preview the application using Vite before finally deploying to Cloudflare.

## Set up and configure the React SPA

### Scaffold a Vite project

Start by creating a React TypeScript project with Vite.

 npm  yarn  pnpm 

```
npm create vite@latest -- cloudflare-vite-tutorial --template react-ts
```

```
yarn create vite cloudflare-vite-tutorial --template react-ts
```

```
pnpm create vite@latest cloudflare-vite-tutorial --template react-ts
```

Next, open the `cloudflare-vite-tutorial` directory in your editor of choice.

### Add the Cloudflare dependencies

 npm  yarn  pnpm  bun 

```
npm i -D @cloudflare/vite-plugin wrangler
```

```
yarn add -D @cloudflare/vite-plugin wrangler
```

```
pnpm add -D @cloudflare/vite-plugin wrangler
```

```
bun add -d @cloudflare/vite-plugin wrangler
```

### Add the plugin to your Vite config

vite.config.ts

```

import { defineConfig } from "vite";

import react from "@vitejs/plugin-react";

import { cloudflare } from "@cloudflare/vite-plugin";


export default defineConfig({

  plugins: [react(), cloudflare()],

});


```

The Cloudflare Vite plugin doesn't require any configuration by default and will look for a `wrangler.jsonc`, `wrangler.json` or `wrangler.toml` in the root of your application.

Refer to the [API reference](https://developers.cloudflare.com/workers/vite-plugin/reference/api/) for configuration options.

### Create your Worker config file

* [  wrangler.jsonc ](#tab-panel-10035)
* [  wrangler.toml ](#tab-panel-10036)

JSONC

```

{

  "$schema": "./node_modules/wrangler/config-schema.json",

  "name": "cloudflare-vite-tutorial",

  // Set this to today's date

  "compatibility_date": "2026-05-21",

  "assets": {

    "not_found_handling": "single-page-application"

  }

}


```

TOML

```

"$schema" = "./node_modules/wrangler/config-schema.json"

name = "cloudflare-vite-tutorial"

# Set this to today's date

compatibility_date = "2026-05-21"


[assets]

not_found_handling = "single-page-application"


```

The [not\_found\_handling](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/) value has been set to `single-page-application`. This means that all not found requests will serve the `index.html` file. With the Cloudflare plugin, the `assets` routing configuration is used in place of Vite's default behavior. This ensures that your application's [routing configuration](https://developers.cloudflare.com/workers/static-assets/routing/) works the same way while developing as it does when deployed to production.

Note that the [directory](https://developers.cloudflare.com/workers/static-assets/binding/#directory) field is not used when configuring assets with Vite. The `directory` in the output configuration will automatically point to the client build output. See [Static Assets](https://developers.cloudflare.com/workers/vite-plugin/reference/static-assets/) for more information.

Note

When using the Cloudflare Vite plugin, the Worker config (for example, `wrangler.jsonc`) that you provide is the input configuration file. A separate output `wrangler.json` file is created when you run `vite build`. This output file is a snapshot of your configuration at the time of the build and is modified to reference your build artifacts. It is the configuration that is used for preview and deployment.

### Update the .gitignore file

When developing Workers, additional files are used and/or generated that should not be stored in git. Add the following lines to your `.gitignore` file:

.gitignore

```

.wrangler

.dev.vars*


```

### Run the development server

Run `npm run dev` to start the Vite development server and verify that your application is working as expected.

For a purely front-end application, you could now build (`npm run build`), preview (`npm run preview`), and deploy (`npm exec wrangler deploy`) your application. This tutorial, however, will show you how to go a step further and add an API Worker.

## Add an API Worker

### Configure TypeScript for your Worker code

 npm  yarn  pnpm  bun 

```
npm i -D @cloudflare/workers-types
```

```
yarn add -D @cloudflare/workers-types
```

```
pnpm add -D @cloudflare/workers-types
```

```
bun add -d @cloudflare/workers-types
```

tsconfig.worker.json

```

{

  "extends": "./tsconfig.node.json",

  "compilerOptions": {

    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.worker.tsbuildinfo",

    "types": ["@cloudflare/workers-types/2023-07-01", "vite/client"],

  },

  "include": ["worker"],

}


```

tsconfig.json

```

{

  "files": [],

  "references": [

    { "path": "./tsconfig.app.json" },

    { "path": "./tsconfig.node.json" },

    { "path": "./tsconfig.worker.json" },

  ],

}


```

### Add to your Worker configuration

* [  wrangler.jsonc ](#tab-panel-10037)
* [  wrangler.toml ](#tab-panel-10038)

JSONC

```

{

  "$schema": "./node_modules/wrangler/config-schema.json",

  "name": "cloudflare-vite-tutorial",

  // Set this to today's date

  "compatibility_date": "2026-05-21",

  "assets": {

    "not_found_handling": "single-page-application"

  },

  "main": "./worker/index.ts"

}


```

TOML

```

"$schema" = "./node_modules/wrangler/config-schema.json"

name = "cloudflare-vite-tutorial"

# Set this to today's date

compatibility_date = "2026-05-21"

main = "./worker/index.ts"


[assets]

not_found_handling = "single-page-application"


```

The `main` field specifies the entry file for your Worker code.

### Add your API Worker

worker/index.ts

```

export default {

  fetch(request) {

    const url = new URL(request.url);


    if (url.pathname.startsWith("/api/")) {

      return Response.json({

        name: "Cloudflare",

      });

    }


    return new Response(null, { status: 404 });

  },

} satisfies ExportedHandler;


```

The Worker above will be invoked for any non-navigation request that does not match a static asset. It returns a JSON response if the `pathname` starts with `/api/` and otherwise return a `404` response.

Note

For top-level navigation requests, browsers send a `Sec-Fetch-Mode: navigate` header. If this is present and the URL does not match a static asset, the `not_found_handling` behavior will be invoked rather than the Worker. This implicit routing is the default behavior.

If you would instead like to define the routes that invoke your Worker explicitly, you can provide an array of route patterns to [run\_worker\_first](https://developers.cloudflare.com/workers/static-assets/binding/#run%5Fworker%5Ffirst). This opts out of interpreting the `Sec-Fetch-Mode` header.

* [  wrangler.jsonc ](#tab-panel-10039)
* [  wrangler.toml ](#tab-panel-10040)

JSONC

```

{

  "$schema": "./node_modules/wrangler/config-schema.json",

  "name": "cloudflare-vite-tutorial",

  // Set this to today's date

  "compatibility_date": "2026-05-21",

  "assets": {

    "not_found_handling": "single-page-application",

    "run_worker_first": [

      "/api/*"

    ]

  },

  "main": "./worker/index.ts"

}


```

TOML

```

"$schema" = "./node_modules/wrangler/config-schema.json"

name = "cloudflare-vite-tutorial"

# Set this to today's date

compatibility_date = "2026-05-21"

main = "./worker/index.ts"


[assets]

not_found_handling = "single-page-application"

run_worker_first = [ "/api/*" ]


```

### Call the API from the client

Edit `src/App.tsx` so that it includes an additional button that calls the API and sets some state:

src/App.tsx

```

import { useState } from "react";

import reactLogo from "./assets/react.svg";

import viteLogo from "/vite.svg";

import "./App.css";


function App() {

  const [count, setCount] = useState(0);

  const [name, setName] = useState("unknown");


  return (

    <>

16 collapsed lines

      <div>

        <a href="https://vite.dev" target="_blank">

          <img src={viteLogo} className="logo" alt="Vite logo" />

        </a>

        <a href="https://react.dev" target="_blank">

          <img src={reactLogo} className="logo react" alt="React logo" />

        </a>

      </div>

      <h1>Vite + React</h1>

      <div className="card">

        <button

          onClick={() => setCount((count) => count + 1)}

          aria-label="increment"

        >

          count is {count}

        </button>

        <p>

          Edit <code>src/App.tsx</code> and save to test HMR

        </p>

      </div>

      <div className="card">

        <button

          onClick={() => {

            fetch("/api/")

              .then((res) => res.json() as Promise<{ name: string }>)

              .then((data) => setName(data.name));

          }}

          aria-label="get name"

        >

          Name from API is: {name}

        </button>

        <p>

          Edit <code>api/index.ts</code> to change the name

        </p>

      </div>

      <p className="read-the-docs">

        Click on the Vite and React logos to learn more

      </p>

    </>

  );

}


export default App;


```

Now, if you click the button, it will display 'Name from API is: Cloudflare'.

Increment the counter to update the application state in the browser. Next, edit `api/index.ts` by changing the `name` it returns to `'Cloudflare Workers'`. If you click the button again, it will display the new `name` while preserving the previously set counter value.

With Vite and the Cloudflare plugin, you can iterate on the client and server parts of your app together, without losing UI state between edits.

### Build your application

Run `npm run build` to build your application.

Terminal window

```

npm run build


```

If you inspect the `dist` directory, you will see that it contains two subdirectories:

* `client` \- the client code that runs in the browser
* `cloudflare_vite_tutorial` \- the Worker code alongside the output `wrangler.json` configuration file

### Preview your application

Run `npm run preview` to validate that your application runs as expected.

Terminal window

```

npm run preview


```

This command will run your build output locally in the Workers runtime, closely matching its behaviour in production.

### Deploy to Cloudflare

Run `npm exec wrangler deploy` to deploy your application to Cloudflare.

Terminal window

```

npm exec wrangler deploy


```

This command will automatically use the output `wrangler.json` that was included in the build output.

## Next steps

In this tutorial, we created an SPA that could be deployed as a Worker with static assets. We then added an API Worker that could be accessed from the front-end code. Finally, we deployed both the client and server-side parts of the application to Cloudflare.

Possible next steps include:

* Adding a binding to another Cloudflare service such as a [KV namespace](https://developers.cloudflare.com/kv/) or [D1 database](https://developers.cloudflare.com/d1/)
* Expanding the API to include additional routes
* Using a library, such as [Hono ↗](https://hono.dev/) or [tRPC ↗](https://trpc.io/), in your API Worker

```json
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"item":{"@id":"/directory/","name":"Directory"}},{"@type":"ListItem","position":2,"item":{"@id":"/workers/","name":"Workers"}},{"@type":"ListItem","position":3,"item":{"@id":"/workers/vite-plugin/","name":"Vite plugin"}},{"@type":"ListItem","position":4,"item":{"@id":"/workers/vite-plugin/tutorial/","name":"Tutorial - React SPA with an API"}}]}
```

---

