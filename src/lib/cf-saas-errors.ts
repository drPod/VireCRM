/**
 * Shared error helpers for Cloudflare for SaaS server fns.
 *
 * The custom-hostname server fns throw a sentinel Error when
 * `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ZONE_ID` are unset (operator hasn't
 * finished CF dashboard setup). Callers detect that and degrade gracefully
 * instead of surfacing a hard failure.
 *
 * Why message-string detection: TanStack Start serializes thrown Error
 * objects across the wire (Error.message + Error.name survive), but turns
 * thrown Response into a generic 500 "HTTPError" envelope that drops both
 * the status code and the body. The wire contract is therefore the message
 * string, kept in sync with `CF_NOT_CONFIGURED_MESSAGE` in
 * `src/functions/custom-hostnames.functions.ts`.
 */

const CF_NOT_CONFIGURED_MESSAGE = "CF for SaaS not configured";

export function isNotConfigured(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes(CF_NOT_CONFIGURED_MESSAGE);
}

export function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
