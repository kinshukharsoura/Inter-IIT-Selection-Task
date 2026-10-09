import { tokenStorage } from '../auth/tokenStorage';

/** Base URL of the API. Defaults to same-origin `/api` (Vite proxy in dev, nginx in Docker). */
export const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type UnauthorizedListener = () => void;
let onUnauthorized: UnauthorizedListener | null = null;

/** Registered by the AuthProvider so an expired token logs the user out everywhere. */
export function setUnauthorizedListener(listener: UnauthorizedListener | null): void {
  onUnauthorized = listener;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
}

/**
 * Typed fetch wrapper: attaches the JWT, unwraps the `{ success, data }`
 * envelope and turns error envelopes into `ApiError`s.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = tokenStorage.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }

  const payload = (await response.json().catch(() => null)) as
    { success: true; data: T } | { success: false; message: string; errors?: unknown } | null;

  if (!response.ok || !payload || payload.success !== true) {
    if (response.status === 401 && token) onUnauthorized?.();
    const message =
      payload && 'message' in payload && payload.message
        ? payload.message
        : `Request failed (${response.status})`;
    throw new ApiError(
      response.status,
      message,
      payload && 'errors' in payload ? payload.errors : undefined,
    );
  }
  return payload.data;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}
