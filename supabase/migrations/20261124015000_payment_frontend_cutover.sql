BEGIN;

-- Apply after the deployed frontend uses the new history, contribution and savings RPCs.
DROP POLICY IF EXISTS "Group members can view group contribution transactions" ON public.transactions;
CREATE POLICY "Wallet ledger visibility boundary" ON public.transactions AS RESTRICTIVE
  FOR SELECT TO anon,authenticated USING (auth.uid() IS NOT NULL AND (user_id=auth.uid() OR public.is_admin()));

REVOKE ALL ON FUNCTION public.contribute_from_wallet(uuid,uuid,numeric,boolean,text),
  public.open_fixed_savings(uuid,text,boolean,text) FROM PUBLIC,anon,authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
