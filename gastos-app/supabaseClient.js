const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (process.env.NODE_ENV === "production" && (!SUPABASE_URL || !SUPABASE_ANON_KEY)) {
  throw new Error(
    "Supabase credentials are not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY."
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

module.exports = supabase;

