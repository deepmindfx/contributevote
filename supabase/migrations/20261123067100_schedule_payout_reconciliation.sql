BEGIN;

CREATE FUNCTION public.wake_payout_reconciliation()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_request bigint;
BEGIN
  SELECT net.http_post(
    url := rtrim(cfg.decrypted_secret,'/') || '/functions/v1/reconcile-bank-payouts',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || tok.decrypted_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 105000
  ) INTO v_request
  FROM vault.decrypted_secrets cfg CROSS JOIN vault.decrypted_secrets tok
  WHERE cfg.name='collectipay_push_worker_base_url' AND tok.name='collectipay_cron_bearer'
  LIMIT 1;

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
REVOKE ALL ON FUNCTION public.wake_payout_reconciliation() FROM PUBLIC,anon,authenticated,service_role;

DO $schedule$
BEGIN
  IF EXISTS (SELECT FROM vault.secrets WHERE name='collectipay_push_worker_base_url')
    AND EXISTS (SELECT FROM vault.secrets WHERE name='collectipay_cron_bearer') THEN
    PERFORM cron.schedule('collectipay-payout-reconciliation','* * * * *','SELECT public.wake_payout_reconciliation()');
  END IF;
END
$schedule$;
COMMIT;
