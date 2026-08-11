export interface ClientEnv {
  supabaseUrl: string;
  supabasePublishableKey: string;
}

declare global {
  interface Window {
    __ENV__?: ClientEnv;
  }
}

// Injected by the root Layout from the server loader (Worker vars).
export function clientEnv(): ClientEnv {
  if (typeof window === "undefined" || !window.__ENV__) {
    throw new Error("clientEnv() is browser-only and requires window.__ENV__");
  }
  return window.__ENV__;
}
