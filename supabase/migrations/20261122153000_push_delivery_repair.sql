BEGIN;

ALTER TABLE public.push_devices ADD COLUMN last_delivered_at timestamptz, ADD COLUMN last_error text;

CREATE FUNCTION public.get_my_push_device_status(p_endpoint text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT jsonb_build_object('registered',true,'last_delivered_at',last_delivered_at,'last_error',last_error)
  FROM public.push_devices WHERE user_id=auth.uid() AND endpoint=p_endpoint;
$$;

CREATE FUNCTION public.send_my_push_test(p_endpoint text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_device uuid;
  v_notification uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('push-test:' || auth.uid()::text,0));
  SELECT id INTO v_device FROM public.push_devices WHERE user_id=auth.uid() AND endpoint=p_endpoint FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF EXISTS (SELECT FROM public.notifications WHERE user_id=auth.uid() AND type='device_push_test' AND created_at>now()-interval '30 seconds') THEN
    RAISE EXCEPTION 'Wait a moment before sending another test.';
  END IF;
  INSERT INTO public.notifications(user_id,type,title,message)
    VALUES(auth.uid(),'device_push_test','CollectiPay alerts are on','This device can receive CollectiPay notifications.')
    RETURNING id INTO v_notification;
  INSERT INTO public.push_delivery_queue(notification_id,device_id) VALUES(v_notification,v_device);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_device_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.type='device_push_test' THEN RETURN NEW; END IF;
  INSERT INTO public.push_delivery_queue(notification_id,device_id)
  SELECT NEW.id,d.id FROM public.push_devices d JOIN public.profiles p ON p.id=d.user_id
  WHERE d.user_id=NEW.user_id AND public.notification_allowed(NEW.type,p.preferences)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP FUNCTION public.claim_push_delivery_batch();
CREATE FUNCTION public.claim_push_delivery_batch()
RETURNS TABLE (notification_id uuid,device_id uuid,attempts integer,endpoint text,p256dh text,auth_key text,
  title text,message text,kind text,group_id uuid,notification_type text,vibration_enabled boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.push_delivery_queue q WHERE q.created_at<now()-interval '1 day' OR q.attempts>=6;
  DELETE FROM public.push_delivery_queue q USING public.notifications n,public.push_devices d,public.profiles p
  WHERE n.id=q.notification_id AND d.id=q.device_id AND p.id=d.user_id AND
    (d.user_id<>n.user_id OR (n.type<>'device_push_test' AND NOT public.notification_allowed(n.type,p.preferences)));

  RETURN QUERY WITH locked AS (
    SELECT q.notification_id,q.device_id FROM public.push_delivery_queue q
    WHERE q.due_at<=now() ORDER BY q.due_at LIMIT 60 FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.push_delivery_queue q SET attempts=q.attempts+1,due_at=now()+interval '3 minutes'
      FROM locked l WHERE q.notification_id=l.notification_id AND q.device_id=l.device_id
      RETURNING q.notification_id,q.device_id,q.attempts
  )
  SELECT c.notification_id,c.device_id,c.attempts,d.endpoint,d.p256dh,d.auth_key,n.title,n.message,
    public.notification_category(n.type),CASE WHEN public.notification_category(n.type)='group' THEN n.related_id END,n.type,
    coalesce(p.preferences->>'paymentVibration','true') <> 'false'
  FROM claimed c JOIN public.push_devices d ON d.id=c.device_id JOIN public.notifications n ON n.id=c.notification_id
    JOIN public.profiles p ON p.id=n.user_id WHERE d.user_id=n.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_push_device_status(text),public.send_my_push_test(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_push_device_status(text),public.send_my_push_test(text) TO authenticated;
REVOKE ALL ON FUNCTION public.claim_push_delivery_batch() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_delivery_batch() TO service_role;
GRANT UPDATE (last_delivered_at,last_error) ON public.push_devices TO service_role;

CREATE TABLE public.push_worker_wakeup (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),last_called_at timestamptz);
INSERT INTO public.push_worker_wakeup DEFAULT VALUES;
ALTER TABLE public.push_worker_wakeup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_worker_wakeup FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.is_push_worker_request(p_token text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' OR to_regnamespace('vault') IS NULL THEN RETURN false; END IF;
  RETURN coalesce((SELECT decrypted_secret=p_token FROM vault.decrypted_secrets
    WHERE name='collectipay_push_worker_token' LIMIT 1),false);
END;
$$;
REVOKE ALL ON FUNCTION public.is_push_worker_request(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.is_push_worker_request(text) TO service_role;

CREATE FUNCTION public.wake_collectipay_push_worker()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF to_regnamespace('net') IS NULL OR to_regnamespace('vault') IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url := cfg.decrypted_secret || '/functions/v1/deliver-web-push',
    headers := jsonb_build_object('Content-Type','application/json','x-collectipay-push-token',tok.decrypted_secret),
    body := '{}'::jsonb
  ) FROM vault.decrypted_secrets tok CROSS JOIN vault.decrypted_secrets cfg
  WHERE tok.name='collectipay_push_worker_token' AND cfg.name='collectipay_push_worker_base_url' LIMIT 1;
END;
$$;
REVOKE ALL ON FUNCTION public.wake_collectipay_push_worker() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.wake_push_on_queued_alert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT FROM queued_alerts) THEN RETURN NULL; END IF;
  PERFORM 1 FROM public.push_worker_wakeup WHERE singleton AND
    (last_called_at IS NULL OR last_called_at<now()-interval '5 seconds') FOR UPDATE SKIP LOCKED;
  IF FOUND THEN
    UPDATE public.push_worker_wakeup SET last_called_at=now() WHERE singleton;
    PERFORM public.wake_collectipay_push_worker();
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL; -- The periodic worker retries even if the immediate wake-up is unavailable.
END;
$$;

DO $setup$
BEGIN
  -- Each environment supplies its own public worker URL in Vault.
  IF to_regnamespace('cron') IS NULL OR to_regnamespace('net') IS NULL OR to_regnamespace('vault') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT FROM vault.secrets WHERE name='collectipay_push_worker_base_url') THEN RETURN; END IF;
  IF NOT EXISTS (SELECT FROM vault.secrets WHERE name='collectipay_push_worker_token') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'collectipay_push_worker_token');
  END IF;
  IF EXISTS (SELECT FROM cron.job WHERE jobname='deliver-collectipay-web-push') THEN
    PERFORM cron.unschedule('deliver-collectipay-web-push');
  END IF;
  PERFORM cron.schedule('deliver-collectipay-web-push','* * * * *','SELECT public.wake_collectipay_push_worker()');
  CREATE TRIGGER wake_push_on_queued_alert AFTER INSERT ON public.push_delivery_queue
    REFERENCING NEW TABLE AS queued_alerts FOR EACH STATEMENT EXECUTE FUNCTION public.wake_push_on_queued_alert();
END
$setup$;

COMMIT;
