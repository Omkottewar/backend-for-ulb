import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// Supabase client — lazy singleton
//
// Uses the SERVICE ROLE KEY (not the anon key) because server-side uploads
// need to bypass RLS policies. The client is created on first use so that
// endpoints which don't need Supabase continue to work even if the env
// vars are not yet set.
// ─────────────────────────────────────────────────────────────────────────────

/** @type {string} Name of the Supabase Storage bucket for all uploads. */
export const STORAGE_BUCKET = "file-uploads";

/** @type {import("@supabase/supabase-js").SupabaseClient | null} */
let _client = null;

/**
 * Returns the shared Supabase client instance.
 * Throws at call time (not import time) if env vars are missing.
 *
 * @returns {import("@supabase/supabase-js").SupabaseClient}
 */
export const getSupabase = () => {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. " +
        "Add them to your .env file."
      );
    }

    _client = createClient(url, key);
  }

  return _client;
};