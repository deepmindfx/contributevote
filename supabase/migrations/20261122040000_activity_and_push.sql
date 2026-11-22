BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'transactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS tx_user_month_idx ON public.transactions (user_id, created_at, id);
CREATE INDEX IF NOT EXISTS tx_group_month_idx ON public.transactions (contribution_id, created_at);

CREATE OR REPLACE FUNCTION public.get_group_transfer_analytics(p_group_id uuid, p_start timestamptz, p_end timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_report jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.contribution_groups WHERE id = p_group_id AND creator_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Group owner access required'; END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_end <= p_start OR p_end - p_start > interval '32 days' THEN
    RAISE EXCEPTION 'Select a valid month';
  END IF;
  WITH rows AS (
    SELECT
      (t.created_at AT TIME ZONE 'Africa/Lagos')::date AS day,
      lower(coalesce(t.status, 'pending')) AS status,
      t.type,
      CASE WHEN t.type = 'withdrawal' AND t.metadata->>'gross_amount' ~ '^[0-9]+([.][0-9]+)?$'
        THEN (t.metadata->>'gross_amount')::numeric ELSE t.amount END AS amount,
      CASE WHEN t.type = 'withdrawal' AND t.metadata->>'fee' ~ '^[0-9]+([.][0-9]+)?$' THEN (t.metadata->>'fee')::numeric ELSE 0 END AS fee,
      (t.type = 'contribution' AND t.payment_method = 'bank_transfer' AND
        (t.metadata->>'requiresVerification' = 'true' OR t.metadata->>'outside_group_transfer' = 'true'
          OR EXISTS (SELECT 1 FROM public.external_payment_tracks e WHERE e.transaction_id=t.id AND e.source_channel='group_bank_transfer'))) AS outside_bank
    FROM public.transactions t
    WHERE t.contribution_id = p_group_id AND t.created_at >= p_start AND t.created_at < p_end
      AND t.type IN ('contribution', 'withdrawal', 'refund')
  ), settled AS (
    SELECT * FROM rows WHERE status IN ('completed','successful','success','paid')
  ), buckets AS (
    SELECT day, coalesce(sum(amount) FILTER (WHERE type = 'contribution'), 0) AS incoming,
      coalesce(sum(amount) FILTER (WHERE type IN ('withdrawal','refund')), 0) AS outgoing
    FROM settled GROUP BY day
  ), days AS (
    SELECT day::date FROM generate_series((p_start AT TIME ZONE 'Africa/Lagos')::date,
      ((p_end - interval '1 microsecond') AT TIME ZONE 'Africa/Lagos')::date, interval '1 day') AS series(day)
  ), breakdown AS (
    SELECT CASE WHEN type='refund' THEN 'Refunds' WHEN type='withdrawal' THEN 'Group withdrawals'
      WHEN outside_bank THEN 'Outside bank transfers' ELSE 'In-app contributions' END AS label, count(*) AS count, sum(amount) AS amount
      FROM settled GROUP BY 1
  )
  SELECT jsonb_build_object(
    'incoming', coalesce((SELECT sum(amount) FROM settled WHERE type = 'contribution'),0),
    'outgoing', coalesce((SELECT sum(amount) FROM settled WHERE type IN ('withdrawal','refund')),0),
    'count', (SELECT count(*) FROM rows),
    'pending', (SELECT count(*) FROM rows WHERE status IN ('new','pending','processing')),
    'failed', (SELECT count(*) FROM rows WHERE status IN ('failed','rejected','cancelled')),
    'bankTransfers', (SELECT count(*) FROM settled WHERE outside_bank),
    'bankTotal', coalesce((SELECT sum(amount) FROM settled WHERE outside_bank),0),
    'fees', coalesce((SELECT sum(fee) FROM settled),0),
    'daily', coalesce((SELECT jsonb_agg(jsonb_build_object('day', extract(day FROM days.day),
      'incoming', coalesce(buckets.incoming,0), 'outgoing', coalesce(buckets.outgoing,0)) ORDER BY days.day)
      FROM days LEFT JOIN buckets USING (day)), '[]'::jsonb),
    'breakdown', coalesce((SELECT jsonb_agg(to_jsonb(breakdown) ORDER BY amount DESC) FROM breakdown),'[]'::jsonb)
  ) INTO v_report;
  RETURN v_report;
END;
$$;
REVOKE ALL ON FUNCTION public.get_group_transfer_analytics(uuid,timestamptz,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_transfer_analytics(uuid,timestamptz,timestamptz) TO authenticated;

CREATE TABLE IF NOT EXISTS public.push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE, p256dh text NOT NULL, auth_key text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_device_owner_idx ON public.push_devices(user_id);
CREATE TABLE IF NOT EXISTS public.push_delivery_queue (
  notification_id uuid REFERENCES public.notifications(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.push_devices(id) ON DELETE CASCADE,
  attempts integer NOT NULL DEFAULT 0, due_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id,device_id)
);
CREATE INDEX IF NOT EXISTS push_delivery_due_idx ON public.push_delivery_queue(due_at);
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_delivery_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_devices, public.push_delivery_queue FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.push_devices TO service_role;
GRANT SELECT, UPDATE, DELETE ON public.push_delivery_queue TO service_role;

CREATE OR REPLACE FUNCTION public.set_push_device(p_endpoint text, p_key text, p_auth text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR length(p_endpoint)>2048 OR p_endpoint IS NULL OR p_key IS NULL OR p_auth IS NULL
    OR p_endpoint !~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|([a-z0-9-]+[.])*push[.]apple[.]com|([a-z0-9-]+[.])*notify[.]windows[.]com)/'
    OR p_key !~ '^[a-zA-Z0-9_-]{80,100}={0,2}$' OR p_auth !~ '^[a-zA-Z0-9_-]{20,30}={0,2}$' THEN
    RAISE EXCEPTION 'This browser notification subscription is unavailable';
  END IF;
  INSERT INTO public.push_devices(user_id,endpoint,p256dh,auth_key)
  VALUES(auth.uid(),p_endpoint,p_key,p_auth)
  ON CONFLICT(endpoint) DO UPDATE SET user_id=EXCLUDED.user_id, p256dh=EXCLUDED.p256dh,
    auth_key=EXCLUDED.auth_key, updated_at=now();
END;
$$;
CREATE OR REPLACE FUNCTION public.remove_push_device(p_endpoint text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$
  DELETE FROM public.push_devices WHERE user_id=auth.uid() AND endpoint=p_endpoint;
$$;
REVOKE ALL ON FUNCTION public.set_push_device(text,text,text), public.remove_push_device(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_push_device(text,text,text), public.remove_push_device(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.notification_category(p_type text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_type IN ('wallet_deposit','transfer_completed','transfer_failed','wallet_debit','wallet_credit','refund_completed') THEN 'wallet'
    WHEN p_type IN ('bank_transfer_received','group_payment_received','contribution_verified') THEN 'group'
    ELSE 'activity'
  END;
$$;
CREATE OR REPLACE FUNCTION public.notification_allowed(p_type text, p_preferences jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT coalesce(CASE public.notification_category(p_type)
    WHEN 'wallet' THEN p_preferences->>'walletNotifications'
    WHEN 'group' THEN p_preferences->>'groupNotifications'
    ELSE p_preferences->>'notificationsEnabled' END, 'true') <> 'false';
$$;

CREATE OR REPLACE FUNCTION public.enqueue_device_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.push_delivery_queue(notification_id,device_id)
  SELECT NEW.id,d.id FROM public.push_devices d JOIN public.profiles p ON p.id=d.user_id
  WHERE d.user_id=NEW.user_id AND public.notification_allowed(NEW.type,p.preferences)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE INSERT ON public.notifications FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS enqueue_device_notification ON public.notifications;
CREATE TRIGGER enqueue_device_notification AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.enqueue_device_notification();

CREATE OR REPLACE FUNCTION public.claim_push_delivery_batch()
RETURNS TABLE (notification_id uuid, device_id uuid, attempts integer, endpoint text, p256dh text, auth_key text, title text, message text, kind text, group_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.push_delivery_queue q WHERE q.created_at < now() - interval '1 day' OR q.attempts >= 6;
  DELETE FROM public.push_delivery_queue q USING public.notifications n,public.push_devices d,public.profiles p
  WHERE n.id=q.notification_id AND d.id=q.device_id AND p.id=d.user_id
    AND (d.user_id<>n.user_id OR NOT public.notification_allowed(n.type,p.preferences));
  RETURN QUERY WITH locked AS (
    SELECT q.notification_id,q.device_id FROM public.push_delivery_queue q
    WHERE q.due_at<=now() ORDER BY q.due_at LIMIT 60 FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.push_delivery_queue q SET attempts=q.attempts+1, due_at=now()+interval '3 minutes'
    FROM locked l WHERE q.notification_id=l.notification_id AND q.device_id=l.device_id
    RETURNING q.notification_id,q.device_id,q.attempts
  )
  SELECT c.notification_id,c.device_id,c.attempts,d.endpoint,d.p256dh,d.auth_key,n.title,n.message,public.notification_category(n.type),
    CASE WHEN public.notification_category(n.type)='group' THEN n.related_id ELSE NULL END
  FROM claimed c JOIN public.push_devices d ON d.id=c.device_id JOIN public.notifications n ON n.id=c.notification_id
  WHERE d.user_id=n.user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_push_delivery_batch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_delivery_batch() TO service_role;

CREATE OR REPLACE FUNCTION public.notify_settled_wallet_or_group()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_group public.contribution_groups%ROWTYPE;
BEGIN
  IF NEW.status IS DISTINCT FROM 'completed' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.status='completed' THEN RETURN NEW; END IF;
  IF NEW.type='transfer' AND NEW.user_id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id,type,title,message)
    VALUES(NEW.user_id,'transfer_completed','Transfer sent','₦' || NEW.amount || ' was sent from your wallet.');
  ELSIF NEW.type='contribution' AND NEW.contribution_id IS NOT NULL
      AND (NEW.payment_method='wallet' OR NEW.metadata->>'txRef' LIKE 'CP_CHECKOUT_%') THEN
    SELECT * INTO v_group FROM public.contribution_groups WHERE id=NEW.contribution_id;
    IF v_group.creator_id IS NOT NULL THEN
      INSERT INTO public.notifications(user_id,type,title,message,related_id)
      VALUES(v_group.creator_id,'group_payment_received','Group payment received','₦' || NEW.amount || ' was added to ' || v_group.name || '.',v_group.id);
    END IF;
  ELSIF NEW.type='deposit' AND NEW.user_id IS NOT NULL AND NEW.metadata->>'txRef' LIKE 'CP_CHECKOUT_%' THEN
    INSERT INTO public.notifications(user_id,type,title,message)
    VALUES(NEW.user_id,'wallet_deposit','Money received','₦' || NEW.amount || ' was added to your wallet.');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_settled_wallet_or_group ON public.transactions;
CREATE TRIGGER notify_settled_wallet_or_group AFTER INSERT OR UPDATE OF status ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.notify_settled_wallet_or_group();

CREATE OR REPLACE FUNCTION public.guard_notification_ledger()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon','authenticated') AND (
    (NEW.type='contribution' AND NEW.payment_method='wallet') OR NEW.metadata->>'txRef' LIKE 'CP_CHECKOUT_%'
  ) THEN RAISE EXCEPTION 'These ledger entries are managed by the payment service'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_notification_ledger ON public.transactions;
CREATE TRIGGER guard_notification_ledger BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.guard_notification_ledger();

DO $schedule$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL AND to_regnamespace('net') IS NOT NULL AND to_regnamespace('vault') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'deliver-collectipay-web-push') THEN
      PERFORM cron.unschedule('deliver-collectipay-web-push');
    END IF;
    PERFORM cron.schedule('deliver-collectipay-web-push', '* * * * *', $j$
      SELECT net.http_post(
        url := 'https://sivvjwffekhfabgxhbcd.supabase.co/functions/v1/deliver-web-push',
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || decrypted_secret),
        body := '{}'::jsonb
      ) FROM vault.decrypted_secrets WHERE name='collectipay_cron_bearer' LIMIT 1
    $j$);
  END IF;
END;
$schedule$;
COMMIT;
