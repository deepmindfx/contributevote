# Core Features & End-to-End Workflows

## 1. Authentication & Security
- **User Auth** (`/auth`): Supabase Auth email/password login and signup. Signup automatically triggers `handle_new_user()` to create a `profiles` record. Redirects honor both `location.state.returnUrl` and `?redirect=<relative_path>`.
- **Admin Auth** (`/admin-login`): Authenticated via Supabase Auth; rejects any account whose `profiles.role !== 'admin'`.
- **Transaction PIN**: 4-digit PIN configured in `/settings` (Security tab) and persisted inside `profiles.preferences.transactionPin` (preserving existing keys such as `virtualAccount`). Required before executing outbound transfers in `/transfer`.
- **Password Management**: Users can update passwords directly in `/settings` via `supabase.auth.updateUser({ password })`.

## 2. Personal Wallet & Virtual Bank Account
- **Provisioning**: On `/dashboard` → **Bank Account** tab (`ReservedAccount`), user supplies their 11-digit BVN. `WalletService.createVirtualAccount` calls Edge Function `flutterwave-virtual-account`, stores the returned permanent virtual account in `profiles.preferences.virtualAccount`, and saves `profiles.bvn` for reuse when creating groups.
- **Funding**:
  - **Bank Transfer**: Transferring to the personal virtual account triggers Flutterwave webhook → `webhook-contribution` → idempotently credits `profiles.wallet_balance`, inserts a `deposit` transaction with balance snapshots, and creates a `wallet_deposit` notification.
  - **Card / Payment Link**: `WalletService.createPaymentInvoice` calls `flutterwave-invoice`; callback `/payment-callback` verifies server-side via `flutterwave-verify-transaction` (idempotent against webhook).
- **Outbound Bank Transfer** (`/transfer`): Fetches Nigerian banks (`flutterwave-banks`), resolves beneficiary name (`flutterwave-resolve-account`), verifies user's 4-digit PIN, calculates fee (`₦10.75` ≤ `₦5,000`, `₦26.50` > `₦5,000`), and calls `flutterwave-transfer` (which debits wallet with optimistic concurrency lock, rolls back on API failure, and logs a `transfer` transaction). Failed async payouts are auto-refunded by `webhook-contribution`.

## 3. Contribution Groups & Quota
- **Creation Wizard** (`/create-group`, `GroupForm`): 3 steps (Details with 19 categories → Schedule & contribution amount → Privacy, voting rights toggle, and BVN auto-filled from `profiles.bvn`).
- **Free Quota**: First 3 groups are free; subsequent groups require confirmation and deduct `₦500` atomically via `create_group_with_fee_check`.
- **Dedicated Group Bank Account**: Created via `flutterwave-virtual-account` (`tx_ref: GROUP_<id>_<ts>`) and saved on `contribution_groups` (`account_number`, `account_name`, `bank_name`, `account_reference`, `account_details`). Can also be provisioned later from `/groups/:id`.
- **Archiving**: Creators can archive/unarchive groups via `archive_group` / `unarchive_group`; archived groups are hidden unless "Show Archived" is toggled.

## 4. Funding a Group & Voting Rights Model
- **Wallet Contribution** (Instant Voting Rights): `ContributeButton`, `/contribute/:id`, or `/contribute/share/:id` invoke `contribute_from_wallet` RPC → atomically moves funds from user wallet to group and grants `has_voting_rights = true`.
- **Card / Online Checkout** (Automatic Voting Rights): Verified via `webhook-contribution` or `flutterwave-verify-transaction` → grants `has_voting_rights = true`.
- **Direct Bank Transfer to Group Account** (Manual Verification): `webhook-contribution` credits `contribution_groups.current_amount`, inserts an anonymous `contributors` row with `has_voting_rights = false`, and notifies the group creator. The creator links the transfer to a registered user (by **email** or **UUID**) in **Admin Panel → Pending** (`PendingBankTransfers`) to grant voting rights.

## 5. Democratic Governance (Withdrawals & Refunds)
- **Threshold Rule**: Both withdrawal requests and group refund requests require **≥ 70% participation** of eligible voters AND **≥ 60% approval** of votes cast, within a **7-day** voting window. Early approval executes immediately once both thresholds are reached.
- **Withdrawals**:
  - Groups with `enable_voting_rights = true`: Creator submits a withdrawal request (`WithdrawalRequest`), eligible contributors are notified and vote on `/votes`. Each vote calls `voteOnWithdrawal` → records a `'vote'` ledger entry → calls `check_withdrawal_voting` → auto-executes `process_approved_withdrawal` (deducting group balance and crediting requester wallet) upon reaching thresholds.
  - Groups with `enable_voting_rights = false`: Creator withdraws immediately via `process_instant_withdrawal`.
- **Group Refunds**:
  - Creators initiate a full (`100%`) or partial (`1–100%`) refund via `GroupRefundDialog`.
  - Contributors vote live in `RefundRequestsCard` (powered by Supabase Realtime on `group_refund_requests`).
  - Once thresholds are met, the `AFTER UPDATE` trigger `trigger_check_refund_approval` sets `status = 'approved'` and calls `process_group_refund`, crediting every contributor's wallet proportionally.

## 6. Recurring & Scheduled Contributions
- Members with voting rights can configure automatic recurring (`daily`, `weekly`, `monthly`) or one-time future wallet contributions (`RecurringContributionDialog`, `ScheduledContributionDialog`).
- Executed every 15 minutes by `pg_cron` → `process-scheduled-contributions` Edge Function via `contribute_from_wallet` RPC, updating execution timestamps and recording failure reasons (e.g., insufficient balance).

## 7. Discovery, Invitations, Receipts & Notifications
- **Discovery** (`/discover`): Unauthenticated and authenticated users can browse, search, filter, and sort active public groups and join via `/join/:id`.
- **Private Invitations** (`InviteMembersDialog` & `/invite/:token`): Creators generate 7-day token links; invitees can preview the group before signing in via `get_invitation_by_token` RPC.
- **Receipts & Reports**: Individual PNG/PDF receipts (`ModernReceipt`) and full contributor PDF statements (`PDFGenerator`) via `ContributionHistoryDialog`.
- **Notifications**: Real-time Supabase `notifications` feed rendered in both `Header` and `Dashboard` with unread badges and one-click mark-read / navigation.
