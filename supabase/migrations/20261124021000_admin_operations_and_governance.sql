BEGIN;

CREATE FUNCTION public.admin_operations_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Active admin access required' USING ERRCODE='42501'; END IF;

  RETURN jsonb_build_object(
    'payout_health', public.admin_get_payout_reconciliation_health(),
    'wallet_approvals', (SELECT count(*) FROM public.wallet_adjustment_requests WHERE status='pending'),
    'payout_approvals', (SELECT count(*) FROM public.payout_recovery_reviews WHERE status='pending'),
    'incoming_review', (SELECT count(*) FROM public.inbound_payment_review WHERE resolved_at IS NULL),
    'legacy_card_review', (SELECT count(*) FROM public.inbound_payment_review
      WHERE resolved_at IS NULL AND reason='missing_checkout_intent'),
    'support_work', (SELECT count(*) FROM public.support_tickets WHERE status IN ('open','in_review')),
    'governance', (
      SELECT jsonb_build_object(
        'open_votes', count(*) FILTER (WHERE p.status='pending' AND p.deadline>now()),
        'overdue_votes', count(*) FILTER (WHERE p.status='pending' AND p.deadline<=now()),
        'approved_unsettled', count(*) FILTER (WHERE p.status='approved')
      )
      FROM (
        SELECT status,deadline FROM public.withdrawal_requests WHERE status IN ('pending','approved')
        UNION ALL
        SELECT status,voting_deadline FROM public.group_refund_requests WHERE status IN ('pending','approved')
      ) p
    ),
    'admins', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,
        'status',coalesce(p.status,'active'),'pin_ready',c.user_id IS NOT NULL)
        ORDER BY coalesce(p.status,'active')='active' DESC,p.name,p.id),'[]')
      FROM public.profiles p LEFT JOIN public.wallet_pin_credentials c ON c.user_id=p.id
      WHERE p.role='admin'
    )
  );
END;
$$;

CREATE FUNCTION public.admin_list_governance_proposals(
  p_filter text DEFAULT 'open',p_kind text DEFAULT 'all',p_search text DEFAULT NULL,
  p_before_created_at timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL,p_before_kind text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_search text:=lower(btrim(coalesce(p_search,'')));
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Active admin access required' USING ERRCODE='42501'; END IF;
  IF p_filter IS NULL OR p_filter NOT IN ('open','attention','history','all') OR
    p_kind IS NULL OR p_kind NOT IN ('all','withdrawal','refund') OR length(v_search)>100 THEN
    RAISE EXCEPTION 'Invalid proposal filters' USING ERRCODE='22023';
  END IF;
  IF num_nonnulls(p_before_created_at,p_before_id,p_before_kind) NOT IN (0,3) OR
    (p_before_kind IS NOT NULL AND p_before_kind NOT IN ('withdrawal','refund')) THEN
    RAISE EXCEPTION 'Invalid page cursor' USING ERRCODE='22023';
  END IF;

  RETURN (
    WITH candidates AS (
      SELECT 'withdrawal'::text AS kind,w.id,w.contribution_id AS group_id,w.requester_id,
        w.status,w.deadline,coalesce(w.created_at,w.deadline) AS created_at,w.votes,
        left(w.purpose,300) AS description,w.amount,w.fee_amount,NULL::numeric AS refund_percentage,
        w.verified_approval AS verified
      FROM public.withdrawal_requests w WHERE p_kind IN ('all','withdrawal')
      UNION ALL
      SELECT 'refund',r.id,r.group_id,r.requester_id,r.status,r.voting_deadline,
        coalesce(r.created_at,r.voting_deadline),r.votes,left(r.reason,300),NULL::numeric,NULL::numeric,
        CASE WHEN r.refund_type='full' THEN 100 ELSE r.partial_percentage END,r.verified_request
      FROM public.group_refund_requests r WHERE p_kind IN ('all','refund')
    ), page AS MATERIALIZED (
      SELECT p.*,g.name AS group_name,g.status AS group_status,g.archived,g.creator_id,g.current_amount
      FROM candidates p LEFT JOIN public.contribution_groups g ON g.id=p.group_id
      WHERE (
        p_filter='all'
        OR (p_filter='open' AND p.status='pending' AND p.deadline>now())
        OR (p_filter='attention' AND (p.status='approved' OR (p.status='pending' AND p.deadline<=now())))
        OR (p_filter='history' AND coalesce(p.status,'') NOT IN ('pending','approved'))
      ) AND (v_search='' OR p.id::text=v_search OR p.group_id::text=v_search
        OR strpos(lower(coalesce(g.name,'')),v_search)>0)
        AND (p_before_created_at IS NULL OR (p.created_at,p.id,p.kind)<(p_before_created_at,p_before_id,p_before_kind))
      ORDER BY p.created_at DESC,p.id DESC,p.kind DESC LIMIT 26
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'kind',p.kind,'id',p.id,'group_id',p.group_id,'group_name',p.group_name,
      'description',p.description,'status',p.status,'deadline',p.deadline,'created_at',p.created_at,
      'amount',p.amount,'fee_amount',p.fee_amount,'refund_percentage',p.refund_percentage,
      'eligible_voters',cardinality(e.voter_ids),'approval_threshold',e.threshold,
      'votes_for',b.votes_for,'votes_against',b.votes_against,
      'settled_refunds',r.settled_refunds,'settled_amount',r.settled_amount,
      'attention',CASE
        WHEN p.status='pending' AND p.deadline<=now() THEN 'deadline_passed'
        WHEN p.status='approved' THEN CASE
          WHEN NOT p.verified THEN 'approval_unverified'
          WHEN p.group_name IS NULL THEN 'group_unavailable'
          WHEN p.kind='withdrawal' AND (coalesce(p.archived,false) OR coalesce(p.group_status,'active')<>'active')
            THEN 'group_restricted'
          WHEN p.kind='withdrawal' AND NOT EXISTS (
            SELECT FROM public.profiles recipient
            WHERE recipient.id=p.requester_id AND recipient.id=p.creator_id AND coalesce(recipient.status,'active')='active'
          ) THEN 'recipient_unavailable'
          WHEN p.kind='withdrawal' AND coalesce(p.current_amount,0)<p.amount THEN 'insufficient_balance'
          WHEN p.kind='refund' AND p.group_status='frozen' THEN 'group_restricted'
          WHEN p.kind='refund' AND EXISTS (
            SELECT FROM public.contributors c LEFT JOIN public.profiles u ON u.id=c.user_id
            WHERE c.group_id=p.group_id AND c.total_contributed>0 AND u.id IS NULL
          ) THEN 'unlinked_contribution'
          ELSE 'settlement_pending'
        END
        ELSE NULL END
    ) ORDER BY p.created_at DESC,p.id DESC,p.kind DESC),'[]')
    FROM page p
    LEFT JOIN public.governance_electorates e ON e.kind=p.kind AND e.request_id=p.id
    LEFT JOIN LATERAL (
      SELECT count(*) FILTER (WHERE ballot.vote IN ('true','for')) AS votes_for,
        count(*) FILTER (WHERE ballot.vote IN ('false','against')) AS votes_against
      FROM public.valid_governance_ballots(p.kind,p.id,p.votes,p.deadline) ballot
      WHERE e.request_id IS NOT NULL
    ) b ON e.request_id IS NOT NULL
    LEFT JOIN LATERAL (
      SELECT count(*) AS settled_refunds,coalesce(sum(rt.refund_amount),0) AS settled_amount
      FROM public.refund_transactions rt WHERE rt.refund_request_id=p.id AND rt.status='completed'
        AND p.kind='refund' AND p.status='executed'
    ) r ON p.kind='refund' AND p.status='executed'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_operations_overview(),
  public.admin_list_governance_proposals(text,text,text,timestamptz,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_operations_overview(),
  public.admin_list_governance_proposals(text,text,text,timestamptz,uuid,text) TO authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
