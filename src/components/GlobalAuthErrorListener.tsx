import { useEffect } from "react";
import { handleAuthError } from "@/lib/server-fn-auth";

/**
 * Listens for unhandled promise rejections and uncaught errors anywhere in
 * the app. When the failure looks like a 401/expired session from a server
 * function call, we show a "Please sign in again" toast and redirect to
 * /login instead of letting the GlobalErrorBoundary render its crash screen.
 *
 * Mounted once at the root, beneath GlobalErrorBoundary so it can pre-empt
 * the boundary by recovering before React surfaces the error.
 */
export function GlobalAuthErrorListener() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onRejection = (e: PromiseRejectionEvent) => {
      if (handleAuthError(e.reason)) {
        e.preventDefault();
      }
    };
    const onError = (e: ErrorEvent) => {
      if (handleAuthError(e.error)) {
        e.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  return null;
}
