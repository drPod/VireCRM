// TanStack Start entrypoint. Auto-resolved by the start plugin as
// `#tanstack-start-entry`; no manual import needed in router or server.
//
// Registers `attachAuth` as a global function middleware so every server
// function call automatically gets `Authorization: Bearer <token>` from the
// client. Server-side `requireAuth` still validates the token per-request.
import { createStart } from "@tanstack/react-start";
import { attachAuth } from "@/auth/client";

export const startInstance = createStart(() => ({
  functionMiddleware: [attachAuth],
}));
