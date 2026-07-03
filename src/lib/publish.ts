/**
 * Ask the main site to regenerate its pages so a save shows up live within
 * seconds instead of waiting for the periodic revalidation window.
 */
export async function publishSite(): Promise<{ ok: boolean; detail: string }> {
  const site = process.env.MAIN_SITE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!site || !secret) {
    return { ok: false, detail: "MAIN_SITE_URL / REVALIDATE_SECRET not set" };
  }
  try {
    const res = await fetch(
      `${site.replace(/\/$/, "")}/api/revalidate?secret=${encodeURIComponent(secret)}`,
      { method: "POST", cache: "no-store" }
    );
    return { ok: res.ok, detail: `site responded ${res.status}` };
  } catch (e) {
    return { ok: false, detail: `could not reach site: ${String(e)}` };
  }
}
