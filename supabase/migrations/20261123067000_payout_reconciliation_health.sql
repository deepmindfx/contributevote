BEGIN;

CREATE TABLE public.payout_reconciliation_health (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  lease uuid,
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_finished_at timestamptz,
  last_alert_at timestamptz,
  result jsonb NOT NULL DEFAULT '{}'::jsonb
);
INSERT INTO public.payout_reconciliation_health DEFAULT VALUES;
ALTER TABLE public.payout_reconciliation_health ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payout_reconciliation_health FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.service_claim_payout_reconciliation(p_backup boolean DEFAULT false)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  UPDATE public.payout_reconciliation_health
  SET lease=gen_random_uuid(),lease_until=now()+interval '2 minutes'
  WHERE singleton AND (lease_until IS NULL OR lease_until<=now())
    AND (p_backup IS NOT TRUE OR last_finished_at IS NULL OR last_finished_at<now()-interval '3 minutes')
  RETURNING lease;
$$;

CREATE FUNCTION public.service_finish_payout_reconciliation(p_lease uuid,p_result jsonb)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  WITH finished AS (
    UPDATE public.payout_reconciliation_health SET
      last_finished_at=clock_timestamp(),result=p_result,lease=NULL,lease_until=NULL
    WHERE singleton AND lease=p_lease
    RETURNING 1
  ) SELECT EXISTS (SELECT FROM finished);
$$;

CREATE INDEX pending_priced_payout_queue ON public.transactions(updated_at,id)
  WHERE type='transfer' AND status='pending' AND bulk_batch_id IS NULL AND metadata->>'pricing_reserved'='true';
CREATE INDEX pending_priced_payout_age ON public.transactions(created_at)
  WHERE type='transfer' AND status='pending' AND metadata->>'pricing_reserved'='true';

CREATE FUNCTION public.admin_get_payout_reconciliation_health()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT EXISTS (SELECT FROM public.profiles WHERE id=auth.uid() AND role='admin' AND coalesce(status,'active')='active')
    THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
  RETURN (
    SELECT jsonb_build_object('last_finished_at',h.last_finished_at,
      'worker_stale',h.last_finished_at IS NULL OR h.last_finished_at<now()-interval '3 minutes',
      'last_run',h.result,'stalled_payouts',p.stalled,'stalled_bulk_payouts',p.stalled_bulk,
      'oldest_dispatched_at',p.oldest)
    FROM public.payout_reconciliation_health h CROSS JOIN LATERAL (
      SELECT count(*) AS stalled,count(*) FILTER (WHERE bulk_batch_id IS NOT NULL) AS stalled_bulk,
        min(created_at) AS oldest
      FROM public.transactions WHERE type='transfer' AND status='pending'
        AND metadata->>'pricing_reserved'='true' AND metadata ? 'dispatched_at'
        AND created_at<now()-interval '5 minutes'
    ) p WHERE h.singleton
  );
END;
$$;

REVOKE ALL ON FUNCTION public.service_claim_payout_reconciliation(boolean),
  public.service_finish_payout_reconciliation(uuid,jsonb),public.admin_get_payout_reconciliation_health()
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.service_claim_payout_reconciliation(boolean),
  public.service_finish_payout_reconciliation(uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_payout_reconciliation_health() TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
