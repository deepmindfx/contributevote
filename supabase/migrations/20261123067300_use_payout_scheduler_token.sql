BEGIN;

CREATE FUNCTION public.enqueue_collectipay_scheduled_worker(p_worker text,p_body jsonb)
RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT net.http_post(
    url := rtrim(cfg.decrypted_secret,'/') || '/functions/v1/' || p_worker,
    headers := jsonb_build_object('Content-Type','application/json','x-collectipay-scheduler-token',tok.decrypted_secret),
    body := p_body,
    timeout_milliseconds := 105000
  )
  FROM vault.decrypted_secrets cfg CROSS JOIN vault.decrypted_secrets tok
  WHERE cfg.name='collectipay_push_worker_base_url' AND tok.name='collectipay_scheduler_token'
    AND p_worker IN ('reconcile-bank-payouts','process-scheduled-contributions')
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.enqueue_collectipay_scheduled_worker(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.wake_payout_reconciliation()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_request bigint;
BEGIN
  v_request := public.enqueue_collectipay_scheduled_worker('reconcile-bank-payouts','{}');

  -- Notify staff at most once an hour while a check or a dispatched payout is overdue.
  UPDATE public.payout_reconciliation_health h SET last_alert_at=clock_timestamp()
  WHERE h.singleton AND (h.last_alert_at IS NULL OR h.last_alert_at<now()-interval '1 hour')
    AND (
      coalesce(h.last_finished_at,h.created_at)<now()-interval '3 minutes'
      OR EXISTS (SELECT FROM public.transactions WHERE type='transfer' AND status='pending'
        AND metadata->>'pricing_reserved'='true' AND metadata ? 'dispatched_at'
        AND created_at<now()-interval '5 minutes')
    );
  IF FOUND THEN
    INSERT INTO public.notifications(user_id,type,title,message)
      SELECT id,'payout_reconciliation_attention','Bank payouts need review',
        'Check payout reconciliation in Super Admin under Gateway.' FROM public.profiles
      WHERE role='admin' AND coalesce(status,'active')='active';
  END IF;
  RETURN v_request;
END;
$$;

DO $jobs$
DECLARE v_job record;
BEGIN
  FOR v_job IN SELECT jobid,jobname FROM cron.job
    WHERE jobname IN ('process-scheduled-contributions','check-refund-deadlines')
  LOOP
    PERFORM cron.alter_job(v_job.jobid,command:=format('SELECT public.enqueue_collectipay_scheduled_worker(%L,%L::jsonb)',
      'process-scheduled-contributions',
      CASE WHEN v_job.jobname='check-refund-deadlines' THEN '{"deadlines_only":true}' ELSE '{}' END));
  END LOOP;
END
$jobs$;

COMMIT;
