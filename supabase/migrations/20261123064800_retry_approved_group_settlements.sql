BEGIN;

CREATE INDEX IF NOT EXISTS withdrawal_approved_retry ON public.withdrawal_requests(updated_at,id) WHERE status='approved';
CREATE INDEX IF NOT EXISTS refund_approved_retry ON public.group_refund_requests(updated_at,id) WHERE status='approved' AND verified_request;

CREATE FUNCTION public.service_retry_approved_group_settlement(p_kind text,p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result json;
BEGIN
  IF p_kind='withdrawal' THEN
    PERFORM 1 FROM public.withdrawal_requests WHERE id=p_id AND status='approved' FOR UPDATE SKIP LOCKED;
    IF NOT FOUND THEN RETURN false; END IF;
    v_result := public.process_approved_withdrawal(p_id);
    IF (v_result->>'success')::boolean IS NOT TRUE THEN
      UPDATE public.withdrawal_requests SET updated_at=now() WHERE id=p_id AND status='approved';
    END IF;
  ELSIF p_kind='refund' THEN
    PERFORM 1 FROM public.group_refund_requests WHERE id=p_id AND status='approved' AND verified_request FOR UPDATE SKIP LOCKED;
    IF NOT FOUND THEN RETURN false; END IF;
    -- Keep the retry timestamp even when this attempt rolls back.
    BEGIN
      v_result := public.process_group_refund(p_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Approved group refund retry failed (SQLSTATE %)',SQLSTATE;
    END;
    IF (v_result->>'success')::boolean IS NOT TRUE THEN
      UPDATE public.group_refund_requests SET updated_at=now() WHERE id=p_id AND status='approved';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid settlement type';
  END IF;
  RETURN coalesce((v_result->>'success')::boolean,false);
END;
$$;
REVOKE ALL ON FUNCTION public.service_retry_approved_group_settlement(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.service_retry_approved_group_settlement(text,uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
