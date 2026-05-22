# React Router v7 — context7 dump

**Source:** `mcp__context7__query-docs` against library ID `/remix-run/react-router/react-router_7.9.4` (latest tagged release on context7 as of snapshot).
**Pulled:** 2026-05-22
**Query:** "React Router v7 framework mode comprehensive reference: routes.ts file route conventions, loader data loading, action mutations, Form component, useLoaderData useActionData hooks, redirect responses, route module exports (meta links headers ErrorBoundary HydrateFallback clientLoader clientAction shouldRevalidate), navigation (Link NavLink Navigate useNavigate useNavigation), pending UI suspense, sessions cookies, error boundaries, Cloudflare Workers deployment with @cloudflare/vite-plugin, vite plugin configuration react-router.config.ts, type safety with .react-router/types, server rendering vs SPA mode, SSR streaming defer, file route conventions flat routes"

> Snippets concatenated verbatim from context7. Use this as a "best of" code-sample index. For full prose, see the per-file scrapes in this folder (e.g. `start__framework__routing.md`).

---

### Replace React Router Lazy Loaders with File Loaders (TypeScript Diff)

Source: https://github.com/remix-run/react-router/blob/react-router@7.9.4/docs/upgrading/router-provider.md

This diff updates the `routes.ts` file to replace `lazy` loader functions with direct `file` paths to component modules. This change leverages the React Router Vite plugin's file-based routing convention, simplifying route configuration and improving build performance. Each `lazy` import is swapped for a `file` property pointing to the component's path.

```diff
export default [
  {
    path: "/",
-   lazy: () => import("./routes/layout").then(convert),
+   file: "./routes/layout.tsx",
    children: [
      {
        index: true,
-       lazy: () => import("./routes/home").then(convert),
+       file: "./routes/home.tsx",
      },
      {
        path: "about",
-       lazy: () => import("./routes/about").then(convert),
+       file: "./routes/about.tsx",
      },
      {
        path: "todos",
-       lazy: () => import("./routes/todos").then(convert),
+       file: "./routes/todos.tsx",
        children: [
          {
            path: ":id",
-           lazy: () => import("./routes/todo").then(convert),
+           file: "./routes/todo.tsx",
          }
        ]
      }
    ]
  }
] satisfies RouteConfig;
```

--------------------------------

### Define Type-Safe Routes in React Router Framework Mode (TypeScript)

Source: https://github.com/remix-run/react-router/blob/react-router@7.9.4/docs/start/modes.md

This snippet shows how to define type-safe routes using the React Router Framework Mode's `routes.ts` file. It utilizes `index` and `route` functions to declare application paths and associated components, enabling features like intelligent code splitting and various rendering strategies.

```ts
import { index, route } from "@react-router/dev/routes";

export default [
  index("./home.tsx"),
  route("products/:pid", "./product.tsx"),
];
```

--------------------------------

### Implement type-safe React Router loader and action data with TypeScript

Source: https://context7.com/remix-run/react-router/llms.txt

This example illustrates how to achieve type-safe data handling for loaders and actions in React Router using TypeScript. It defines `LoaderFunctionArgs` and `ActionFunctionArgs` types and shows how `useLoaderData` and `useActionData` automatically infer types from the respective functions, improving code reliability and developer experience.

```tsx
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router-dom";
import { useLoaderData, useActionData } from "react-router-dom";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

async function loader({ params }: LoaderFunctionArgs) {
  const todos = await db.todo.findMany();
  return { todos };
}

async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const title = formData.get("title") as string;

  if (!title) {
    return { error: "Title is required" };
  }

  const todo = await db.todo.create({ data: { title } });
  return { todo };
}

function TodosPage() {
  // Type inferred from loader return type
  const { todos } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div>
      {actionData?.error && <p>{actionData.error}</p>}
      {actionData?.todo && <p>Created: {actionData.todo.title}</p>}

      <ul>
        {todos.map(todo => (
          <li key={todo.id}>{todo.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

--------------------------------

### Implement Route Loader and Component in React Router Framework Mode (TypeScript/TSX)

Source: https://github.com/remix-run/react-router/blob/react-router@7.9.4/docs/start/modes.md

This example demonstrates implementing a route module within React Router's Framework Mode. It defines an asynchronous `loader` function to fetch data based on URL parameters and a React component that accesses this `loaderData` for rendering, leveraging the type-safe Route Module API.

```tsx
import { Route } from "./+types/product.tsx";

export async function loader({ params }: Route.LoaderArgs) {
  let product = await getProduct(params.pid);
  return { product };
}

export default function Product({
  loaderData,
}: Route.ComponentProps) {
  return <div>{loaderData.product.name}</div>;
}
```

--------------------------------

### React Router Module Exports and HMR Compatibility

Source: https://github.com/remix-run/react-router/blob/react-router@7.9.4/docs/explanation/hot-module-replacement.md

This example distinguishes between route module exports that are automatically handled by the React Router Vite plugin for HMR compatibility (e.g., `meta`, `links`, `headers`, `loader`, `action`) and user-defined exports (like `myValue`) that are not component exports and will trigger a full page reload.

```tsx
// These exports are handled by the React Router Vite plugin
// to be HMR-compatible
export const meta = { title: "Home" }; // ✅
export const links = [
  { rel: "stylesheet", href: "style.css" },
]; // ✅

// These exports are removed by the React Router Vite plugin
// so they never affect HMR
export const headers = { "Cache-Control": "max-age=3600" }; // ✅
export const loader = async () => {}; // ✅
export const action = async () => {}; // ✅

// This is not a route module export, nor a component export,
// so it will cause a full reload for this route
export const myValue = "some value"; // ❌

export default function Route() {} // ✅
```
