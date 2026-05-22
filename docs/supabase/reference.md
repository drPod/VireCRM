# Supabase JS reference — auth, JWT, RLS, SSR

> Source: context7 MCP, queried 2026-05-22.
> Libraries: `/supabase/supabase-js` (v2.58.0), `/supabase/ssr`.
> Regenerate via `mcp__context7__query-docs` — see `scripts/sync-supabase-docs.sh` TODO.

---

## `@supabase/supabase-js` — `createClient`

Source: https://github.com/supabase/supabase-js/blob/master/packages/core/supabase-js/README.md

Initialize a Supabase client by importing `createClient` and providing your project URL and publishable key. Standard way to connect to your Supabase database.

```js
import { createClient } from '@supabase/supabase-js'

// Create a single supabase client for interacting with your database
const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key')
```

---

## `getUser(jwt?)` — server-side verification

Source: https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueClient.ts

`getUser()` accepts an optional JWT token parameter, enabling server-side authentication without relying on stored session state. Essential for SSR where you pass a JWT from headers or cookies.

```typescript
async getUser(jwt?: string): Promise<UserResponse> {
  if (jwt) {
    return await this._getUser(jwt)
  }

  await this.initializePromise

  const result = await this._acquireLock(this.lockAcquireTimeout, async () => {
    return await this._getUser()
  })

  if (result.data.user) {
    this.suppressGetSessionWarning = true
  }

  return result
}

/**
 * @example Get the logged in user with a custom access token jwt
 * ```js
 * const { data: { user } } = await supabase.auth.getUser(jwt)
 * ```
 */
```

---

## `skipAutoInitialize` — SSR control

Source: https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/lib/types.ts

The `skipAutoInitialize` option allows SSR applications to control initialization timing, preventing race conditions with HTTP response generation. Crucial for server-side rendering where automatic initialization in the constructor could cause timing issues.

```typescript
/**
 * If true, skips automatic initialization in constructor. Useful for SSR
 * contexts where initialization timing must be controlled to prevent race
 * conditions with HTTP response generation.
 *
 * @default false
 */
skipAutoInitialize?: boolean
```

---

## Storage — `createSignedUrl`

Source: https://github.com/supabase/supabase-js/blob/master/packages/core/storage-js/README.md

Creates a signed URL for a file, allowing temporary access without requiring permissions.

```
## storageClient.from(bucketName).createSignedUrl(path, expireIn)

### Description
Creates a signed URL for a file, allowing temporary access without requiring permissions.

### Method
`createSignedUrl`

### Arguments
- bucketName (string) Required — name of the bucket.
- path (string) Required — path of the file to create a signed URL for.
- expireIn (number) Required — expiration time for the URL in seconds.

### Request Example
const expireIn = 60
const { data, error } = await storageClient
  .from('bucket')
  .createSignedUrl('path/to/file', expireIn)

### Response
Returns { data: { signedUrl }, error }.
```

---

## RSA signing keys — test infra

Source: https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/test/README.md

The auth-js tests require RSA signing keys to verify RS256 JWT tokens. These keys are never committed to the repository for security reasons. Keys are automatically generated before tests run locally via `nx test:auth auth-js` or `nx test:docker auth-js` commands, and in CI environments, GitHub Actions generates fresh keys before each test run. Manually generate keys by running `node generate-signing-keys.js` in the `packages/core/auth-js/test` directory — creates a `test/supabase/signing_keys.json` file that is gitignored.

---

## `@supabase/ssr` — `createServerClient`

Source: https://github.com/supabase/ssr/blob/main/_apirefdocs/api-reference/create-server-client.md

Creates a Supabase client instance specifically designed for server-side rendering (SSR) environments. Wires the client to an internal storage adapter and an auth-state listener, managing authentication state and cookie interactions.

### Parameters
- **supabaseUrl** (string) — Required — URL of your Supabase project.
- **supabaseKey** (string) — Required — Supabase publishable API key.
- **options** (object) — Required — Configuration options for the client.
  - **options.cookies** (object) — Required — object defining cookie handling methods.
    - **options.cookies.getAll()** — Required — returns an array of all cookies as `{ name: string; value: string }[]`.
    - **options.cookies.setAll(setCookies, headers)** — Optional — handles setting cookies. `setCookies` is `{ name; value; options: Record<string, unknown> }[]`. `headers` is an object containing response headers.
  - **options.cookieOptions** (object) — Optional — options for the client cookies.
    - **options.cookieOptions.name** — name of the authentication token cookie.
    - **options.cookieOptions.path** — path for the cookie.
    - **options.cookieOptions.sameSite** — SameSite attribute for the cookie (e.g. "lax").

### Return type
`SupabaseClient<Database, SchemaName>` — initialized Supabase client instance.

### Throws
- `Error` if `supabaseUrl` is falsy.
- `Error` if `supabaseKey` is falsy.
- `Error` if `options.cookies` is missing entirely.
- `Error` if `options.cookies` contains neither `get` nor `getAll`.

### Warnings
- `console.warn` emitted if deprecated server cookies provide `get` but not both `set` and `remove`, and the client later needs to write cookies.
- `console.warn` emitted if preferred server cookies provide `getAll` but omit `setAll`, and the client later needs to write cookies.

### Usage example

```ts
import { createServerClient } from "@supabase/ssr";

export function createSupabaseForRequest(requestCookies: {
  getAll(): { name: string; value: string }[];
}) {
  const responseHeaders = new Headers();
  const cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return requestCookies.getAll();
        },
        setAll(setCookies, headers) {
          setCookies.forEach((cookie) => {
            cookiesToSet.push(cookie);
          });
          Object.entries(headers).forEach(([key, value]) => {
            responseHeaders.set(key, value);
          });
        }
      },
      cookieOptions: {
        name: "sb-app-auth-token",
        path: "/",
        sameSite: "lax"
      }
    }
  );

  return { supabase, responseHeaders, cookiesToSet };
}

const { supabase } = createSupabaseForRequest({
  getAll: () => []
});

await supabase.auth.getUser();
```

---

## `@supabase/ssr` — Remix integration

Source: https://context7.com/supabase/ssr/llms.txt

Use `createServerClient` to handle cookie-based sessions in Remix loaders and actions. Implementation ensures headers are correctly updated for session persistence.

```typescript
// app/utils/supabase.server.ts
import { createServerClient } from '@supabase/ssr'
import { parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'

export function createSupabaseClient(request: Request) {
  const headers = new Headers()
  const cookies = parseCookieHeader(request.headers.get('Cookie') || '')

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookies,
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            headers.append('Set-Cookie', serializeCookieHeader(name, value, options))
          })
        }
      }
    }
  )

  return { supabase, headers }
}

// app/routes/_index.tsx
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { createSupabaseClient } from '~/utils/supabase.server'

export async function loader({ request }: LoaderFunctionArgs) {
  const { supabase, headers } = createSupabaseClient(request)

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return json({ user: null, posts: [] }, { headers })
  }

  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .eq('user_id', user.id)

  return json({ user, posts }, { headers })
}
```

---

## `@supabase/ssr` — Next.js integration

Source: https://context7.com/supabase/ssr/llms.txt

Initialize the server client for Next.js Middleware, Server Components, and Route Handlers. Requires explicit cookie handlers to manage session state across different server environments.

```typescript
import { createServerClient } from '@supabase/ssr'

// Next.js Middleware example
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => {
          return request.cookies.getAll().map(cookie => ({
            name: cookie.name,
            value: cookie.value
          }))
        },
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        }
      }
    }
  )

  // Refresh session if expired — required for Server Components
  const { data: { user } } = await supabase.auth.getUser()

  // Protect routes
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

// Next.js Server Component example
// app/page.tsx
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export default async function Page() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        // setAll omitted - cookies cannot be set from Server Components
      }
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  return <div>Hello {user?.email}</div>
}

// Next.js Route Handler example
// app/api/user/route.ts
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function GET() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        }
      }
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ user })
}
```

---

## `@supabase/ssr` — SvelteKit integration

Source: https://context7.com/supabase/ssr/llms.txt

Configure SvelteKit `hooks.server.ts` to initialize `createServerClient` with cookie management and session refresh. Attach supabase client and session to `event.locals` for use in load functions.

```typescript
// src/hooks.server.ts
import { createServerClient } from '@supabase/ssr'
import type { Handle } from '@sveltejs/kit'

export const handle: Handle = async ({ event, resolve }) => {
  const supabase = createServerClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => event.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            event.cookies.set(name, value, {
              ...options,
              path: options.path ?? '/'
            })
          })
        }
      }
    }
  )

  // Refresh session
  const { data: { session } } = await supabase.auth.getSession()

  event.locals.supabase = supabase
  event.locals.session = session

  return resolve(event)
}
```

---

## `@supabase/ssr` — `createBrowserClient`

Source: https://context7.com/supabase/ssr/llms.txt

Utilize `createBrowserClient` for managing user sessions, OAuth redirects, and auth state listeners. Always use `getUser()` for secure server-side authorization checks.

```typescript
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  'https://your-project.supabase.co',
  'your-anon-key'
)

// Email/Password Sign Up
async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`
    }
  })

  if (error) {
    console.error('Sign up error:', error.message)
    return null
  }

  return data.user
}

// Email/Password Sign In
async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    console.error('Sign in error:', error.message)
    return null
  }

  return data.session
}

// OAuth Sign In (Google, GitHub, etc.)
async function signInWithOAuth(provider: 'google' | 'github' | 'discord') {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  })

  if (error) {
    console.error('OAuth error:', error.message)
  }

  // User will be redirected to OAuth provider
}

// Sign Out
async function signOut() {
  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('Sign out error:', error.message)
  }

  // Session cookies will be cleared automatically
  window.location.href = '/login'
}

// Get verified user (recommended for authorization)
async function getVerifiedUser() {
  // getUser() contacts Auth server - use for authorization decisions
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

// Get session from cookies (NOT verified - don't use for authorization)
async function getSessionFromCookies() {
  // getSession() reads directly from cookies without verification
  // The user object is NOT verified - could be spoofed
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// Listen to auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth event:', event)

  switch (event) {
    case 'SIGNED_IN':
      console.log('User signed in:', session?.user.email)
      break
    case 'SIGNED_OUT':
      console.log('User signed out')
      window.location.href = '/login'
      break
    case 'TOKEN_REFRESHED':
      console.log('Token refreshed')
      break
    case 'USER_UPDATED':
      console.log('User updated:', session?.user)
      break
  }
})
```

---

## `getSession()` vs `getUser()` vs `getClaims()`

Source: https://github.com/supabase/ssr/blob/main/README.md

- **`getClaims()`** validates the access token, either locally using the project's JWKS endpoint or by calling the Auth server, and returns the verified JWT claims. Use it when you need to gate access to resources but do not require a fresh user record from the database.
- **`getSession()`** retrieves the session directly from cookies without making a network call. The user object it contains is **not verified** by the Auth server and **must not** be used for authorization decisions, as a malicious client could craft a cookie with a spoofed user ID.
- **`getUser()`** contacts the Supabase Auth server on every call to return the most up-to-date user record. Includes any changes made since the token was issued, making it suitable for checking current roles, email, or whether the session is still active server-side.

For server components where cookies cannot be set, always rely on middleware to handle session updates. Use `getUser()` for authorization decisions as it contacts the Auth server for verification, while `getSession()` reads unverified data directly from cookies and should only be used for non-sensitive display purposes.
