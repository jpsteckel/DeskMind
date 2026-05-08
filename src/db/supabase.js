import { createClient } from '@supabase/supabase-js';

/**
 * Singleton Supabase client for server-side use.
 * Uses the service role key so it bypasses Row Level Security —
 * never expose this key to the client/browser.
 */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default supabase;