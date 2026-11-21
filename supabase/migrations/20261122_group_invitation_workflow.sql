BEGIN;

-- Keep invitation history while allowing a creator to re-invite after expiry or revocation.
ALTER TABLE public.group_invitations DROP CONSTRAINT IF EXISTS unique_pending_invitation;
CREATE UNIQUE INDEX IF NOT EXISTS group_invitations_one_pending
  ON public.group_invitations (group_id, invitee_email) WHERE status = 'pending';

-- Invitation writes go through the functions below.
REVOKE INSERT, UPDATE, DELETE ON public.group_invitations FROM anon, authenticated;
DROP POLICY IF EXISTS "Users can view their invitations" ON public.group_invitations;
CREATE POLICY "Users can view their invitations"
  ON public.group_invitations FOR SELECT TO authenticated
  USING (invitee_id = auth.uid() OR lower(invitee_email) = lower(auth.jwt()->>'email'));

CREATE OR REPLACE FUNCTION public.create_group_invitation(p_group_id uuid, p_email text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_sender uuid := auth.uid();
  v_email text := lower(btrim(p_email));
  v_recipient uuid;
  v_group_name text;
  v_invitation public.group_invitations%ROWTYPE;
BEGIN
  IF v_sender IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sign in to invite someone.');
  END IF;
  IF v_email IS NULL OR length(v_email) > 254 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enter a valid email address.');
  END IF;

  SELECT g.name INTO v_group_name
  FROM public.contribution_groups g
  WHERE g.id = p_group_id AND g.creator_id = v_sender AND g.status = 'active' AND NOT coalesce(g.archived, false)
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the creator of an active group can send invitations.');
  END IF;

  SELECT p.id INTO v_recipient
  FROM auth.users u JOIN public.profiles p ON p.id = u.id
  WHERE lower(u.email) = v_email AND u.email_confirmed_at IS NOT NULL
  LIMIT 1;

  IF v_email = lower(auth.jwt()->>'email') OR EXISTS (
    SELECT 1 FROM public.contributors WHERE group_id = p_group_id AND user_id = v_recipient
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This person already belongs to the group.');
  END IF;

  UPDATE public.group_invitations SET status = 'expired'
  WHERE group_id = p_group_id AND invitee_email = v_email AND status = 'pending' AND expires_at <= now();

  SELECT * INTO v_invitation FROM public.group_invitations
  WHERE group_id = p_group_id AND invitee_email = v_email AND status = 'pending';
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'token', v_invitation.token);
  END IF;

  INSERT INTO public.group_invitations (group_id, inviter_id, invitee_email, invitee_id, token, expires_at)
  VALUES (p_group_id, v_sender, v_email, v_recipient, 'inv_' || replace(gen_random_uuid()::text, '-', ''), now() + interval '7 days')
  RETURNING * INTO v_invitation;

  IF v_recipient IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, related_id)
    VALUES (v_recipient, 'group_invitation', 'Group invitation', 'You were invited to join ' || v_group_name || '.', v_invitation.id);
  END IF;

  RETURN jsonb_build_object('success', true, 'token', v_invitation.token);
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_group_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_invitation public.group_invitations%ROWTYPE;
BEGIN
  SELECT lower(email) INTO v_email FROM auth.users
  WHERE id = v_user AND email_confirmed_at IS NOT NULL;
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sign in with the verified email that received this invitation.');
  END IF;

  SELECT * INTO v_invitation FROM public.group_invitations WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found.');
  END IF;
  IF lower(v_invitation.invitee_email) IS DISTINCT FROM v_email THEN
    RETURN jsonb_build_object('success', false, 'error', 'Use the email this invitation was sent to.');
  END IF;
  IF v_invitation.status = 'accepted' AND v_invitation.invitee_id = v_user THEN
    RETURN jsonb_build_object('success', true, 'group_id', v_invitation.group_id);
  END IF;
  IF v_invitation.status <> 'pending' OR v_invitation.expires_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has expired or been revoked.');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.contribution_groups
    WHERE id = v_invitation.group_id AND status = 'active' AND NOT coalesce(archived, false)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This group is no longer accepting members.');
  END IF;

  INSERT INTO public.contributors
    (group_id, user_id, amount, total_contributed, contribution_count, has_voting_rights, join_method, anonymous)
  SELECT v_invitation.group_id, v_user, 0, 0, 0, false, 'invitation', false
  WHERE NOT EXISTS (
    SELECT 1 FROM public.contributors WHERE group_id = v_invitation.group_id AND user_id = v_user
  )
  ON CONFLICT DO NOTHING;

  UPDATE public.group_invitations SET status = 'accepted', invitee_id = v_user, accepted_at = now()
  WHERE id = v_invitation.id;
  RETURN jsonb_build_object('success', true, 'group_id', v_invitation.group_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_group_invitation(p_invitation_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$
  WITH revoked AS (
    UPDATE public.group_invitations i SET status = 'expired'
    FROM public.contribution_groups g
    WHERE i.id = p_invitation_id AND i.group_id = g.id AND i.status = 'pending' AND g.creator_id = auth.uid()
    RETURNING i.id
  )
  SELECT EXISTS (SELECT 1 FROM revoked);
$$;

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_invitation public.group_invitations%ROWTYPE;
  v_group record;
  v_inviter text;
BEGIN
  SELECT * INTO v_invitation FROM public.group_invitations WHERE token = p_token;
  IF NOT FOUND OR NOT (
    (v_invitation.status = 'pending' AND v_invitation.expires_at > now())
    OR (v_invitation.status = 'accepted' AND v_invitation.invitee_id IS NOT DISTINCT FROM auth.uid() AND auth.uid() IS NOT NULL)
  ) THEN
    RETURN json_build_object('success', false, 'error', 'This invitation is unavailable or has expired.');
  END IF;

  SELECT id, name, description, target_amount, frequency, category, privacy,
    contribution_amount, end_date, enable_voting_rights, voting_threshold
  INTO v_group FROM public.contribution_groups
  WHERE id = v_invitation.group_id AND status = 'active' AND NOT coalesce(archived, false);
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'This group is no longer accepting members.');
  END IF;

  SELECT name INTO v_inviter FROM public.profiles WHERE id = v_invitation.inviter_id;
  RETURN json_build_object('success', true, 'invitation', json_build_object(
    'group_id', v_invitation.group_id,
    'status', v_invitation.status,
    'expires_at', v_invitation.expires_at,
    'group', row_to_json(v_group),
    'inviter', json_build_object('name', coalesce(v_inviter, 'Group creator'))
  ));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_group_invitation(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_group_invitation(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_group_invitation(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_invitation_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_group_invitation(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_group_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_group_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;

COMMIT;
