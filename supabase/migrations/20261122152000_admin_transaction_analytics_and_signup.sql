BEGIN;

CREATE INDEX IF NOT EXISTS admin_ledger_date_idx ON public.transactions(created_at)
 WHERE type IN ('deposit','withdrawal','transfer','contribution','refund','payment');
CREATE INDEX IF NOT EXISTS admin_ledger_owner_date_idx ON public.transactions(user_id,created_at)
 WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS admin_ledger_group_date_idx ON public.transactions(contribution_id,created_at)
 WHERE contribution_id IS NOT NULL;

CREATE FUNCTION public.admin_transaction_analytics(
  p_start timestamptz, p_end timestamptz, p_scope text, p_entity_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_end<=p_start OR p_end-p_start>interval '32 days'
    OR p_scope IS NULL OR p_scope NOT IN ('platform','account','group') OR (p_scope<>'platform' AND p_entity_id IS NULL) THEN
    RAISE EXCEPTION 'Select a valid month and scope';
  END IF;
  RETURN (
    WITH entries AS MATERIALIZED (
      SELECT type,lower(status) AS status,amount,created_at,(created_at AT TIME ZONE 'Africa/Lagos')::date AS day
      FROM public.transactions t WHERE t.created_at>=p_start AND t.created_at<p_end
        AND t.type IN ('deposit','withdrawal','transfer','contribution','refund','payment')
        AND (p_scope='platform' OR (p_scope='account' AND t.user_id=p_entity_id) OR (p_scope='group' AND t.contribution_id=p_entity_id))
    ), totals AS (
      SELECT count(*) AS transactions,
        count(*) FILTER (WHERE status IN ('completed','successful','success','paid')) AS settled,
        count(*) FILTER (WHERE status IN ('pending','processing','new')) AS pending,
        count(*) FILTER (WHERE status IN ('failed','cancelled','canceled','rejected')) AS failed,
        count(*) FILTER (WHERE type='transfer' AND status='pending' AND created_at<now()-interval '30 minutes') AS unreconciled,
        coalesce(sum(amount) FILTER (WHERE status IN ('completed','successful','success','paid')),0) AS volume
      FROM entries
    ), daily AS (
      SELECT day,count(*) AS count,sum(amount) AS amount FROM entries WHERE status IN ('completed','successful','success','paid') GROUP BY day
    ), kinds AS (
      SELECT type,count(*) AS count,sum(amount) AS amount FROM entries WHERE status IN ('completed','successful','success','paid') GROUP BY type
    )
    SELECT to_jsonb(totals) || jsonb_build_object(
      'daily',coalesce((SELECT jsonb_agg(to_jsonb(daily) ORDER BY day) FROM daily),'[]'),
      'breakdown',coalesce((SELECT jsonb_agg(to_jsonb(kinds) ORDER BY amount DESC) FROM kinds),'[]')
    ) FROM totals
  );
END;
$$;

CREATE FUNCTION public.admin_search_transaction_entities(p_scope text,p_search text)
RETURNS TABLE (id uuid, name text, description text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_search text := trim(coalesce(p_search,''));
BEGIN
  IF NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF length(v_search)>120 THEN RETURN; END IF;
  IF p_scope='account' THEN
    RETURN QUERY SELECT p.id,coalesce(nullif(p.name,''),p.email,'Unnamed account'),p.email
    FROM public.profiles p
    WHERE v_search='' OR strpos(lower(coalesce(p.name,'')),lower(v_search))>0
      OR strpos(lower(coalesce(p.email,'')),lower(v_search))>0 OR p.id::text=v_search
    ORDER BY p.created_at DESC NULLS LAST,p.id LIMIT 25;
  ELSIF p_scope='group' THEN
    RETURN QUERY SELECT g.id,g.name,g.category
    FROM public.contribution_groups g
    WHERE v_search='' OR strpos(lower(coalesce(g.name,'')),lower(v_search))>0 OR g.id::text=v_search
    ORDER BY g.created_at DESC NULLS LAST,g.id LIMIT 25;
  ELSE RAISE EXCEPTION 'Invalid analytics scope';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_transaction_analytics(timestamptz,timestamptz,text,uuid),
  public.admin_search_transaction_entities(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_transaction_analytics(timestamptz,timestamptz,text,uuid),
  public.admin_search_transaction_entities(text,text) TO authenticated;

CREATE FUNCTION public.require_signup_phone(event jsonb)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT CASE WHEN coalesce(event#>>'{user,user_metadata,phone}',event#>>'{user,raw_user_meta_data,phone}',event#>>'{user,phone}','')
    ~ '^[+]?[1-9][0-9]{7,14}$' THEN '{}'::jsonb
    ELSE '{"error":{"http_code":400,"message":"Enter a valid phone number to create an account."}}'::jsonb END;
$$;
-- Supabase supplies user_metadata in the Auth hook event. Accept the database-key form, too.
REVOKE ALL ON FUNCTION public.require_signup_phone(jsonb) FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.require_signup_phone(jsonb) TO supabase_auth_admin;

COMMIT;
