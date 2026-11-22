BEGIN;

REVOKE UPDATE ON public.notifications FROM PUBLIC,anon,authenticated;
GRANT UPDATE (is_read) ON public.notifications TO authenticated;

REVOKE ALL ON FUNCTION public.check_withdrawal_voting(uuid),public.record_withdrawal_vote(uuid,uuid,boolean)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.check_withdrawal_voting(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.create_withdrawal_request_safe(uuid,numeric,text,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.archive_group(p_group_id uuid,p_user_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN json_build_object('success',false,'error','Only the group owner can archive it.');
  END IF;
  UPDATE public.contribution_groups SET archived=true,archived_at=now(),archived_by=p_user_id,status='completed',updated_at=now()
  WHERE id=p_group_id AND creator_id=auth.uid() AND coalesce(status,'active')='active' AND NOT coalesce(archived,false);
  RETURN CASE WHEN FOUND THEN json_build_object('success',true) ELSE
    json_build_object('success',false,'error','Only an active owned group can be archived.') END;
END;
$$;

CREATE OR REPLACE FUNCTION public.unarchive_group(p_group_id uuid,p_user_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN json_build_object('success',false,'error','Only the group owner can unarchive it.');
  END IF;
  UPDATE public.contribution_groups SET archived=false,archived_at=NULL,archived_by=NULL,status='active',updated_at=now()
  WHERE id=p_group_id AND creator_id=auth.uid() AND archived AND archived_by=auth.uid() AND status='completed';
  RETURN CASE WHEN FOUND THEN json_build_object('success',true) ELSE
    json_build_object('success',false,'error','This group cannot be unarchived while it is under review.') END;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_group(uuid,uuid),public.unarchive_group(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.archive_group(uuid,uuid),public.unarchive_group(uuid,uuid) TO authenticated;

CREATE FUNCTION public.prevent_withdrawal_during_group_refund()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF EXISTS (SELECT FROM public.group_refund_requests WHERE group_id=NEW.contribution_id AND verified_request
    AND (status='approved' OR (status='pending' AND voting_deadline>now()))) THEN
    RAISE EXCEPTION 'Group withdrawals are paused while a refund is in progress';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER withdrawals_wait_for_refunds BEFORE INSERT ON public.transactions
  FOR EACH ROW WHEN (NEW.type='withdrawal' AND NEW.contribution_id IS NOT NULL)
  EXECUTE FUNCTION public.prevent_withdrawal_during_group_refund();
CREATE TRIGGER withdrawal_proposals_wait_for_refunds BEFORE INSERT ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.prevent_withdrawal_during_group_refund();

CREATE FUNCTION public.service_close_expired_refund_votes()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Approval at quorum is already atomic with recording the last valid vote.
  UPDATE public.group_refund_requests SET status='rejected',updated_at=now()
  WHERE status='pending' AND voting_deadline<=now();
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.service_close_expired_refund_votes() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.service_close_expired_refund_votes() TO service_role;

CREATE INDEX IF NOT EXISTS pending_transfer_reconciliation_idx ON public.transactions(updated_at)
  WHERE type='transfer' AND status='pending' AND metadata ? 'pricing_reserved';

COMMIT;
