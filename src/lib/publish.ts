import { sb } from "./db";

/**
 * Ask the main site to regenerate its pages so a save shows up live within
 * seconds instead of waiting for the periodic revalidation window.
 *
 * Never throws. The outcome (ok / human-readable reason / timestamp) is
 * returned to the caller AND best-effort persisted to site_settings under
 * `last_publish`, so the Dashboard can always show whether the live site
 * matches the latest saves.
 */
export async function publishSite(): Promise<{
  ok: boolean;
  detail: string;
  at: string;
}> {
  const at = new Date().toISOString();
  const site = process.env.MAIN_SITE_URL;
  const secret = process.env.REVALIDATE_SECRET;

  let result: { ok: boolean; detail: string; at: string };
  if (!site || !secret) {
    result = {
      ok: false,
      detail: "Publishing not configured (MAIN_SITE_URL / REVALIDATE_SECRET)",
      at,
    };
  } else {
    try {
      const res = await fetch(`${site.replace(/\/$/, "")}/api/revalidate`, {
        method: "POST",
        cache: "no-store",
        headers: { "x-revalidate-secret": secret },
      });
      if (res.ok) {
        result = { ok: true, detail: "", at };
      } else if (res.status === 401 || res.status === 403) {
        result = { ok: false, detail: "Rejected (check REVALIDATE_SECRET)", at };
      } else {
        result = { ok: false, detail: `Site responded ${res.status}`, at };
      }
    } catch {
      result = { ok: false, detail: "Site unreachable", at };
    }
  }

  // Best-effort record for the Dashboard's status card — mirrors the settings
  // route's upsert so the row self-creates even without a seed migration.
  try {
    await sb()
      .from("site_settings")
      .upsert(
        {
          key: "last_publish",
          value: JSON.stringify(result),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );
  } catch {
    /* recording is best-effort — never fail the save because of it */
  }

  return result;
}
