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

/** Outcome of a publishSite() round-trip, echoed by every mutating route. */
export type Publish = { ok: boolean; detail: string; at: string };

/**
 * The ONE save-toast vocabulary. A save is only fully good news when the
 * live site also picked it up — otherwise the toast warns instead.
 */
export function saveMsg(publish?: Publish): {
  text: string;
  tone: "ok" | "warn";
} {
  if (publish && publish.ok === false) {
    return {
      text: "Saved — but the live site didn't update. Retry from Dashboard.",
      tone: "warn",
    };
  }
  return { text: "Saved · Live ✓", tone: "ok" };
}
