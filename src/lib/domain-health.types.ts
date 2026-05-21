/**
 * Shared client-side types for the domain-health panel suite.
 *
 * Server-side types (DomainHealthResult, DomainHealthIssue) live next to the
 * server fn in `src/functions/domain-health.functions.ts`. This file owns
 * UI-only discriminators that the panel components share.
 */

export type CfStatusKind =
  | "loading"
  | "active"
  | "ssl"
  | "verifying"
  | "failed"
  | "unprovisioned"
  | "unconfigured"
  | "error";

export interface CfStatusClassification {
  kind: CfStatusKind;
  label: string;
}
