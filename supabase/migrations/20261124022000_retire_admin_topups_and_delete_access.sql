BEGIN;

-- Keep financial and identity records outside browser-level deletion.
REVOKE DELETE ON TABLE public.profiles,public.contribution_groups,public.contributors,
  public.transactions,public.refund_transactions,public.admin_audit_logs
  FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_remove_user_bvn(uuid,text)
  FROM PUBLIC,anon,authenticated;

-- Preserve earlier credits in history and block creation or settlement of any manual top-up.
-- An older approval routine must update this row in the same transaction as its wallet credit.
CREATE FUNCTION public.guard_retired_wallet_topup()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.direction <> 'credit' THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    RAISE EXCEPTION 'Manual wallet top-ups are no longer available.' USING ERRCODE='42501';
  END IF;
  IF NEW.status='approved' AND (OLD.direction IS DISTINCT FROM NEW.direction OR OLD.status IS DISTINCT FROM NEW.status) THEN
    RAISE EXCEPTION 'Manual wallet top-ups are no longer available.' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_retired_wallet_topup
  BEFORE INSERT OR UPDATE OF direction,status ON public.wallet_adjustment_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_retired_wallet_topup();
REVOKE EXECUTE ON FUNCTION public.guard_retired_wallet_topup() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.admin_operations_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Active admin access required' USING ERRCODE='42501'; END IF;

  RETURN jsonb_build_object(
    'payout_health', public.admin_get_payout_reconciliation_health(),
    'wallet_approvals', (SELECT count(*) FROM public.wallet_adjustment_requests WHERE status='pending' AND direction='debit'),
    'payout_approvals', (SELECT count(*) FROM public.payout_recovery_reviews WHERE status='pending'),
    'incoming_review', (SELECT count(*) FROM public.inbound_payment_review WHERE resolved_at IS NULL),
    'legacy_card_review', (SELECT count(*) FROM public.inbound_payment_review
      WHERE resolved_at IS NULL AND reason='missing_checkout_intent'),
    'support_work', (SELECT count(*) FROM public.support_tickets WHERE status IN ('open','in_review')),
    'platform', (SELECT jsonb_build_object(
      'users',p.total,'verified_bvn',p.verified_bvn,'restricted_users',p.restricted,'wallet_float',p.wallet_float,
      'groups',g.total,'group_liquidity',g.liquidity,'aml_alerts',a.total,'high_aml_alerts',a.high,
      'outside_payments', (SELECT count(*) FROM public.external_payment_tracks
        WHERE source_channel IN ('group_bank_transfer','wallet_bank_transfer')))
      FROM (
        SELECT count(*) AS total,count(*) FILTER (WHERE bvn ~ '^[0-9]{11}$') AS verified_bvn,
          count(*) FILTER (WHERE coalesce(status,'active')<>'active') AS restricted,
          coalesce(sum(wallet_balance),0) AS wallet_float
        FROM public.profiles
      ) p
      CROSS JOIN (SELECT count(*) AS total,coalesce(sum(current_amount),0) AS liquidity FROM public.contribution_groups) g
      CROSS JOIN (SELECT count(*) AS total,count(*) FILTER (WHERE severity IN ('high','critical')) AS high
        FROM public.aml_alerts WHERE status IN ('open','investigating','escalated')) a
    ),
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

NOTIFY pgrst,'reload schema';
COMMIT;
