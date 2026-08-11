import { getAccessToken, supabase } from "./supabase";

// Worker error envelope: { error: { code, message, details? }, requestId }.
export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
  requestId: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly requestId: string | null;

  constructor(status: number, body: ApiErrorBody | null) {
    super(body?.error.message ?? `Request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.code = body?.error.code ?? "UNKNOWN";
    this.details = body?.error.details;
    this.requestId = body?.requestId ?? null;
  }

  // Zod-flatten details from a 400 VALIDATION response, if that's what this is.
  get fieldErrors(): Record<string, string[]> {
    const d = this.details as { fieldErrors?: Record<string, string[]> } | undefined;
    return d?.fieldErrors ?? {};
  }

  get formErrors(): string[] {
    const d = this.details as { formErrors?: string[] } | undefined;
    return d?.formErrors ?? [];
  }
}

async function parseErrorBody(res: Response): Promise<ApiErrorBody | null> {
  try {
    return (await res.json()) as ApiErrorBody;
  } catch {
    return null;
  }
}

interface ApiFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

export async function apiFetch<T>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(path, {
    method: opts.method ?? "GET",
    signal: opts.signal,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401) {
    // Session expired mid-use (the app layout gates on a live session before
    // loaders run). Clear it and start over at the login screen.
    await supabase().auth.signOut();
    window.location.assign("/login");
    throw new ApiError(401, await parseErrorBody(res));
  }

  if (res.status === 204) return undefined as T;

  if (!res.ok) {
    throw new ApiError(res.status, await parseErrorBody(res));
  }
  return (await res.json()) as T;
}
