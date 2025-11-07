-- Fix RLS policy for contributors table to allow inserts
-- Run this in Supabase SQL Editor

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert contributors" ON contributors;

-- Create new INSERT policy that allows ALL authenticated users to insert
-- (The application logic ensures they can only insert their own records)
CREATE POLICY "Authenticated users can insert contributors" ON contributors
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
