import { createClient } from '@supabase/supabase-js'
import { Database } from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qnkezzhrhbosekxhfqzo.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFua2V6emhyaGJvc2VreGhmcXpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0MzczNzEsImV4cCI6MjA3ODAxMzM3MX0.uuqw82a1m2THtHEvyZ4YYY8uDq9a8FCS-FzCq48BuxI'

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)