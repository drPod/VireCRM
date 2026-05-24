// postgres-js throws `PostgresError` with `.code` (SQLSTATE) + `.constraint_name`.
// Drizzle wraps it in `DrizzleQueryError` with `.cause` pointing at the original.
// Walk the cause chain so callers can match on SQLSTATE without caring which
// layer wrapped the failure.

export function isUniqueViolation(err: unknown, constraintName?: string): boolean {
  let cur: unknown = err;
  while (cur && typeof cur === "object") {
    const e = cur as { code?: unknown; constraint_name?: unknown; cause?: unknown };
    if (e.code === "23505") {
      if (!constraintName) return true;
      return e.constraint_name === constraintName;
    }
    cur = e.cause;
  }
  return false;
}
