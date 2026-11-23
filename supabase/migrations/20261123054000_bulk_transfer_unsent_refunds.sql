BEGIN;

-- The wallet row serializes recovery with dispatch and other wallet updates.
CREATE OR REPLACE FUNCTION public.service_release_unsent_transfer(p_reference text,p_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_transfer public.transactions%ROWTYPE;
  v_reference text;
BEGIN
  PERFORM 1 FROM public.profiles WHERE id=p_user_id FOR UPDATE;
  SELECT * INTO v_transfer FROM public.transactions
    WHERE reference_id=p_reference AND user_id=p_user_id AND type='transfer' FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_transfer.status IS DISTINCT FROM 'pending' OR v_transfer.metadata->>'dispatch_guard' IS DISTINCT FROM 'true'
    OR v_transfer.metadata ? 'dispatched_at' OR v_transfer.created_at IS NULL
    OR v_transfer.created_at>=now()-interval '2 minutes' THEN
    RETURN v_transfer.status;
  END IF;
  IF v_transfer.bulk_batch_id IS NULL THEN
    RETURN public.service_settle_priced_transfer(p_reference,'failed','{"reason":"never_dispatched"}') ->> 'status';
  END IF;
  PERFORM 1 FROM public.bulk_transfer_batches
    WHERE id=v_transfer.bulk_batch_id AND user_id=p_user_id AND dispatch_started_at IS NULL FOR UPDATE;
  IF NOT FOUND OR EXISTS (
    SELECT 1 FROM public.transactions WHERE bulk_batch_id=v_transfer.bulk_batch_id
      AND user_id=p_user_id AND (metadata ? 'dispatched_at' OR status='completed')
  ) THEN
    RETURN v_transfer.status;
  END IF;

  FOR v_reference IN SELECT reference_id FROM public.transactions
    WHERE bulk_batch_id=v_transfer.bulk_batch_id AND user_id=p_user_id AND status='pending'
    ORDER BY reference_id
  LOOP
    PERFORM public.service_settle_priced_transfer(v_reference,'failed','{"reason":"never_dispatched"}');
  END LOOP;
  RETURN 'failed';
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
