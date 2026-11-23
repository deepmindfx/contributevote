BEGIN;

ALTER TABLE public.bulk_transfer_batches
  ADD COLUMN reconcile_at timestamptz,
  ADD COLUMN reconcile_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN reconcile_lease uuid,
  ADD COLUMN reconcile_lease_until timestamptz;

UPDATE public.bulk_transfer_batches b SET reconcile_at=now()
WHERE b.authorized_at IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.transactions t WHERE t.bulk_batch_id=b.id AND t.status='pending'
);
CREATE INDEX bulk_transfer_reconciliation_due ON public.bulk_transfer_batches(reconcile_at,id) WHERE reconcile_at IS NOT NULL;

CREATE FUNCTION public.enqueue_authorized_bulk_transfer()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  NEW.reconcile_at := NEW.authorized_at + interval '15 seconds';
  RETURN NEW;
END;
$$;

CREATE TRIGGER bulk_transfer_enqueue_reconciliation BEFORE UPDATE OF authorized_at ON public.bulk_transfer_batches
FOR EACH ROW WHEN (OLD.authorized_at IS NULL AND NEW.authorized_at IS NOT NULL)
EXECUTE FUNCTION public.enqueue_authorized_bulk_transfer();

CREATE FUNCTION public.service_claim_bulk_reconciliation(p_batch_id uuid DEFAULT NULL,p_limit integer DEFAULT 4)
RETURNS TABLE (id uuid,provider_batch_id text,lease uuid)
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  WITH due AS (
    SELECT b.id FROM public.bulk_transfer_batches b
    WHERE b.reconcile_at<=now() AND (b.reconcile_lease_until IS NULL OR b.reconcile_lease_until<=now())
      AND (p_batch_id IS NULL OR b.id=p_batch_id)
    ORDER BY b.reconcile_at,b.id
    LIMIT greatest(1,least(coalesce(p_limit,4),4)) FOR UPDATE SKIP LOCKED
  )
  UPDATE public.bulk_transfer_batches b
  SET reconcile_lease=gen_random_uuid(),reconcile_lease_until=now()+interval '2 minutes'
  FROM due WHERE b.id=due.id
  RETURNING b.id,b.provider_batch_id,b.reconcile_lease;
$$;

CREATE FUNCTION public.service_finish_bulk_reconciliation(p_batch_id uuid,p_lease uuid,p_progress boolean)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  UPDATE public.bulk_transfer_batches b
  SET reconcile_at=CASE WHEN EXISTS (
      SELECT 1 FROM public.transactions t WHERE t.bulk_batch_id=b.id AND t.status='pending'
    ) THEN now()+make_interval(secs=>CASE WHEN p_progress THEN 30 ELSE least(600,30*(1<<least(b.reconcile_attempts,5))) END) END,
    reconcile_attempts=CASE WHEN p_progress THEN 0 ELSE least(b.reconcile_attempts+1,6) END,
    reconcile_lease=NULL,reconcile_lease_until=NULL
  WHERE b.id=p_batch_id AND b.reconcile_lease=p_lease;
$$;

REVOKE ALL ON FUNCTION public.enqueue_authorized_bulk_transfer(),public.service_claim_bulk_reconciliation(uuid,integer),
  public.service_finish_bulk_reconciliation(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.service_claim_bulk_reconciliation(uuid,integer),
  public.service_finish_bulk_reconciliation(uuid,uuid,boolean) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
