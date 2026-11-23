BEGIN;

ALTER TABLE public.withdrawal_requests ADD COLUMN total_eligible_voters integer;
ALTER TABLE public.withdrawal_requests ADD COLUMN verified_approval boolean NOT NULL DEFAULT false;

CREATE TABLE public.governance_electorates (
  kind text NOT NULL CHECK (kind IN ('withdrawal','refund')),
  request_id uuid NOT NULL,
  voter_ids uuid[] NOT NULL,
  threshold numeric NOT NULL CHECK (threshold BETWEEN 50 AND 100),
  PRIMARY KEY (kind,request_id)
);
ALTER TABLE public.governance_electorates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.governance_electorates FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.capture_governance_electorate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_kind text := TG_ARGV[0];
  v_group uuid;
  v_voters uuid[];
  v_threshold numeric;
BEGIN
  v_group := CASE WHEN v_kind='withdrawal' THEN (to_jsonb(NEW)->>'contribution_id')::uuid ELSE (to_jsonb(NEW)->>'group_id')::uuid END;
  SELECT coalesce(array_agg(DISTINCT c.user_id),'{}') INTO v_voters
  FROM public.contributors c JOIN public.profiles p ON p.id=c.user_id
  WHERE c.group_id=v_group AND c.has_voting_rights AND coalesce(p.status,'active')='active';
  IF cardinality(v_voters)=0 THEN RAISE EXCEPTION 'At least one active verified voter is required'; END IF;
  SELECT CASE WHEN voting_threshold BETWEEN 50 AND 100 THEN voting_threshold ELSE 60 END INTO v_threshold
  FROM public.contribution_groups WHERE id=v_group;
  INSERT INTO public.governance_electorates(kind,request_id,voter_ids,threshold)
    VALUES(v_kind,NEW.id,v_voters,coalesce(v_threshold,60));
  NEW.total_eligible_voters := cardinality(v_voters);
  RETURN NEW;
END;
$$;
CREATE TRIGGER capture_withdrawal_electorate BEFORE INSERT ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.capture_governance_electorate('withdrawal');
CREATE TRIGGER capture_refund_electorate BEFORE INSERT ON public.group_refund_requests
  FOR EACH ROW EXECUTE FUNCTION public.capture_governance_electorate('refund');

-- Pending proposals retain their valid existing ballots. Older approved requests
-- lack an approval marker and are held for review before any further payout.
INSERT INTO public.governance_electorates(kind,request_id,threshold,voter_ids)
SELECT pending.kind,pending.id,CASE WHEN g.voting_threshold BETWEEN 50 AND 100 THEN g.voting_threshold ELSE 60 END,
  ARRAY(SELECT DISTINCT c.user_id FROM public.contributors c WHERE c.group_id=g.id AND c.has_voting_rights AND c.user_id IS NOT NULL)
FROM (
  SELECT 'withdrawal'::text AS kind,id,contribution_id AS group_id FROM public.withdrawal_requests WHERE status='pending'
  UNION ALL
  SELECT 'refund',id,group_id FROM public.group_refund_requests WHERE status='pending' AND verified_request
) pending JOIN public.contribution_groups g ON g.id=pending.group_id;
UPDATE public.withdrawal_requests w SET total_eligible_voters=cardinality(e.voter_ids)
FROM public.governance_electorates e WHERE e.kind='withdrawal' AND e.request_id=w.id;
UPDATE public.group_refund_requests r SET total_eligible_voters=cardinality(e.voter_ids)
FROM public.governance_electorates e WHERE e.kind='refund' AND e.request_id=r.id;

CREATE FUNCTION public.valid_governance_ballots(p_kind text,p_id uuid,p_votes jsonb,p_deadline timestamptz)
RETURNS TABLE(voter_id text,vote text) LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT DISTINCT ON (b.ballot->>'user_id') b.ballot->>'user_id',b.ballot->>'vote'
  FROM public.governance_electorates e
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(p_votes)='array' THEN p_votes ELSE '[]'::jsonb END)
    WITH ORDINALITY AS b(ballot,ordinal)
  WHERE e.kind=p_kind AND e.request_id=p_id
    AND EXISTS (SELECT FROM unnest(e.voter_ids) AS u(id) WHERE u.id::text=b.ballot->>'user_id')
    AND CASE
      WHEN p_kind='withdrawal' THEN jsonb_typeof(b.ballot->'vote')='boolean'
      ELSE jsonb_typeof(b.ballot->'vote')='string' AND b.ballot->>'vote' IN ('for','against')
    END
    AND CASE WHEN pg_input_is_valid(b.ballot->>'voted_at','timestamp with time zone')
      THEN (b.ballot->>'voted_at')::timestamptz<=p_deadline ELSE false END
  ORDER BY b.ballot->>'user_id',b.ordinal DESC;
$$;

REVOKE ALL ON FUNCTION public.capture_governance_electorate(),public.valid_governance_ballots(text,uuid,jsonb,timestamptz)
  FROM PUBLIC,anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
