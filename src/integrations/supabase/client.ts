import { createClient } from '@supabase/supabase-js'
import { Database } from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://sivvjwffekhfabgxhbcd.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdnZqd2ZmZWtoZmFiZ3hoYmNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNzIyNjIsImV4cCI6MjA5Nzk0ODI2Mn0.fE-yAXe9WYsg2O9o1tqcCbxVMp8bsCGUd2xC0Y8ccNc'

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)