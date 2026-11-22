BEGIN;

-- Keep a durable alert record with the event. Delivery runs in its own transaction.
CREATE TABLE public.fixed_savings_notification_outbox (
  savings_id uuid NOT NULL REFERENCES public.fixed_savings(id) ON DELETE RESTRICT,
  notification_type text NOT NULL CHECK (notification_type IN (
    'fixed_savings_locked','fixed_savings_maturing','fixed_savings_matured','fixed_savings_returned'
  )),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  PRIMARY KEY (savings_id,notification_type)
);
CREATE INDEX fixed_savings_notification_due ON public.fixed_savings_notification_outbox(next_attempt_at,savings_id,notification_type)
WHERE completed_at IS NULL;

ALTER TABLE public.fixed_savings_notification_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fixed_savings_notification_outbox FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.notify_fixed_savings(p_user uuid,p_savings uuid,p_type text,p_title text,p_message text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  INSERT INTO public.fixed_savings_notification_outbox(savings_id,notification_type,user_id,title,message)
  VALUES (p_savings,p_type,p_user,p_title,p_message)
  ON CONFLICT (savings_id,notification_type) DO NOTHING
$$;

CREATE FUNCTION public.service_deliver_fixed_savings_notifications()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_alert public.fixed_savings_notification_outbox%ROWTYPE;
  v_count integer := 0;
BEGIN
  FOR v_alert IN SELECT n.* FROM public.fixed_savings_notification_outbox n
    WHERE n.completed_at IS NULL AND n.next_attempt_at<=now()
    ORDER BY n.next_attempt_at,n.savings_id,n.notification_type
    LIMIT 200 FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      -- A delayed reminder has no purpose after the deadline.
      IF v_alert.notification_type<>'fixed_savings_maturing' OR EXISTS (
        SELECT 1 FROM public.fixed_savings s WHERE s.id=v_alert.savings_id
          AND s.status='active' AND s.maturity_at>clock_timestamp()
      ) THEN
        INSERT INTO public.notifications (user_id,type,title,message,related_id)
        VALUES (v_alert.user_id,v_alert.notification_type,v_alert.title,v_alert.message,v_alert.savings_id);
        v_count := v_count+1;
      END IF;
      UPDATE public.fixed_savings_notification_outbox SET completed_at=clock_timestamp()
      WHERE savings_id=v_alert.savings_id AND notification_type=v_alert.notification_type;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.fixed_savings_notification_outbox
      SET attempts=attempts+1,
          next_attempt_at=clock_timestamp()+make_interval(secs=>least(3600,60*(1<<least(attempts,6))))
      WHERE savings_id=v_alert.savings_id AND notification_type=v_alert.notification_type;
      RAISE WARNING 'Ice Vault notification % failed for lock % (SQLSTATE %)',v_alert.notification_type,v_alert.savings_id,SQLSTATE;
    END;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.service_deliver_fixed_savings_notifications() FROM PUBLIC,anon,authenticated,service_role;

DO $$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    PERFORM cron.schedule('collectipay-fixed-savings-notifications','* * * * *','select public.service_deliver_fixed_savings_notifications()');
  END IF;
END;
$$;

-- Keep confirmation idempotent for already accepted quotes, even after the quote expires.
CREATE OR REPLACE FUNCTION public.open_fixed_savings(p_quote_id uuid,p_terms_version text,p_accepted boolean,p_pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_program public.fixed_savings_program%ROWTYPE;
  v_quote public.fixed_savings_quotes%ROWTYPE;
  v_tx uuid;
  v_pin json;
  v_status text;
  v_error text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in to continue' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id=v_uid FOR UPDATE;
  IF NOT FOUND OR v_profile.status IS DISTINCT FROM 'active' THEN RETURN jsonb_build_object('error','An active wallet is required.'); END IF;
  SELECT status INTO v_status FROM public.fixed_savings WHERE id=p_quote_id AND user_id=v_uid;
  IF FOUND THEN RETURN jsonb_build_object('id',p_quote_id,'status',v_status); END IF;
  SELECT * INTO v_program FROM public.fixed_savings_program WHERE singleton FOR SHARE;
  IF NOT public.fixed_savings_program_ready(v_program) THEN RETURN jsonb_build_object('error','New savings locks are unavailable.'); END IF;
  SELECT * INTO v_quote FROM public.fixed_savings_quotes WHERE user_id=v_uid AND id=p_quote_id FOR UPDATE;
  IF NOT FOUND OR v_quote.expires_at<=clock_timestamp() OR v_quote.terms_version IS DISTINCT FROM v_program.terms_version
    OR v_quote.program_revision IS DISTINCT FROM v_program.revision
    OR v_quote.settlement_mode IS DISTINCT FROM v_program.settlement_mode
    OR v_quote.partner_code IS DISTINCT FROM v_program.partner_code
    OR v_quote.custodian_name IS DISTINCT FROM v_program.custodian_name
    OR v_quote.approval_reference IS DISTINCT FROM v_program.approval_reference THEN
    RETURN jsonb_build_object('code','stale_quote','error','This quote expired. Review a new maturity time.');
  END IF;
  IF p_accepted IS DISTINCT FROM true OR p_terms_version IS DISTINCT FROM v_quote.terms_version THEN
    RETURN jsonb_build_object('error','Accept the savings terms and exact maturity time before confirming.');
  END IF;
  IF v_profile.wallet_balance IS NULL OR v_profile.wallet_balance<v_quote.amount THEN RETURN jsonb_build_object('error','Insufficient available wallet balance.'); END IF;
  v_error := public.fixed_savings_limit_error(v_uid,v_quote.amount,v_quote.days,v_program);
  IF v_error IS NOT NULL THEN RETURN jsonb_build_object('error',v_error); END IF;
  v_pin := public.check_wallet_pin(v_uid,p_pin);
  IF (v_pin->>'success')::boolean IS DISTINCT FROM true THEN RETURN v_pin::jsonb; END IF;

  v_status := CASE WHEN v_quote.settlement_mode='wallet_ledger' THEN 'active' ELSE 'reserving' END;
  UPDATE public.profiles SET wallet_balance=wallet_balance-v_quote.amount,updated_at=now() WHERE id=v_uid;
  INSERT INTO public.fixed_savings(id,user_id,amount,days,maturity_at,status,terms_version,settlement_mode,
    partner_code,custodian_name,approval_reference,locked_at)
  VALUES (v_quote.id,v_uid,v_quote.amount,v_quote.days,v_quote.maturity_at,v_status,v_quote.terms_version,
    v_quote.settlement_mode,v_quote.partner_code,v_quote.custodian_name,v_quote.approval_reference,
    CASE WHEN v_status='active' THEN clock_timestamp() END);
  v_tx := public.fixed_savings_wallet_entry(v_uid,v_quote.id,v_quote.amount,'reservation',
    CASE WHEN v_status='active' THEN 'Ice Vault locked' ELSE 'Ice Vault reservation' END,
    v_profile.wallet_balance,v_profile.wallet_balance-v_quote.amount);
  INSERT INTO public.fixed_savings_events(savings_id,event,transaction_id) VALUES (v_quote.id,'authorised',v_tx);
  IF v_status='active' THEN
    INSERT INTO public.fixed_savings_events(savings_id,event) VALUES(v_quote.id,'locked');
    PERFORM public.notify_fixed_savings(v_uid,v_quote.id,'fixed_savings_locked','Savings locked',
      'Your Ice Vault lock is confirmed. The maturity time is in the app.');
  ELSE
    INSERT INTO public.fixed_savings_jobs(savings_id,partner_code,operation) VALUES (v_quote.id,v_quote.partner_code,'reserve');
  END IF;
  DELETE FROM public.fixed_savings_quotes WHERE user_id=v_uid AND id=v_quote.id;
  RETURN jsonb_build_object('id',v_quote.id,'status',v_status);
END;
$$;

-- Keep maturity runs from competing for the same wallet or reminder event.
CREATE OR REPLACE FUNCTION public.service_schedule_fixed_savings()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_s public.fixed_savings%ROWTYPE;
  v_wallet numeric;
  v_count integer := 0;
  v_wallet_error boolean := false;
BEGIN
  IF NOT pg_try_advisory_xact_lock(20261122,21451) THEN RETURN 0; END IF;

  FOR v_s IN SELECT s.* FROM public.fixed_savings s
    WHERE s.status='active' AND s.settlement_mode='wallet_ledger' AND s.maturity_at<=now()
    ORDER BY s.maturity_at,s.id LIMIT 200
  LOOP
    BEGIN
      SELECT wallet_balance INTO v_wallet FROM public.profiles WHERE id=v_s.user_id FOR UPDATE SKIP LOCKED;
      IF NOT FOUND THEN CONTINUE; END IF;
      IF public.credit_matured_wallet_savings(v_s.user_id,v_s.id,v_wallet) THEN
        v_count := v_count+1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_wallet_error := true;
      RAISE WARNING 'Ice Vault maturity failed for lock % (SQLSTATE %)',v_s.id,SQLSTATE;
    END;
  END LOOP;
  FOR v_s IN SELECT s.* FROM public.fixed_savings s
    WHERE s.status='active' AND s.settlement_mode='partner_api' AND s.maturity_at<=now()
      AND NOT EXISTS (SELECT 1 FROM public.fixed_savings_jobs j WHERE j.savings_id=s.id AND j.operation='release')
    ORDER BY s.maturity_at,s.id LIMIT 200 FOR UPDATE SKIP LOCKED
  LOOP
    INSERT INTO public.fixed_savings_jobs(savings_id,partner_code,operation) VALUES(v_s.id,v_s.partner_code,'release');
    INSERT INTO public.fixed_savings_events(savings_id,event) VALUES (v_s.id,'release_requested');
    v_count := v_count+1;
  END LOOP;
  FOR v_s IN SELECT s.* FROM public.fixed_savings s
    WHERE s.status='active' AND s.maturity_at>now() AND s.maturity_at<=now()+interval '24 hours'
      AND NOT EXISTS (SELECT 1 FROM public.fixed_savings_events e WHERE e.savings_id=s.id AND e.event='maturing')
    ORDER BY s.maturity_at,s.id LIMIT 200 FOR UPDATE SKIP LOCKED
  LOOP
    INSERT INTO public.fixed_savings_events(savings_id,event) VALUES (v_s.id,'maturing');
    PERFORM public.notify_fixed_savings(v_s.user_id,v_s.id,'fixed_savings_maturing','Savings matures soon',
      'Your lock is due to mature within the next 24 hours.');
  END LOOP;
  IF NOT v_wallet_error THEN
    UPDATE public.fixed_savings_program SET scheduler_seen_at=clock_timestamp() WHERE singleton;
  END IF;
  RETURN v_count;
END;
$$;

-- Internal Ice Vault ledger movements are outside the cash-flow AML rules.
CREATE OR REPLACE FUNCTION public.admin_scan_aml_alerts()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inserted integer := 0;
  v_row_count integer := 0;
  v_open_count integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  -- Rule 1: Large single transaction (>= NGN 500,000 in last 90 days)
  INSERT INTO public.aml_alerts (
    alert_key, user_id, group_id, transaction_id, alert_type, severity, risk_score, amount, title, description, evidence
  )
  SELECT
    'large_tx:' || t.id::text,
    t.user_id,
    t.contribution_id,
    t.id,
    'large_transaction',
    CASE WHEN t.amount >= 2000000 THEN 'critical' ELSE 'high' END,
    CASE WHEN t.amount >= 2000000 THEN 92 ELSE 78 END,
    t.amount,
    CASE WHEN t.amount >= 2000000 THEN 'Critical High-Value Transaction' ELSE 'High-Value Transaction Threshold' END,
    format('Single %s transaction of NGN %s exceeded the NGN 500,000 AML monitoring threshold.',
      t.type, to_char(t.amount, 'FM999,999,999,990.00')
    ),
    jsonb_build_object('rule', 'single_tx_gte_500k', 'tx_type', t.type, 'reference_id', t.reference_id, 'created_at', t.created_at)
  FROM public.transactions t
  WHERE t.payment_method IS DISTINCT FROM 'fixed_savings'
    AND t.type IN ('deposit', 'withdrawal', 'transfer', 'contribution')
    AND t.amount >= 500000
    AND t.created_at >= now() - interval '90 days'
  ON CONFLICT (alert_key) DO NOTHING;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_inserted := v_inserted + v_row_count;

  -- Rule 2: Structuring / Smurfing (>= 3 sub-threshold txs on same UTC day totaling >= NGN 400,000)
  INSERT INTO public.aml_alerts (
    alert_key, user_id, alert_type, severity, risk_score, amount, title, description, evidence
  )
  SELECT
    'structuring:' || s.user_id::text || ':' || to_char(s.tx_day, 'YYYY-MM-DD'),
    s.user_id,
    'structuring',
    CASE WHEN s.total_amt >= 1000000 THEN 'critical' ELSE 'high' END,
    CASE WHEN s.total_amt >= 1000000 THEN 90 ELSE 82 END,
    s.total_amt,
    'Potential Structuring / Split Transfers',
    format('%s sub-threshold transactions totaling NGN %s detected on %s.',
      s.tx_count, to_char(s.total_amt, 'FM999,999,999,990.00'), to_char(s.tx_day, 'Mon DD, YYYY')
    ),
    jsonb_build_object('rule', 'structuring_daily_split', 'tx_count', s.tx_count, 'total_amount', s.total_amt, 'day', s.tx_day)
  FROM (
    SELECT t.user_id, date_trunc('day', t.created_at) AS tx_day, count(*) AS tx_count, sum(t.amount) AS total_amt
    FROM public.transactions t
    WHERE t.user_id IS NOT NULL
      AND t.payment_method IS DISTINCT FROM 'fixed_savings'
      AND t.type IN ('deposit', 'withdrawal', 'transfer', 'contribution')
      AND t.amount < 500000 AND t.amount >= 50000
      AND t.created_at >= now() - interval '30 days'
    GROUP BY t.user_id, date_trunc('day', t.created_at)
    HAVING count(*) >= 3 AND sum(t.amount) >= 400000
  ) s
  ON CONFLICT (alert_key) DO NOTHING;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_inserted := v_inserted + v_row_count;

  -- Rule 3: Velocity Burst (>= 5 financial transactions within 1 hour)
  INSERT INTO public.aml_alerts (
    alert_key, user_id, alert_type, severity, risk_score, amount, title, description, evidence
  )
  SELECT
    'velocity:' || v.user_id::text || ':' || to_char(v.tx_hour, 'YYYYMMDDHH24'),
    v.user_id,
    'velocity_burst',
    'high',
    74,
    v.total_amt,
    'Unusual Transaction Velocity Burst',
    format('%s financial transactions (NGN %s total) occurred within a single hour.',
      v.tx_count, to_char(v.total_amt, 'FM999,999,999,990.00')
    ),
    jsonb_build_object('rule', 'velocity_5_per_hour', 'tx_count', v.tx_count, 'total_amount', v.total_amt, 'hour_bucket', v.tx_hour)
  FROM (
    SELECT t.user_id, date_trunc('hour', t.created_at) AS tx_hour, count(*) AS tx_count, sum(t.amount) AS total_amt
    FROM public.transactions t
    WHERE t.user_id IS NOT NULL
      AND t.payment_method IS DISTINCT FROM 'fixed_savings'
      AND t.type IN ('deposit', 'withdrawal', 'transfer', 'contribution')
      AND t.created_at >= now() - interval '30 days'
    GROUP BY t.user_id, date_trunc('hour', t.created_at)
    HAVING count(*) >= 5
  ) v
  ON CONFLICT (alert_key) DO NOTHING;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_inserted := v_inserted + v_row_count;

  -- Rule 4: Rapid Pass-Through / Layering
  INSERT INTO public.aml_alerts (
    alert_key, user_id, transaction_id, alert_type, severity, risk_score, amount, title, description, evidence
  )
  SELECT
    'passthrough:' || d.id::text,
    d.user_id,
    d.id,
    'rapid_passthrough',
    'critical',
    88,
    d.amount,
    'Rapid Deposit-to-Outflow Pass-Through',
    format('Deposit of NGN %s was followed by NGN %s in outbound transfers/withdrawals within 2 hours.',
      to_char(d.amount, 'FM999,999,999,990.00'), to_char(o.outflow, 'FM999,999,999,990.00')
    ),
    jsonb_build_object('rule', 'rapid_passthrough_2h', 'deposit_amount', d.amount, 'outflow_amount', o.outflow, 'deposit_time', d.created_at)
  FROM public.transactions d
  CROSS JOIN LATERAL (
    SELECT COALESCE(sum(t2.amount), 0) AS outflow
    FROM public.transactions t2
    WHERE t2.user_id = d.user_id
      AND t2.payment_method IS DISTINCT FROM 'fixed_savings'
      AND t2.type IN ('withdrawal', 'transfer')
      AND t2.created_at >= d.created_at
      AND t2.created_at <= d.created_at + interval '2 hours'
  ) o
  WHERE d.payment_method IS DISTINCT FROM 'fixed_savings'
    AND d.type = 'deposit'
    AND d.amount >= 100000
    AND d.created_at >= now() - interval '30 days'
    AND o.outflow >= (d.amount * 0.8)
  ON CONFLICT (alert_key) DO NOTHING;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_inserted := v_inserted + v_row_count;

  -- Rule 5: High Volume Without BVN Verification
  INSERT INTO public.aml_alerts (
    alert_key, user_id, alert_type, severity, risk_score, amount, title, description, evidence
  )
  SELECT
    'unverified_vol:' || p.id::text || ':' || to_char(now(), 'YYYY-MM'),
    p.id,
    'unverified_high_volume',
    CASE WHEN u.vol >= 1000000 THEN 'high' ELSE 'medium' END,
    CASE WHEN u.vol >= 1000000 THEN 76 ELSE 62 END,
    u.vol,
    'Unverified KYC High Volume',
    format('Account transacted NGN %s over 30 days without verified BVN on file.',
      to_char(u.vol, 'FM999,999,999,990.00')
    ),
    jsonb_build_object('rule', 'missing_bvn_high_volume', 'volume_30d', u.vol, 'tx_count', u.tx_count)
  FROM public.profiles p
  JOIN (
    SELECT user_id, sum(amount) AS vol, count(*) AS tx_count
    FROM public.transactions
    WHERE user_id IS NOT NULL
      AND payment_method IS DISTINCT FROM 'fixed_savings'
      AND type IN ('deposit', 'withdrawal', 'transfer', 'contribution')
      AND created_at >= now() - interval '30 days'
    GROUP BY user_id
    HAVING sum(amount) >= 250000
  ) u ON u.user_id = p.id
  WHERE p.bvn IS NULL OR length(trim(p.bvn)) < 11
  ON CONFLICT (alert_key) DO NOTHING;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_inserted := v_inserted + v_row_count;

  -- Rule 6: Unverified / High-Risk Outside Payments (>= NGN 250,000 unverified external bank/card transfer)
  INSERT INTO public.aml_alerts (
    alert_key, user_id, group_id, transaction_id, alert_type, severity, risk_score, amount, title, description, evidence
  )
  SELECT
    'ext_unverified:' || e.id::text,
    e.user_id,
    e.group_id,
    e.transaction_id,
    'external_payment_risk',
    CASE WHEN e.amount >= 500000 THEN 'critical' ELSE 'high' END,
    CASE WHEN e.amount >= 500000 THEN 89 ELSE 75 END,
    e.amount,
    'Unverified Outside Payment Above Threshold',
    format('External %s of NGN %s from %s (%s) requires source-of-funds verification.',
      replace(e.source_channel, '_', ' '),
      to_char(e.amount, 'FM999,999,999,990.00'),
      COALESCE(e.sender_name, 'Unidentified outside sender'),
      COALESCE(e.sender_bank, 'External bank')
    ),
    jsonb_build_object('rule', 'unverified_external_250k', 'track_id', e.id, 'reference_id', e.reference_id, 'sender_name', e.sender_name, 'sender_bank', e.sender_bank)
  FROM public.external_payment_tracks e
  WHERE e.verification_status IN ('unverified', 'flagged')
    AND e.amount >= 250000
    AND e.created_at >= now() - interval '60 days'
  ON CONFLICT (alert_key) DO NOTHING;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_inserted := v_inserted + v_row_count;

  -- Rule 7: Rapid Group Churn (>= 4 groups created by same account within 7 days)
  INSERT INTO public.aml_alerts (
    alert_key, user_id, alert_type, severity, risk_score, amount, title, description, evidence
  )
  SELECT
    'group_churn_7d:' || c.creator_id::text || ':' || to_char(now(), 'IYYY-IW'),
    c.creator_id,
    'rapid_group_churn',
    'high',
    77,
    c.total_targets,
    'Unusual Multi-Group Creation Pattern',
    format('Account created %s contribution groups within 7 days (total target NGN %s).',
      c.grp_count, to_char(c.total_targets, 'FM999,999,999,990.00')
    ),
    jsonb_build_object('rule', 'rapid_group_creation_7d', 'group_count', c.grp_count, 'total_targets', c.total_targets)
  FROM (
    SELECT creator_id, count(*) AS grp_count, COALESCE(sum(target_amount), 0) AS total_targets
    FROM public.contribution_groups
    WHERE creator_id IS NOT NULL
      AND created_at >= now() - interval '7 days'
    GROUP BY creator_id
    HAVING count(*) >= 4
  ) c
  ON CONFLICT (alert_key) DO NOTHING;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_inserted := v_inserted + v_row_count;

  SELECT count(*) INTO v_open_count
  FROM public.aml_alerts
  WHERE status IN ('open', 'investigating', 'escalated');

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, summary, metadata)
  VALUES (
    auth.uid(),
    'aml_scan',
    'system',
    'aml_engine',
    format('Ran 7-rule AML compliance scan: %s new alert(s), %s active alert(s)', v_inserted, v_open_count),
    jsonb_build_object('new_alerts', v_inserted, 'active_alerts', v_open_count)
  );

  RETURN json_build_object('success', true, 'new_alerts', v_inserted, 'active_alerts', v_open_count);
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
