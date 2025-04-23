
import { createClient } from '@supabase/supabase-js';

// Supabase client - make sure you use public anon key
const supabaseUrl = 'https://nvinapqmcmbpyjpwpgms.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52aW5hcHFtY21icHlqcHdwZ21zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MDgxNTMsImV4cCI6MjA2MDk4NDE1M30.RUlNI5Yweh9OY1LZPASlwejPoCGOeeTucK5IfYZTJdQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true
  }
});
