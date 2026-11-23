BEGIN;

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  category text NOT NULL CHECK (category IN ('general','transfer','bulk_transfer','ice_vault','group_withdrawal','group_refund')),
  reference text,
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 5 AND 100),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','waiting','resolved')),
  revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id,client_id)
);
CREATE INDEX support_tickets_owner ON public.support_tickets(user_id,created_at DESC,id DESC);
CREATE INDEX support_tickets_status ON public.support_tickets(status,created_at DESC,id DESC);
CREATE INDEX support_tickets_recent ON public.support_tickets(created_at DESC,id DESC);

CREATE TABLE public.support_ticket_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_id uuid NOT NULL,
  from_support boolean NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 2 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id,author_id,client_id)
);
CREATE INDEX support_ticket_message_order ON public.support_ticket_messages(ticket_id,id DESC);

CREATE TABLE public.support_ticket_status_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  previous_status text NOT NULL,
  new_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_status_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_tickets,public.support_ticket_messages,public.support_ticket_status_events FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.support_actor(p_admin boolean)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL OR NOT EXISTS (
    SELECT FROM public.profiles WHERE id=v_user AND (p_admin IS NOT TRUE OR (role='admin' AND coalesce(status,'active')='active'))
  ) THEN RAISE EXCEPTION 'Support access denied.' USING ERRCODE='42501'; END IF;
  RETURN v_user;
END;
$$;

CREATE FUNCTION public.create_support_ticket(p_client_id uuid,p_category text,p_reference text,p_subject text,p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_user uuid := public.support_actor(false);
  v_id uuid;
  v_reference text := nullif(trim(p_reference),'');
  v_object_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('support_ticket:' || v_user,0));
  SELECT id INTO v_id FROM public.support_tickets WHERE user_id=v_user AND client_id=p_client_id;
  IF FOUND THEN RETURN v_id; END IF;
  IF p_client_id IS NULL OR p_category IS NULL OR p_category NOT IN ('general','transfer','bulk_transfer','ice_vault','group_withdrawal','group_refund')
    OR char_length(coalesce(trim(p_subject),'')) NOT BETWEEN 5 AND 100
    OR char_length(coalesce(trim(p_body),'')) NOT BETWEEN 2 AND 4000
    OR char_length(v_reference)>120 THEN
    RAISE EXCEPTION 'Check the subject, topic, and message.';
  END IF;
  IF v_reference IS NOT NULL THEN
    IF v_reference ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' THEN v_object_id := v_reference::uuid; END IF;
    IF NOT (CASE p_category
      WHEN 'transfer' THEN EXISTS (SELECT FROM public.transactions WHERE user_id=v_user AND type='transfer' AND bulk_batch_id IS NULL
        AND (reference_id=v_reference OR id=v_object_id))
      WHEN 'group_withdrawal' THEN EXISTS (SELECT FROM public.transactions WHERE user_id=v_user AND type='withdrawal'
        AND contribution_id IS NOT NULL AND (reference_id=v_reference OR id=v_object_id))
        OR EXISTS (SELECT FROM public.withdrawal_requests WHERE requester_id=v_user AND id=v_object_id)
      WHEN 'group_refund' THEN EXISTS (SELECT FROM public.transactions WHERE user_id=v_user AND type='refund'
        AND contribution_id IS NOT NULL AND (reference_id=v_reference OR id=v_object_id))
        OR EXISTS (SELECT FROM public.group_refund_requests WHERE requester_id=v_user AND id=v_object_id)
      WHEN 'bulk_transfer' THEN EXISTS (SELECT FROM public.bulk_transfer_batches WHERE id=v_object_id AND user_id=v_user AND authorized_at IS NOT NULL)
      WHEN 'ice_vault' THEN EXISTS (SELECT FROM public.fixed_savings WHERE id=v_object_id AND user_id=v_user)
      ELSE false END)
    THEN RAISE EXCEPTION 'That reference is unavailable for your account and topic.'; END IF;
  END IF;
  IF (SELECT count(*) FROM public.support_tickets WHERE user_id=v_user AND created_at>=now()-interval '1 hour')>=8 THEN
    RAISE EXCEPTION 'You can follow up on an existing ticket. Try opening a new one later.';
  END IF;
  INSERT INTO public.support_tickets(user_id,client_id,category,reference,subject)
    VALUES(v_user,p_client_id,p_category,v_reference,trim(p_subject)) RETURNING id INTO v_id;
  INSERT INTO public.support_ticket_messages(ticket_id,author_id,client_id,from_support,body)
    VALUES(v_id,v_user,p_client_id,false,trim(p_body));
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.list_support_tickets(
  p_admin boolean,p_status text,p_search text,p_before timestamptz,p_before_id uuid,p_category text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_user uuid := public.support_actor(p_admin);
  v_search text := lower(left(trim(coalesce(p_search,'')),120));
BEGIN
  RETURN coalesce((
    SELECT jsonb_agg((to_jsonb(t)-ARRAY['user_id','client_id']) ||
        CASE WHEN p_admin IS TRUE THEN jsonb_build_object('owner_name',p.name) ELSE '{}'::jsonb END
      ORDER BY t.created_at DESC,t.id DESC)
    FROM (
      SELECT * FROM public.support_tickets t
      WHERE (p_admin IS TRUE OR t.user_id=v_user) AND (p_status IS NULL OR t.status=p_status)
        AND (p_category IS NULL OR t.category=p_category)
        AND (p_before IS NULL OR (t.created_at,t.id)<(p_before,p_before_id))
        AND (v_search='' OR strpos(lower(t.subject),v_search)>0 OR strpos(lower(coalesce(t.reference,'')),v_search)>0
          OR strpos(t.id::text,v_search)>0)
      ORDER BY t.created_at DESC,t.id DESC LIMIT 31
    ) t JOIN public.profiles p ON p.id=t.user_id
  ),'[]'::jsonb);
END;
$$;

CREATE FUNCTION public.get_support_ticket(p_ticket_id uuid,p_admin boolean,p_before_message bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid := public.support_actor(p_admin);
BEGIN
  RETURN (
    SELECT (to_jsonb(t)-ARRAY['user_id','client_id']) ||
      jsonb_build_object('messages',coalesce((
        SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id DESC) FROM (
          SELECT id,from_support,body,created_at FROM public.support_ticket_messages
          WHERE ticket_id=t.id AND (p_before_message IS NULL OR id<p_before_message)
          ORDER BY id DESC LIMIT 31
        ) m
      ),'[]'::jsonb)) || CASE WHEN p_admin IS TRUE THEN jsonb_build_object('owner_name',p.name) ELSE '{}'::jsonb END
    FROM public.support_tickets t JOIN public.profiles p ON p.id=t.user_id
    WHERE t.id=p_ticket_id AND (p_admin IS TRUE OR t.user_id=v_user)
  );
END;
$$;

CREATE FUNCTION public.reply_support_ticket(p_ticket_id uuid,p_admin boolean,p_client_id uuid,p_body text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_user uuid := public.support_actor(p_admin);
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.support_tickets
    WHERE id=p_ticket_id AND (p_admin IS TRUE OR user_id=v_user) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket unavailable.' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT FROM public.support_ticket_messages WHERE ticket_id=p_ticket_id AND author_id=v_user AND client_id=p_client_id) THEN
    RETURN true;
  END IF;
  IF v_status='resolved' THEN RAISE EXCEPTION 'This ticket has been resolved.'; END IF;
  IF p_client_id IS NULL OR char_length(coalesce(trim(p_body),'')) NOT BETWEEN 2 AND 4000 THEN
    RAISE EXCEPTION 'Enter a message between 2 and 4,000 characters.';
  END IF;
  IF (SELECT count(*) FROM public.support_ticket_messages WHERE ticket_id=p_ticket_id AND author_id=v_user
    AND created_at>=now()-interval '1 minute')>=10 THEN RAISE EXCEPTION 'Try sending another reply in a minute.'; END IF;
  INSERT INTO public.support_ticket_messages(ticket_id,author_id,client_id,from_support,body)
    VALUES(p_ticket_id,v_user,p_client_id,p_admin IS TRUE,trim(p_body));
  UPDATE public.support_tickets SET revision=revision+1,updated_at=now() WHERE id=p_ticket_id;
  RETURN true;
END;
$$;

CREATE FUNCTION public.admin_update_support_tickets(p_status text,p_tickets jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_admin uuid := public.support_actor(true);
  v_ticket record;
  v_count integer := 0;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('open','in_review','waiting','resolved')
    OR jsonb_typeof(p_tickets) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Choose tickets and a valid status.'; END IF;
  IF jsonb_array_length(p_tickets) NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Select up to 30 tickets.'; END IF;
  FOR v_ticket IN
    SELECT t.id,t.status FROM public.support_tickets t
    WHERE t.status<>p_status AND EXISTS (SELECT FROM jsonb_to_recordset(p_tickets) x(id uuid,revision integer)
      WHERE t.id=x.id AND t.revision=x.revision)
    ORDER BY t.id FOR UPDATE
  LOOP
    UPDATE public.support_tickets SET status=p_status,revision=revision+1,updated_at=now() WHERE id=v_ticket.id;
    INSERT INTO public.support_ticket_status_events(ticket_id,admin_id,previous_status,new_status)
      VALUES(v_ticket.id,v_admin,v_ticket.status,p_status);
    v_count := v_count+1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.support_actor(boolean),public.create_support_ticket(uuid,text,text,text,text),
  public.list_support_tickets(boolean,text,text,timestamptz,uuid,text),public.get_support_ticket(uuid,boolean,bigint),
  public.reply_support_ticket(uuid,boolean,uuid,text),public.admin_update_support_tickets(text,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_support_ticket(uuid,text,text,text,text),
  public.list_support_tickets(boolean,text,text,timestamptz,uuid,text),public.get_support_ticket(uuid,boolean,bigint),
  public.reply_support_ticket(uuid,boolean,uuid,text),public.admin_update_support_tickets(text,jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';

COMMIT;
