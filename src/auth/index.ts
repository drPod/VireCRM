// Barrel for the consolidated auth module. New code should prefer:
//   import { requireAuth } from "@/auth/server";       // server-fn middleware
//   import { attachAuth } from "@/auth/client";        // client-fn middleware (registered globally in src/start.ts)
//   import { handleAuthError } from "@/auth/errors";   // catch-block helper
// The barrel re-exports them all in one go for convenience.
export * from "./server";
export * from "./client";
export * from "./errors";
