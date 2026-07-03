"use client";

/** Tiny fetch wrapper for the admin API — throws readable errors. */
export async function api<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const res = await fetch(url, {
    ...init,
    headers: isForm
      ? init?.headers
      : { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || `Request failed (${res.status})`
    );
  }
  return data as T;
}
