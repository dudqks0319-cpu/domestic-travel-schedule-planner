import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseServiceKey);

if (!hasSupabaseConfig) {
  console.warn(
    "[database] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. " +
    "Supabase-backed endpoints will use fallback behavior until configured."
  );
}

type SupabaseClient = ReturnType<typeof createClient>;

function createUnavailableClient(): SupabaseClient {
  const error = new Error(
    "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable DB endpoints."
  );

  return new Proxy(
    {},
    {
      get() {
        throw error;
      },
    }
  ) as SupabaseClient;
}

export const supabase: SupabaseClient = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : createUnavailableClient();
