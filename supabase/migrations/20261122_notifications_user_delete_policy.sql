-- Allow authenticated users to delete/clear their own notifications cleanly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'Users can delete their own notifications'
  ) THEN
    CREATE POLICY "Users can delete their own notifications"
      ON public.notifications
      FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END
$$;
