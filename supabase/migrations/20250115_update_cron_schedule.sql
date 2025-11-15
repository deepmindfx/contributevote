-- Unschedule the old hourly job
SELECT cron.unschedule('process-scheduled-contributions');

-- Schedule to run every 15 minutes for recurring and scheduled contributions
SELECT cron.schedule(
  'process-scheduled-contributions',
  '*/15 * * * *', -- Every 15 minutes
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

-- Add a separate hourly job just for deadline checks (less urgent)
SELECT cron.schedule(
  'check-refund-deadlines',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
      url := 'https://qnkezzhrhbosekxhfqzo.supabase.co/functions/v1/process-scheduled-contributions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object('deadlines_only', true)
    ) as request_id;
  $$
);

-- View all scheduled cron jobs
-- SELECT jobid, jobname, schedule, active FROM cron.job;
