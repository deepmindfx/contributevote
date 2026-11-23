BEGIN;

CREATE TABLE public.bulk_transfer_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  max_recipients integer NOT NULL DEFAULT 20 CHECK (max_recipients BETWEEN 2 AND 50),
  max_batch_amount numeric(12,2) NOT NULL DEFAULT 1000000 CHECK (max_batch_amount BETWEEN 200 AND 25000000),
  daily_amount_limit numeric(12,2) NOT NULL DEFAULT 2000000 CHECK (daily_amount_limit BETWEEN 200 AND 50000000),
  small_fee numeric(10,2) NOT NULL DEFAULT 10 CHECK (small_fee BETWEEN 0 AND 5000),
  medium_fee numeric(10,2) NOT NULL DEFAULT 25 CHECK (medium_fee BETWEEN 0 AND 5000),
  large_fee numeric(10,2) NOT NULL DEFAULT 50 CHECK (large_fee BETWEEN 0 AND 5000),
  vat_percent numeric(5,2) NOT NULL DEFAULT 7.5 CHECK (vat_percent BETWEEN 0 AND 100),
  revision uuid NOT NULL DEFAULT gen_random_uuid(),
  CHECK (daily_amount_limit >= max_batch_amount)
);
INSERT INTO public.bulk_transfer_settings DEFAULT VALUES;

CREATE TABLE public.bulk_transfer_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  recipients jsonb NOT NULL CHECK (jsonb_typeof(recipients) = 'array'),
  recipient_count integer NOT NULL CHECK (recipient_count BETWEEN 2 AND 50),
  principal numeric(12,2) NOT NULL,
  fee numeric(12,2) NOT NULL,
  vat numeric(12,2) NOT NULL,
  vat_percent numeric(5,2) NOT NULL,
  pricing_revision uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
  authorized_at timestamptz,
  dispatch_started_at timestamptz,
  provider_batch_id text UNIQUE CHECK (provider_batch_id ~ '^[1-9][0-9]{0,19}$')
);
CREATE INDEX bulk_transfer_batches_owner_idx ON public.bulk_transfer_batches(user_id, created_at DESC);
CREATE INDEX bulk_transfer_batches_history_idx ON public.bulk_transfer_batches(authorized_at DESC) WHERE authorized_at IS NOT NULL;

ALTER TABLE public.transactions ADD COLUMN bulk_batch_id uuid REFERENCES public.bulk_transfer_batches(id) ON DELETE RESTRICT;
CREATE INDEX transactions_bulk_batch_idx ON public.transactions(bulk_batch_id) WHERE bulk_batch_id IS NOT NULL;
CREATE POLICY "Bulk transfer ledger is private to the sender" ON public.transactions
  AS RESTRICTIVE FOR SELECT TO authenticated USING (bulk_batch_id IS NULL OR user_id = (SELECT auth.uid()));

ALTER TABLE public.bulk_transfer_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_transfer_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bulk_transfer_settings, public.bulk_transfer_batches FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.bulk_transfer_settings, public.bulk_transfer_batches TO service_role;

CREATE FUNCTION public.get_bulk_transfer_settings()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT to_jsonb(s) - ARRAY['revision','singleton'] FROM public.bulk_transfer_settings s WHERE auth.uid() IS NOT NULL;
$$;

CREATE FUNCTION public.service_create_bulk_transfer_quote(p_user_id uuid, p_title text, p_recipients jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_settings public.bulk_transfer_settings%ROWTYPE;
  v_row record;
  v_rows jsonb := '[]';
  v_count integer;
  v_fee numeric;
  v_vat numeric;
  v_principal numeric := 0;
  v_total_fee numeric := 0;
  v_total_vat numeric := 0;
  v_batch uuid;
BEGIN
  SELECT * INTO STRICT v_settings FROM public.bulk_transfer_settings;
  IF NOT v_settings.enabled THEN RAISE EXCEPTION 'Bulk transfers are paused'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id
    WHERE p.id=p_user_id AND coalesce(p.status,'active')='active' AND u.email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'An active account with a confirmed email is required';
  END IF;
  IF p_title IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 1 AND 80 OR jsonb_typeof(p_recipients) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Review the batch name and recipients';
  END IF;
  v_count := jsonb_array_length(p_recipients);
  IF v_count NOT BETWEEN 2 AND v_settings.max_recipients THEN RAISE EXCEPTION 'Recipient count exceeds the allowed range'; END IF;
  FOR v_row IN SELECT * FROM jsonb_to_recordset(p_recipients) AS r(account_bank text, account_number text, beneficiary_name text, amount numeric, narration text) LOOP
    IF coalesce(v_row.account_bank,'') !~ '^[0-9a-zA-Z]{2,12}$' OR coalesce(v_row.account_number,'') !~ '^[0-9]{10}$'
      OR coalesce(char_length(btrim(v_row.beneficiary_name)),0) NOT BETWEEN 1 AND 120
      OR coalesce(char_length(v_row.narration),0) > 120
      OR v_row.amount IS NULL OR v_row.amount NOT BETWEEN 100 AND 500000 OR v_row.amount <> round(v_row.amount,2) THEN
      RAISE EXCEPTION 'Invalid verified recipient in the batch';
    END IF;
    v_fee := CASE WHEN v_row.amount <= 5000 THEN v_settings.small_fee WHEN v_row.amount <= 50000 THEN v_settings.medium_fee ELSE v_settings.large_fee END;
    v_vat := round(v_fee * v_settings.vat_percent / 100, 2);
    v_principal := v_principal + v_row.amount;
    v_total_fee := v_total_fee + v_fee;
    v_total_vat := v_total_vat + v_vat;
    v_rows := v_rows || jsonb_build_array(jsonb_build_object('row_number', jsonb_array_length(v_rows)+1,
      'account_bank', v_row.account_bank, 'account_number', v_row.account_number, 'beneficiary_name', btrim(v_row.beneficiary_name),
      'amount', v_row.amount, 'fee', v_fee, 'vat', v_vat, 'narration', coalesce(v_row.narration,''),
      'reference', 'TRF_B_' || replace(gen_random_uuid()::text,'-','')));
  END LOOP;
  IF v_principal > v_settings.max_batch_amount THEN RAISE EXCEPTION 'The batch exceeds the maximum total amount'; END IF;

  DELETE FROM public.bulk_transfer_batches WHERE user_id=p_user_id AND authorized_at IS NULL AND expires_at<now();
  INSERT INTO public.bulk_transfer_batches(user_id,title,recipients,recipient_count,principal,fee,vat,vat_percent,pricing_revision)
  VALUES(p_user_id,btrim(p_title),v_rows,v_count,v_principal,v_total_fee,v_total_vat,v_settings.vat_percent,v_settings.revision)
  RETURNING id INTO v_batch;
  RETURN v_batch;
END;
$$;

REVOKE ALL ON FUNCTION public.get_bulk_transfer_settings(), public.service_create_bulk_transfer_quote(uuid,text,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_bulk_transfer_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.service_create_bulk_transfer_quote(uuid,text,jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
