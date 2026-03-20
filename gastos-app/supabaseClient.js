const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (process.env.NODE_ENV === "production" && (!SUPABASE_URL || !SUPABASE_ANON_KEY)) {
  throw new Error(
    "Supabase credentials are not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY."
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const supabaseAdmin =
  SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })
    : null;

module.exports = supabase;
module.exports.supabaseAdmin = supabaseAdmin;
module.exports.SUPABASE_URL = SUPABASE_URL;
module.exports.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

