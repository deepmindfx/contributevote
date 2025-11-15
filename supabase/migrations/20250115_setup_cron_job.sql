-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the edge function to run every hour
-- This will process recurring contributions, scheduled contributions, and refund voting deadlines
SELECT cron.schedule(
  'process-scheduled-contributions',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
      url := 'https://qnkezzhrhbosekxhfqzo.supabase.co/functions/v1/process-scheduled-contributions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- View all scheduled cron jobs
-- SELECT * FROM cron.job;

-- To unschedule this job later (if needed), run:
-- SELECT cron.unschedule('process-scheduled-contributions');
