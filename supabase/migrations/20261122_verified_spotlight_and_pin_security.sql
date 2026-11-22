-- ============================================================================
-- Migration: 20261122_verified_spotlight_and_pin_security.sql
-- Purpose:
--   1. Special Verified Crowdfunder badge + Admin Spotlight / Push-to-Top
--      ("Most Needed", "Urgent Cause", "Verified", custom label) & priority
--      ordering on contribution_groups + verified organizer badge on profiles.
--   2. Server-side 4-digit Transaction PIN verification & setup RPCs, plus
--      strict server-side PIN enforcement on contribute_from_wallet,
--      create_withdrawal_request_safe, and process_instant_withdrawal.
-- ============================================================================

-- 1. Verified Crowdfunder & Spotlight / Push-to-Top columns on contribution_groups
ALTER TABLE public.contribution_groups
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS spotlight_label text,
  ADD COLUMN IF NOT EXISTS featured_priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verification_note text;

CREATE INDEX IF NOT EXISTS idx_contribution_groups_discover_spotlight
  ON public.contribution_groups (is_pinned DESC, featured_priority DESC, is_verified DESC, created_at DESC)
  WHERE privacy = 'public' AND archived = false;

-- 2. Verified Crowdfunder Organizer columns on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified_organizer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS organizer_badge_label text;

-- 3. Security triggers: prevent non-admin direct tampering with verification/spotlight columns
CREATE OR REPLACE FUNCTION public.guard_group_verification_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    NEW.is_verified := COALESCE(OLD.is_verified, false);
    NEW.is_pinned := COALESCE(OLD.is_pinned, false);
    NEW.spotlight_label := OLD.spotlight_label;
    NEW.featured_priority := COALESCE(OLD.featured_priority, 0);
    NEW.verified_at := OLD.verified_at;
    NEW.verified_by := OLD.verified_by;
    NEW.verification_note := OLD.verification_note;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_group_verification_columns ON public.contribution_groups;
CREATE TRIGGER trg_guard_group_verification_columns
  BEFORE UPDATE ON public.contribution_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_group_verification_columns();

CREATE OR REPLACE FUNCTION public.guard_profile_verification_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    NEW.is_verified_organizer := COALESCE(OLD.is_verified_organizer, false);
    NEW.organizer_badge_label := OLD.organizer_badge_label;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_verification_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_verification_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_verification_columns();

-- 4. Admin RPC: Verify crowdfunder group & push to top ("Most Needed", "Urgent Cause", custom label)
CREATE OR REPLACE FUNCTION public.admin_update_group_spotlight(
  p_group_id uuid,
  p_is_verified boolean DEFAULT NULL,
  p_is_pinned boolean DEFAULT NULL,
  p_spotlight_label text DEFAULT NULL,
  p_featured_priority integer DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_group public.contribution_groups%ROWTYPE;
  v_new_verified boolean;
  v_new_pinned boolean;
  v_new_label text;
  v_new_priority integer;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  SELECT * INTO v_group
  FROM public.contribution_groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Contribution group not found');
  END IF;

  v_new_verified := COALESCE(p_is_verified, v_group.is_verified, false);
  v_new_pinned := COALESCE(p_is_pinned, v_group.is_pinned, false);
  v_new_label := CASE
    WHEN p_spotlight_label IS NULL THEN v_group.spotlight_label
    ELSE NULLIF(trim(p_spotlight_label), '')
  END;
  v_new_priority := COALESCE(
    p_featured_priority,
    CASE WHEN v_new_pinned AND COALESCE(v_group.featured_priority, 0) = 0 THEN 50 ELSE v_group.featured_priority END,
    0
  );

  IF NOT v_new_pinned AND p_featured_priority IS NULL THEN
    v_new_priority := 0;
  END IF;

  UPDATE public.contribution_groups
  SET
    is_verified = v_new_verified,
    is_pinned = v_new_pinned,
    spotlight_label = v_new_label,
    featured_priority = GREATEST(0, LEAST(v_new_priority, 1000)),
    verified_at = CASE
      WHEN v_new_verified AND v_group.verified_at IS NULL THEN now()
      WHEN NOT v_new_verified THEN NULL
      ELSE v_group.verified_at
    END,
    verified_by = CASE
      WHEN v_new_verified THEN v_admin_id
      ELSE NULL
    END,
    verification_note = COALESCE(NULLIF(trim(p_note), ''), verification_note),
    updated_at = now()
  WHERE id = p_group_id;

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, summary, metadata)
  VALUES (
    v_admin_id,
    'update_group_spotlight',
    'group',
    p_group_id,
    format(
      'Updated spotlight for "%s" (Verified: %s, Pinned: %s, Label: %s, Priority: %s)',
      v_group.name,
      v_new_verified,
      v_new_pinned,
      COALESCE(v_new_label, 'None'),
      v_new_priority
    ),
    jsonb_build_object(
      'is_verified', v_new_verified,
      'is_pinned', v_new_pinned,
      'spotlight_label', v_new_label,
      'featured_priority', v_new_priority,
      'note', p_note
    )
  );

  -- Notify creator if newly verified or newly pinned/spotlighted
  IF v_group.creator_id IS NOT NULL AND (
    (v_new_verified AND NOT COALESCE(v_group.is_verified, false)) OR
    (v_new_pinned AND NOT COALESCE(v_group.is_pinned, false))
  ) THEN
    INSERT INTO public.notifications (user_id, type, title, message, related_id, is_read)
    VALUES (
      v_group.creator_id,
      'group_spotlight',
      CASE
        WHEN v_new_verified AND v_new_pinned THEN 'Group Verified & Pinned to Top!'
        WHEN v_new_verified THEN 'Verified Crowdfunder Badge Granted!'
        ELSE 'Group Featured at Top of Discover!'
      END,
      format(
        '"%s" has been %s%s on CollectiPay Discover.',
        v_group.name,
        CASE WHEN v_new_verified THEN 'awarded the Verified Crowdfunder badge' ELSE 'promoted' END,
        CASE WHEN v_new_label IS NOT NULL THEN format(' under "%s"', v_new_label) ELSE '' END
      ),
      p_group_id,
      false
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'is_verified', v_new_verified,
    'is_pinned', v_new_pinned,
    'spotlight_label', v_new_label,
    'featured_priority', v_new_priority
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_group_spotlight(uuid, boolean, boolean, text, integer, text) TO authenticated;

-- 5. Admin RPC: Grant / revoke Verified Crowdfunder organizer badge on a user
CREATE OR REPLACE FUNCTION public.admin_toggle_verified_organizer(
  p_user_id uuid,
  p_is_verified boolean,
  p_badge_label text DEFAULT 'Verified Crowdfunder',
  p_apply_to_groups boolean DEFAULT true
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_user record;
  v_label text := COALESCE(NULLIF(trim(p_badge_label), ''), 'Verified Crowdfunder');
  v_groups_updated integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  SELECT id, name, email INTO v_user
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  UPDATE public.profiles
  SET
    is_verified_organizer = COALESCE(p_is_verified, false),
    organizer_badge_label = CASE WHEN COALESCE(p_is_verified, false) THEN v_label ELSE NULL END,
    updated_at = now()
  WHERE id = p_user_id;

  IF COALESCE(p_apply_to_groups, true) THEN
    UPDATE public.contribution_groups
    SET
      is_verified = COALESCE(p_is_verified, false),
      verified_at = CASE WHEN COALESCE(p_is_verified, false) THEN COALESCE(verified_at, now()) ELSE NULL END,
      verified_by = CASE WHEN COALESCE(p_is_verified, false) THEN v_admin_id ELSE NULL END,
      updated_at = now()
    WHERE creator_id = p_user_id
      AND COALESCE(archived, false) = false;
    GET DIAGNOSTICS v_groups_updated = ROW_COUNT;
  END IF;

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, summary, metadata)
  VALUES (
    v_admin_id,
    'toggle_verified_organizer',
    'user',
    p_user_id,
    format(
      '%s Verified Crowdfunder status (%s) for %s',
      CASE WHEN p_is_verified THEN 'Granted' ELSE 'Revoked' END,
      v_label,
      COALESCE(v_user.name, v_user.email)
    ),
    jsonb_build_object(
      'is_verified_organizer', p_is_verified,
      'badge_label', v_label,
      'groups_updated', v_groups_updated
    )
  );

  IF p_is_verified THEN
    INSERT INTO public.notifications (user_id, type, title, message, is_read)
    VALUES (
      p_user_id,
      'verified_organizer',
      'Verified Crowdfunder Badge Unlocked',
      format('Congratulations! CollectiPay has awarded your account the "%s" verification badge.', v_label),
      false
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'is_verified_organizer', p_is_verified,
    'badge_label', CASE WHEN p_is_verified THEN v_label ELSE NULL END,
    'groups_updated', v_groups_updated
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_toggle_verified_organizer(uuid, boolean, text, boolean) TO authenticated;

-- 6. Server-side 4-digit Transaction PIN RPCs (verify & set)
CREATE OR REPLACE FUNCTION public.verify_user_transaction_pin(p_pin text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_stored_pin text;
  v_clean_pin text := trim(COALESCE(p_pin, ''));
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'has_pin', false, 'error', 'Authentication required');
  END IF;

  SELECT preferences->>'transactionPin' INTO v_stored_pin
  FROM public.profiles
  WHERE id = v_uid;

  IF v_stored_pin IS NULL OR v_stored_pin !~ '^\d{4}$' THEN
    RETURN json_build_object(
      'success', false,
      'has_pin', false,
      'pin_required', true,
      'error', 'Please create a 4-digit Transaction PIN first to authorize this action.'
    );
  END IF;

  IF v_clean_pin !~ '^\d{4}$' OR v_clean_pin <> v_stored_pin THEN
    RETURN json_build_object(
      'success', false,
      'has_pin', true,
      'pin_invalid', true,
      'error', 'Incorrect 4-digit Transaction PIN. Please try again.'
    );
  END IF;

  RETURN json_build_object('success', true, 'has_pin', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_user_transaction_pin(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_user_transaction_pin(
  p_new_pin text,
  p_current_pin text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prefs jsonb;
  v_stored_pin text;
  v_clean_new text := trim(COALESCE(p_new_pin, ''));
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Authentication required');
  END IF;

  IF v_clean_new !~ '^\d{4}$' THEN
    RETURN json_build_object('success', false, 'error', 'Transaction PIN must be exactly 4 digits');
  END IF;

  SELECT COALESCE(preferences, '{}'::jsonb) INTO v_prefs
  FROM public.profiles
  WHERE id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;

  v_stored_pin := v_prefs->>'transactionPin';
  IF v_stored_pin IS NOT NULL AND v_stored_pin ~ '^\d{4}$' THEN
    IF p_current_pin IS NOT NULL AND trim(p_current_pin) <> v_stored_pin THEN
      RETURN json_build_object('success', false, 'error', 'Current PIN is incorrect');
    END IF;
  END IF;

  UPDATE public.profiles
  SET
    preferences = v_prefs || jsonb_build_object('transactionPin', v_clean_new),
    updated_at = now()
  WHERE id = v_uid;

  RETURN json_build_object('success', true, 'message', '4-digit Transaction PIN saved');
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_transaction_pin(text, text) TO authenticated;

-- 7. Enforce server-side PIN on contribute_from_wallet (interactive user calls only; cron service_role bypasses)
DROP FUNCTION IF EXISTS public.contribute_from_wallet(uuid, uuid, numeric, boolean);

CREATE OR REPLACE FUNCTION public.contribute_from_wallet(
  p_user_id uuid,
  p_group_id uuid,
  p_amount numeric,
  p_anonymous boolean DEFAULT false,
  p_pin text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_user record;
  v_group record;
  v_stored_pin text;
  v_user_balance numeric;
  v_new_balance numeric;
  v_transaction_id uuid;
  v_contributor_id uuid;
  v_ref text;
BEGIN
  IF v_caller IS NOT NULL AND v_caller <> p_user_id AND NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized contribution attempt');
  END IF;

  IF p_amount IS NULL OR p_amount < 100 THEN
    RETURN json_build_object('success', false, 'error', 'Minimum contribution amount is ₦100');
  END IF;

  SELECT id, wallet_balance, status, name, preferences
  INTO v_user
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  IF COALESCE(v_user.status, 'active') <> 'active' THEN
    RETURN json_build_object(
      'success', false,
      'error', format('Your account is currently %s and cannot make contributions. Contact support.', v_user.status)
    );
  END IF;

  -- Enforce 4-digit Transaction PIN for interactive user contributions (cron service_role has auth.uid() IS NULL)
  IF v_caller IS NOT NULL THEN
    v_stored_pin := COALESCE(v_user.preferences, '{}'::jsonb)->>'transactionPin';
    IF v_stored_pin IS NULL OR v_stored_pin !~ '^\d{4}$' THEN
      RETURN json_build_object(
        'success', false,
        'pin_required', true,
        'error', 'Please set up a 4-digit Transaction PIN to authorize contributions.'
      );
    END IF;
    IF p_pin IS NULL OR trim(p_pin) <> v_stored_pin THEN
      RETURN json_build_object(
        'success', false,
        'pin_invalid', true,
        'error', 'Incorrect 4-digit Transaction PIN.'
      );
    END IF;
  END IF;

  v_user_balance := COALESCE(v_user.wallet_balance, 0);
  IF v_user_balance < p_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient wallet balance',
      'current_balance', v_user_balance,
      'required', p_amount
    );
  END IF;

  SELECT id, name, status, archived, current_amount, enable_voting_rights
  INTO v_group
  FROM public.contribution_groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Group not found');
  END IF;

  IF COALESCE(v_group.archived, false) = true THEN
    RETURN json_build_object('success', false, 'error', 'This group has been archived and is no longer accepting contributions');
  END IF;

  IF COALESCE(v_group.status, 'active') <> 'active' THEN
    RETURN json_build_object(
      'success', false,
      'error', format('This group is currently %s and cannot receive contributions', v_group.status)
    );
  END IF;

  v_new_balance := v_user_balance - p_amount;

  UPDATE public.profiles
  SET wallet_balance = v_new_balance,
      updated_at = now()
  WHERE id = p_user_id;

  UPDATE public.contribution_groups
  SET current_amount = COALESCE(current_amount, 0) + p_amount,
      updated_at = now()
  WHERE id = p_group_id;

  INSERT INTO public.contributors (
    group_id,
    user_id,
    amount,
    total_contributed,
    contribution_count,
    has_voting_rights,
    join_method,
    anonymous,
    joined_at,
    last_contribution_at
  ) VALUES (
    p_group_id,
    p_user_id,
    p_amount,
    p_amount,
    1,
    true,
    'wallet',
    COALESCE(p_anonymous, false),
    now(),
    now()
  )
  ON CONFLICT (group_id, user_id) DO UPDATE
  SET total_contributed = COALESCE(public.contributors.total_contributed, 0) + p_amount,
      contribution_count = COALESCE(public.contributors.contribution_count, 0) + 1,
      has_voting_rights = true,
      last_contribution_at = now(),
      updated_at = now()
  RETURNING id INTO v_contributor_id;

  v_ref := 'WALLET_' || substr(p_user_id::text, 1, 8) || '_' || floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint::text;

  INSERT INTO public.transactions (
    user_id,
    contribution_id,
    type,
    amount,
    description,
    status,
    payment_method,
    reference_id,
    anonymous,
    balance_before,
    balance_after,
    metadata
  ) VALUES (
    p_user_id,
    p_group_id,
    'contribution',
    p_amount,
    'Contribution to ' || v_group.name || ' from wallet',
    'completed',
    'wallet',
    v_ref,
    COALESCE(p_anonymous, false),
    v_user_balance,
    v_new_balance,
    jsonb_build_object(
      'source', 'wallet',
      'instant_voting_rights', COALESCE(v_group.enable_voting_rights, true),
      'contributor_id', v_contributor_id,
      'pin_verified', (v_caller IS NOT NULL)
    )
  )
  RETURNING id INTO v_transaction_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Contribution successful',
    'transaction_id', v_transaction_id,
    'reference', v_ref,
    'contributor_id', v_contributor_id,
    'new_balance', v_new_balance,
    'voting_rights_granted', COALESCE(v_group.enable_voting_rights, true)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.contribute_from_wallet(uuid, uuid, numeric, boolean, text) TO authenticated, service_role;

-- 8. Enforce server-side PIN on create_withdrawal_request_safe
DROP FUNCTION IF EXISTS public.create_withdrawal_request_safe(uuid, numeric, text);

CREATE OR REPLACE FUNCTION public.create_withdrawal_request_safe(
  p_group_id uuid,
  p_amount numeric,
  p_purpose text,
  p_pin text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_requester record;
  v_stored_pin text;
  v_group record;
  v_requester_name text;
  v_eligible_voters integer := 0;
  v_pending_total numeric := 0;
  v_available numeric := 0;
  v_request_id uuid;
  v_deadline timestamptz := now() + interval '7 days';
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Authentication required');
  END IF;

  SELECT id, name, email, status, preferences INTO v_requester
  FROM public.profiles
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;

  IF COALESCE(v_requester.status, 'active') <> 'active' THEN
    RETURN json_build_object('success', false, 'error', format('Your account is currently %s.', v_requester.status));
  END IF;

  v_stored_pin := COALESCE(v_requester.preferences, '{}'::jsonb)->>'transactionPin';
  IF v_stored_pin IS NULL OR v_stored_pin !~ '^\d{4}$' THEN
    RETURN json_build_object('success', false, 'pin_required', true, 'error', 'Please set a 4-digit Transaction PIN to request withdrawals.');
  END IF;
  IF p_pin IS NULL OR trim(p_pin) <> v_stored_pin THEN
    RETURN json_build_object('success', false, 'pin_invalid', true, 'error', 'Incorrect 4-digit Transaction PIN.');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Withdrawal amount must be greater than zero');
  END IF;

  IF trim(COALESCE(p_purpose, '')) = '' THEN
    RETURN json_build_object('success', false, 'error', 'Please explain the purpose of this withdrawal');
  END IF;

  SELECT * INTO v_group
  FROM public.contribution_groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Group not found');
  END IF;

  IF v_group.creator_id <> v_uid AND NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Only the group creator can request withdrawals');
  END IF;

  IF COALESCE(v_group.archived, false) = true OR COALESCE(v_group.status, 'active') <> 'active' THEN
    RETURN json_build_object(
      'success', false,
      'error', format('Withdrawals are disabled while this group is %s.', CASE WHEN v_group.archived THEN 'archived' ELSE v_group.status END)
    );
  END IF;

  IF v_group.enable_voting_rights = false THEN
    RETURN json_build_object('success', false, 'error', 'This group uses direct admin withdrawals rather than voting');
  END IF;

  SELECT COALESCE(sum(amount), 0) INTO v_pending_total
  FROM public.withdrawal_requests
  WHERE contribution_id = p_group_id
    AND status = 'pending';

  v_available := COALESCE(v_group.current_amount, 0) - v_pending_total;

  IF p_amount > v_available THEN
    RETURN json_build_object(
      'success', false,
      'error', format('Amount exceeds available unencumbered pool balance (₦%s).', to_char(GREATEST(v_available, 0), 'FM999,999,999,990.00'))
    );
  END IF;

  SELECT count(*) INTO v_eligible_voters
  FROM public.contributors
  WHERE group_id = p_group_id
    AND has_voting_rights = true
    AND user_id IS NOT NULL;

  IF v_eligible_voters = 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'At least one contributor with verified voting rights is required before opening a withdrawal vote.'
    );
  END IF;

  v_requester_name := COALESCE(v_requester.name, v_requester.email, 'Group Admin');

  INSERT INTO public.withdrawal_requests (
    contribution_id, requester_id, amount, purpose, status, deadline, votes
  ) VALUES (
    p_group_id, v_uid, p_amount, trim(p_purpose), 'pending', v_deadline, '[]'::jsonb
  ) RETURNING id INTO v_request_id;

  INSERT INTO public.notifications (user_id, type, title, message, related_id, is_read)
  SELECT
    c.user_id,
    'withdrawal_request',
    'New Withdrawal Vote Open',
    format('%s requested ₦%s from "%s". Cast your vote within 7 days.',
      v_requester_name,
      to_char(p_amount, 'FM999,999,999,990.00'),
      v_group.name
    ),
    v_request_id,
    false
  FROM public.contributors c
  WHERE c.group_id = p_group_id
    AND c.has_voting_rights = true
    AND c.user_id IS NOT NULL
    AND c.user_id <> v_uid;

  RETURN json_build_object(
    'success', true,
    'id', v_request_id,
    'deadline', v_deadline,
    'eligible_voters', v_eligible_voters
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_withdrawal_request_safe(uuid, numeric, text, text) TO authenticated;

-- 9. Enforce server-side PIN on process_instant_withdrawal
DROP FUNCTION IF EXISTS public.process_instant_withdrawal(uuid, uuid, numeric, text);

CREATE OR REPLACE FUNCTION public.process_instant_withdrawal(
  p_group_id uuid,
  p_admin_id uuid,
  p_amount numeric,
  p_purpose text,
  p_pin text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_group record;
  v_admin record;
  v_stored_pin text;
  v_group_balance numeric := 0;
  v_admin_balance_before numeric := 0;
  v_admin_balance_after numeric := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_admin_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized withdrawal requester';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Withdrawal amount must be greater than zero';
  END IF;

  SELECT id, wallet_balance, status, preferences INTO v_admin
  FROM public.profiles
  WHERE id = p_admin_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Admin profile not found';
  END IF;

  IF COALESCE(v_admin.status, 'active') <> 'active' THEN
    RAISE EXCEPTION 'Your account is currently % and cannot withdraw funds', v_admin.status;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    v_stored_pin := COALESCE(v_admin.preferences, '{}'::jsonb)->>'transactionPin';
    IF v_stored_pin IS NULL OR v_stored_pin !~ '^\d{4}$' THEN
      RAISE EXCEPTION 'Please set a 4-digit Transaction PIN to authorize withdrawals';
    END IF;
    IF p_pin IS NULL OR trim(p_pin) <> v_stored_pin THEN
      RAISE EXCEPTION 'Incorrect 4-digit Transaction PIN';
    END IF;
  END IF;

  SELECT * INTO v_group
  FROM public.contribution_groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Group not found';
  END IF;

  IF v_group.enable_voting_rights <> false THEN
    RAISE EXCEPTION 'This group requires voting approval for withdrawals';
  END IF;

  IF v_group.creator_id <> p_admin_id THEN
    RAISE EXCEPTION 'Only group admin can withdraw funds';
  END IF;

  IF COALESCE(v_group.archived, false) = true OR COALESCE(v_group.status, 'active') <> 'active' THEN
    RAISE EXCEPTION 'Cannot withdraw while group is %', CASE WHEN v_group.archived THEN 'archived' ELSE v_group.status END;
  END IF;

  v_group_balance := COALESCE(v_group.current_amount, 0);
  IF v_group_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient group balance';
  END IF;

  v_admin_balance_before := COALESCE(v_admin.wallet_balance, 0);
  v_admin_balance_after := v_admin_balance_before + p_amount;

  UPDATE public.contribution_groups
  SET current_amount = v_group_balance - p_amount,
      updated_at = now()
  WHERE id = p_group_id;

  UPDATE public.profiles
  SET wallet_balance = v_admin_balance_after,
      updated_at = now()
  WHERE id = p_admin_id;

  INSERT INTO public.transactions (
    user_id, contribution_id, type, amount, description, status,
    payment_method, reference_id, balance_before, balance_after, metadata
  ) VALUES (
    p_admin_id, p_group_id, 'withdrawal', p_amount,
    'Instant withdrawal: ' || trim(COALESCE(p_purpose, '')), 'completed', 'wallet',
    'INSTANT_WITHDRAWAL_' || replace(p_group_id::text, '-', '') || '_' || floor(extract(epoch FROM now()))::text,
    v_admin_balance_before, v_admin_balance_after,
    jsonb_build_object(
      'group_id', p_group_id,
      'purpose', p_purpose,
      'withdrawal_type', 'instant_no_voting',
      'pin_verified', true
    )
  );

  INSERT INTO public.notifications (user_id, type, title, message, related_id, is_read)
  VALUES (
    p_admin_id,
    'withdrawal',
    'Withdrawal Credited',
    format('₦%s withdrawn from "%s" and added to your wallet.', to_char(p_amount, 'FM999,999,999,990.00'), v_group.name),
    p_group_id,
    false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_instant_withdrawal(uuid, uuid, numeric, text, text) TO authenticated;
