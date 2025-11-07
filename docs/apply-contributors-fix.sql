-- Fix RLS policies for contributors table
-- Run this in your Supabase SQL Editor

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can read contributors" ON contributors;
DROP POLICY IF EXISTS "Authenticated users can insert contributors" ON contributors;
DROP POLICY IF EXISTS "Users can update contributors" ON contributors;

-- Create new policies with proper authentication
CREATE POLICY "Authenticated users can read contributors" ON contributors
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert contributors" ON contributors
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update contributors" ON contributors
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete contributors" ON contributors
  FOR DELETE
  TO authenticated
  USING (true);
