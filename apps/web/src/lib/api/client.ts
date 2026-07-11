import type { ErrorCode, ErrorEnvelope } from '@careerstack/contracts';

/**
 * Base URL of the API. Points at the versioned `/api/v1` surface. Configurable
 * via `NEXT_PUBLIC_API_URL` (defaults to the local API).
 */
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'
).replace(/\/$/, '');

/** Readable CSRF cookie name (double-submit pattern; matches the API). */
const CSRF_COOKIE_NAME = 'cs_csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Structured error thrown by {@link apiFetch} when the API returns an error. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | 'NETWORK' | 'UNKNOWN';
  readonly requestId: string | undefined;
  readonly details: ReadonlyArray<{ path?: string | undefined; message: string }>;

  constructor(
    status: number,
    code: ApiError['code'],
    message: string,
    requestId?: string,
    details: ApiError['details'] = [],
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }

  /** True when the caller is not authenticated (drives redirect-to-signin). */
  get isUnauthorized(): boolean {
    return this.status === 401 || this.code === 'UNAUTHORIZED';
  }
}

/** Read a cookie value in the browser (used for the CSRF double-submit token). */
function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  /** JSON body; serialized automatically with the correct content-type. */
  json?: unknown;
  /** Query parameters appended to the path. */
  query?: Record<string, string | number | boolean | undefined>;
}

function buildUrl(path: string, query?: ApiFetchOptions['query']): string {
  const url = new URL(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Typed fetch wrapper for the CareerStack API.
 *
 * - Sends credentials (session cookie) on every request.
 * - Echoes the CSRF token header on state-changing requests (double-submit).
 * - Parses the standard error envelope into a typed {@link ApiError}.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { json, query, headers, method = 'GET', ...rest } = options;

  const finalHeaders = new Headers(headers);
  finalHeaders.set('accept', 'application/json');

  let body: BodyInit | undefined;
  if (json !== undefined) {
    finalHeaders.set('content-type', 'application/json');
    body = JSON.stringify(json);
  }

  if (MUTATING_METHODS.has(method.toUpperCase())) {
    const csrf = readCookie(CSRF_COOKIE_NAME);
    if (csrf) finalHeaders.set(CSRF_HEADER_NAME, csrf);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      credentials: 'include',
      headers: finalHeaders,
      ...(body !== undefined ? { body } : {}),
      ...rest,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Unable to reach the server. Check your connection.');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const isJson = response.headers.get('content-type')?.includes('application/json') ?? false;
  const payload: unknown = isJson ? await response.json().catch(() => undefined) : undefined;

  if (!response.ok) {
    const envelope = payload as Partial<ErrorEnvelope> | undefined;
    const err = envelope?.error;
    throw new ApiError(
      response.status,
      err?.code ?? 'UNKNOWN',
      err?.message ?? `Request failed with status ${response.status}.`,
      err?.requestId,
      err?.details ?? [],
    );
  }

  return payload as T;
}
