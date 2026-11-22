# Database Schema & Backend Logic

The live database (`sivvjwffekhfabgxhbcd`, PostgreSQL 17) is built from `master_migration.sql` plus `supabase/migrations/20261121_production_hardening.sql`, `supabase/migrations/20261122_group_invitation_workflow.sql`, and `supabase/migrations/20261122_super_admin_compliance.sql`. Generated TypeScript types live in `src/integrations/supabase/types.ts`.

## Tables (14)

| Table | Primary Purpose | Key Columns |
| :--- | :--- | :--- |
| `profiles` | User profile & wallet balance (1:1 with `auth.users`) | `id`, `email`, `name`, `phone`, `bvn`, `wallet_balance`, `role` (`user`/`admin`), `status` (`active`/`paused`/`verified`), `preferences` (JSONB: `darkMode`, `anonymousContributions`, `notificationsEnabled`, `virtualAccount`, `transactionPin`, `username`, `profileImage`), `groups_created_count`, `groups_created_free_remaining` (default `3`) |
| `contribution_groups` | Group funding campaigns | `id`, `creator_id`, `name`, `description`, `target_amount`, `current_amount`, `contribution_amount`, `category` (19 allowed values), `frequency`, `privacy` (`public`/`private`), `status`, `enable_voting_rights`, `voting_threshold`, `start_date`, `end_date`, `account_number`, `account_name`, `bank_name`, `account_reference`, `account_details`, `archived`, `archived_at`, `archived_by` |
| `contributors` | Group membership & voting eligibility | `id`, `group_id`, `user_id` (nullable for unverified bank transfers), `amount`, `total_contributed`, `contribution_count`, `has_voting_rights`, `join_method`, `anonymous`, `joined_at`, `last_contribution_at`, `metadata` (unique on `(group_id, user_id)`) |
| `transactions` | Full financial & governance ledger | `id`, `user_id`, `contribution_id`, `type` (`deposit`, `withdrawal`, `transfer`, `payment`, `vote`, `contribution`, `refund`), `amount`, `description`, `status`, `payment_method`, `reference_id`, `anonymous`, `balance_before`, `balance_after`, `metadata` |
| `withdrawal_requests` | Creator withdrawal proposals | `id`, `contribution_id`, `requester_id`, `amount`, `purpose`, `status` (`pending`/`approved`/`rejected`/`expired`/`executed`), `deadline`, `votes` (JSONB array) |
| `notifications` | User in-app alerts | `id`, `user_id`, `type`, `title`, `message`, `related_id`, `is_read`, `created_at` |
| `group_invitations` | Tokenized private group invites | `id`, `group_id`, `inviter_id`, `invitee_email`, `invitee_id`, `status` (`pending`/`accepted`/`rejected`/`expired`), `token`, `expires_at`, `accepted_at` |
| `recurring_contributions` | Auto-repeating wallet contributions | `id`, `user_id`, `group_id`, `amount`, `frequency` (`daily`/`weekly`/`monthly`), `start_date`, `end_date`, `next_contribution_date`, `is_active`, `total_contributions`, `total_amount`, `last_contribution_at` |
| `scheduled_contributions` | One-time future wallet contributions | `id`, `user_id`, `group_id`, `amount`, `scheduled_date`, `status` (`pending`/`completed`/`failed`/`cancelled`), `failure_reason`, `executed_at` |
| `group_refund_requests` | Group refund governance proposals | `id`, `group_id`, `requester_id`, `reason`, `refund_type` (`full`/`partial`), `partial_percentage`, `status`, `voting_deadline`, `votes`, `total_votes_for`, `total_votes_against`, `total_eligible_voters`, `executed_at`, `execution_details` |
| `refund_transactions` | Per-contributor refund payout audit | `id`, `refund_request_id`, `user_id`, `group_id`, `original_contribution`, `refund_amount`, `refund_percentage`, `status`, `failure_reason`, `transaction_id`, `completed_at` |
| `aml_alerts` | Automated & manual AML / anti-fraud risk queue | `id`, `alert_key` (unique), `user_id`, `group_id`, `transaction_id`, `alert_type`, `severity` (`low`/`medium`/`high`/`critical`), `status` (`open`/`investigating`/`escalated`/`resolved`/`dismissed`), `risk_score`, `amount`, `title`, `description`, `evidence` (JSONB), `resolution_note`, `resolved_by`, `resolved_at` |
| `admin_penalties` | Super Admin compliance fines & penalty ledger | `id`, `user_id`, `group_id`, `aml_alert_id`, `penalty_type` (`late_contribution`/`policy_violation`/`aml_hold`/`fraud_chargeback`/`dispute_fine`), `amount`, `reason`, `status` (`applied`/`waived`/`pending`), `deducted_from_wallet`, `transaction_id`, `issued_by`, `waived_by`, `waived_at` |
| `admin_audit_logs` | Tamper-evident chronological admin action log | `id`, `admin_id`, `action`, `target_type` (`user`/`group`/`aml_alert`/`penalty`/`transaction`/`system`), `target_id`, `summary`, `metadata` (JSONB), `created_at` |

## PL/pgSQL RPCs & Trigger Functions

| Function | Security | Behavior |
| :--- | :--- | :--- |
| `is_admin()` | `SECURITY DEFINER` | Checks if `auth.uid()` has `profiles.role = 'admin'` without triggering RLS recursion. |
| `handle_new_user()` | `SECURITY DEFINER` | `AFTER INSERT ON auth.users` trigger that initializes a `profiles` row with `wallet_balance = 0` and `groups_created_free_remaining = 3`. |
| `contribute_from_wallet(p_user_id, p_group_id, p_amount, p_anonymous)` | `SECURITY DEFINER` | Row-locks `profiles`, verifies balance, debits wallet, credits `contribution_groups.current_amount`, upserts `contributors` with `has_voting_rights = true`, and logs transaction with `balance_before`/`balance_after`. |
| `check_group_creation_eligibility(p_user_id)` | `SECURITY DEFINER` | Returns whether user has free group creations remaining (`3` free) or owes `₦500`. |
| `create_group_with_fee_check(...)` | `SECURITY DEFINER` | Atomically deducts `₦500` if `groups_created_free_remaining <= 0`, inserts group with schedule/voting params, decrements quota, and logs fee transaction with balance snapshots. |
| `archive_group(p_group_id, p_user_id)` / `unarchive_group(...)` | `SECURITY DEFINER` | Creator-only archive/restore toggles. |
| `check_withdrawal_voting(p_withdrawal_id)` | `SECURITY DEFINER` | Evaluates 70% participation + 60% approval thresholds; auto-executes via `process_approved_withdrawal` or rejects past deadline. |
| `process_approved_withdrawal(p_withdrawal_id)` | `SECURITY DEFINER` | Row-locks request & group, deducts group balance, credits requester wallet, logs transaction, marks `'executed'`, sends notification. |
| `process_instant_withdrawal(p_group_id, p_admin_id, p_amount, p_purpose)` | `SECURITY DEFINER` | Immediate creator withdrawal for groups where `enable_voting_rights = false`. |
| `record_withdrawal_vote(p_withdrawal_id, p_user_id, p_vote)` | `SECURITY DEFINER` | Records a `'vote'` activity transaction for audit history. |
| `check_and_process_refund()` | `SECURITY DEFINER` | `AFTER UPDATE OF total_votes_for, total_votes_against ON group_refund_requests` trigger; when 70% participation + 60% approval are met, sets `status = 'approved'` and invokes `process_group_refund`. |
| `process_group_refund(p_refund_request_id)` | `SECURITY DEFINER` | Idempotently refunds each contributor's wallet proportionally (`full` or `partial`), logs `transactions` + `refund_transactions` + `notifications`, deducts group balance, and marks `'executed'`. |
| `get_invitation_by_token(p_token)` | `SECURITY DEFINER` | Public/auth invite preview with group summary & inviter display name; expires stale tokens automatically. |
| `lookup_user_id_by_email(p_email)` | `SECURITY DEFINER` | Case-insensitive email → UUID lookup (returns UUID only, no PII). |
| `get_group_contributors_safe(p_group_id)` | `SECURITY DEFINER` | Returns group contributors with display name & avatar (respecting `anonymous`) while keeping `profiles` BVN/balance/PIN private. |
| `admin_deposit_to_user(p_target_user_id, p_amount, p_description)` | `SECURITY DEFINER` | Admin-only atomic wallet credit with transaction ledger entry, user notification, and audit log entry. |
| `admin_adjust_user_wallet(p_target_user_id, p_amount, p_direction, p_reason)` | `SECURITY DEFINER` | Admin-only atomic wallet credit or debit with balance checks, ledger snapshot, notification, and audit trail. |
| `admin_update_user_status(p_user_id, p_status, p_reason)` | `SECURITY DEFINER` | Admin-only user account control (`active`/`paused`/`frozen`/`suspended`) with user notification and audit log. |
| `admin_update_group_status(p_group_id, p_status, p_archived, p_reason)` | `SECURITY DEFINER` | Admin-only group governance control (`active`/`paused`/`frozen`/`completed`/`cancelled` + archive toggle) with creator notification and audit log. |
| `admin_issue_penalty(...)` / `admin_waive_penalty(...)` | `SECURITY DEFINER` | Admin-only compliance fine issuance (optional atomic wallet deduction) and penalty waiver (optional atomic wallet refund) with notifications and audit logs. |
| `admin_scan_aml_alerts()` / `admin_update_aml_alert(...)` / `admin_create_aml_alert(...)` | `SECURITY DEFINER` | Admin-only 5-rule live AML detection engine (large tx ≥ ₦500k, structuring, velocity bursts, rapid pass-through, unverified high-volume), case disposition workflow, and manual flagging. |
| `get_group_voters(p_group_id)` / `expire_withdrawal_requests()` | Mixed | Helper functions for voting eligibility and expiry maintenance. |

## Row Level Security Summary
- **`profiles`**: Strictly private to `auth.uid() = id`, `is_admin()`, or `service_role`. Cross-user display names are served via `get_group_contributors_safe` so `bvn`, `wallet_balance`, and `preferences` are never exposed.
- **`contribution_groups`**: Readable by `authenticated` (all) and `anon` (non-archived `public` groups only). Created/updated/deleted by `creator_id`.
- **`contributors`**: Readable by `authenticated` and `anon` (for public groups only). Writes restricted to the user themselves, the group creator, or `is_admin()`.
- **`transactions`**: Users read/insert their own rows; admins read/insert all; group creators/members can read group `contribution`/`withdrawal`/`refund` transactions for group audit transparency.
- **`withdrawal_requests` & `group_refund_requests`**: Visible to group contributors, group creators, and admins. Refund creation restricted to group creators; voting updates restricted to eligible contributors.
- **`notifications`, `recurring_contributions`, `scheduled_contributions`, `refund_transactions`**: Scoped to `auth.uid() = user_id`.

## Realtime Publications (`supabase_realtime`)
Enabled on all 6 live-updated tables:
`profiles`, `contribution_groups`, `contributors`, `notifications`, `withdrawal_requests`, `group_refund_requests`.

## Scheduled Jobs (`pg_cron` + `pg_net` + Supabase Vault)
Vault secret `collectipay_cron_bearer` authenticates scheduled HTTP calls to `process-scheduled-contributions`:
1. `process-scheduled-contributions` (`*/15 * * * *`) — Full run (recurring, scheduled, withdrawal voting, refund deadlines).
2. `check-refund-deadlines` (`0 * * * *`) — Hourly deadlines-only check (`{"deadlines_only": true}`).
