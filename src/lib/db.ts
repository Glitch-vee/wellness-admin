import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export { TABLES, sanitizeRow } from "./schema";
export type { FieldSpec, TableSpec } from "./schema";

let client: SupabaseClient | null = null;

/** Server-only Supabase client using the service-role key (bypasses RLS). */
export function sb(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars"
      );
    }
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
