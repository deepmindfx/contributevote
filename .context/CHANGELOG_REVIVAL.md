# Revival & Production Hardening Changelog (2026-11-21)

Comprehensive audit, feature repair, backend hardening, and production-readiness upgrade executed against Supabase project `sivvjwffekhfabgxhbcd`.

## Database & Security Hardening (`supabase/migrations/20261121_production_hardening.sql`)
- **Fixed Refund Auto-Approval Trigger**: Converted `trigger_check_refund_approval` from `BEFORE UPDATE` (which invoked `process_group_refund` while status was still `'pending'`) to `AFTER UPDATE`, updating `status = 'approved'` before execution, and added balance snapshots + contributor notifications to `process_group_refund`.
- **Fixed Failing `pg_cron` Jobs**: Live cron runs were failing with `unrecognized configuration parameter "app.settings.service_role_key"`. Stored bearer secret in Supabase Vault (`collectipay_cron_bearer`) and rescheduled both `process-scheduled-contributions` and `check-refund-deadlines`.
- **Enhanced `create_group_with_fee_check`**: Persists `contribution_amount`, `start_date`, `end_date`, and `voting_threshold`, and records `balance_before`/`balance_after` on `₦500` fee deductions.
- **Tightened RLS & Privacy**:
  - Replaced permissive `USING (true)` write policies on `contributors` and `transactions` with owner/creator/admin checks.
  - Kept `profiles` (containing `bvn`, `wallet_balance`, `preferences`) private to owner + admins, and added `get_group_contributors_safe` RPC so group contributor lists display names safely without leaking sensitive profile fields.
  - Added `anon` read policies on public non-archived groups so `/discover`, `/join/:id`, and `/contribute/share/:id` work for logged-out visitors.
  - Added `is_admin()`, `get_invitation_by_token`, `lookup_user_id_by_email`, and `admin_deposit_to_user` RPCs.
- **Completed Realtime Publication**: Added `profiles`, `contribution_groups`, `notifications`, and `withdrawal_requests` to `supabase_realtime` alongside `contributors` and `group_refund_requests`.
- **Regenerated Types**: Updated `src/integrations/supabase/types.ts` directly from live PostgreSQL schema (all 11 tables + all RPCs).

## Edge Functions Fixed & Deployed
- **`webhook-contribution` (v4, `--no-verify-jwt`)**: Fixed `verify_jwt: true` blocker that would have rejected all Flutterwave webhooks with 401; aligned secret lookup to `FLW_SECRET_HASH`; enforced strict signature check; fixed unreachable `transfer.completed` virtual-account branch; fixed double-counting of `contribution_groups.current_amount`; added automatic wallet refund on failed outbound transfers.
- **`process-scheduled-contributions` (v4)**: Fixed `recurring_contributions` query (`is_active = true` instead of non-existent `status = 'active'`); checked RPC JSON `{ success }` result so insufficient-balance runs are marked `'failed'` instead of `'completed'`; fixed refund vote counting and approval order.
- **`flutterwave-transfer` (v4)**: Fixed `meta_data` → `metadata` column bug, added optimistic concurrency debit + automatic rollback on Flutterwave failure, recorded balance snapshots, and pointed `callback_url` to `webhook-contribution`.
- **`flutterwave-resolve-account` (v4)**: Accepts both `account_bank` and `bank_code`.
- **`flutterwave-verify-transaction` (v1, NEW)**: Added server-side Flutterwave payment verification for `/payment-callback` (idempotent with webhooks).

## Frontend Features Repaired & Hardened
- **Authentication & Security**: Removed hardcoded `admin`/`admin123` backdoor in `AdminAuth.tsx`; removed passwordless email-only login backdoor in `SupabaseUserContext.tsx`; gated `/test-transfer-api` and `"Ali Bank Test"` to `DEV` only; removed client-side secret key requirement in `flutterwave/config.ts` and routed `virtualAccounts.ts` strictly through Edge Functions; added `?redirect=` support in `AuthForm.tsx`.
- **Real Supabase Notifications**: Added `NotificationService` + realtime subscription in `SupabaseUserContext`, wired live notifications into `Header.tsx`, `Dashboard.tsx`, and `UserProfile.tsx`, and wired pending votes badge in `MobileNav.tsx`.
- **Profile & Settings**: Rewrote `UserProfile.tsx` and `UserSettingsForm.tsx` to use real snake_case `profiles` columns, preserve `preferences.virtualAccount` on save, store 4-digit PIN in `preferences.transactionPin`, and wire "Change Password" via `supabase.auth.updateUser`.
- **Transfers & Wallet History**: Fixed `TransferForm.tsx` (PIN check, Supabase refresh, receipt fields), `WalletHistory.tsx` (`refreshContributionData`, `preferences.virtualAccount`, all 6 transaction types), `WalletCard.tsx`, `ActivityHistory.tsx`, and `ActivityList.tsx`.
- **Contributions & Payment Callback**: Migrated `ContributePage.tsx`, `ContributeSharePage.tsx`, and `PaymentCallback.tsx` off `localStorage` and browser-side secret-key calls onto Supabase + Edge Functions.
- **Groups, Discovery, Invites & Admin**: Fixed `GroupForm.tsx` (check `result.success`, save schedule/voting/bank_name/BVN), `GroupDetail.tsx` (`end_date`, `bank_name`, active polls button), member counts in `GroupCard.tsx`/`GroupsList.tsx`/`AllGroups.tsx`/`JoinGroup.tsx`, email-or-UUID bank transfer verification in `GroupContributionService`, invite token lookup & member checks in `InvitationService`, and complete snake_case + platform-wide data rewrite of `admin/Dashboard.tsx`.
- **Deployment & Repo Hygiene**: Added SPA rewrites & security headers to `vercel.json`, replaced hardcoded old Supabase URLs (`qnkezzhrhbosekxhfqzo`) across services, removed hardcoded MCP access tokens from `.cursor/mcp.json` & `.kiro/settings/mcp.json`, updated `.gitignore` & `.env.example`, and saved `SUPABASE_ACCESS_TOKEN` safely in gitignored `.env.local`.
