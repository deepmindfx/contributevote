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
- **Outbound Bank Transfer** (`/transfer`): The wallet and Send screen show the bank transfer allowance in Lagos time. After free transfers, the fee is ₦10.75 through ₦5,000 and ₦26.50 above ₦5,000. The provider transfer starts after a database transaction verifies the reviewed fee, reserves the daily allowance, and debits the wallet. Confirmed failures refund the full debit and release the allowance.

## 3. Contribution Groups & Quota
- **Creation Wizard** (`/create-group`, `GroupForm`): Native 2-step builder with custom interactive inputs — quick goal presets (`₦50k`–`₦1M`), tactile Contribution Frequency tile cards (`Daily`/`Weekly`/`Monthly`/`One-time`), inline + searchable 19-category `CategoryIcon` picker sheet, quick target-date chips, privacy & governance tile selectors, customizable Voting Threshold (`50%`/`60%`/`75%`/`80%`), and a live emerald Pool Blueprint summary card before creation.
- **Free Quota**: First 3 groups are free; subsequent groups require confirmation and deduct `₦500` atomically via `create_group_with_fee_check`.
- **Dedicated Group Bank Account**: The creation wizard uses the creator’s saved BVN to provision a Flutterwave account and waits for the link to finish. A retry resumes the original group and fee authorization. The **Bank setup** action on `/groups/:id` also supports existing groups. If Flutterwave’s response is inconclusive, reconcile the original `GROUP_<group_id>_VA` reference before allowing another provider request.
- **Archiving**: Creators can archive/unarchive groups via `archive_group` / `unarchive_group`; archived groups are hidden unless "Show Archived" is toggled.

## 4. Funding a Group & Voting Rights Model
- **Wallet Contribution** (Instant Voting Rights): `ContributeButton`, `/contribute/:id`, or `/contribute/share/:id` invoke `contribute_from_wallet` RPC → atomically moves funds from user wallet to group and grants `has_voting_rights = true`.
- **In-app Card or Bank Checkout** (Automatic Voting Rights): Either the webhook or the payment-return page settles the same server-issued checkout. A confirmed group payment credits the group and grants voting rights in one operation.
- **Direct Bank Transfer to Group Account** (Manual Verification): The webhook credits the group and records the payment without a voter. In **Manage → Transfers**, a group administrator matches the confirmed payment to an active, registered account by verified email or user ID to grant voting rights. Assignment leaves the previously credited group balance intact.

## 5. Democratic Governance (Withdrawals & Refunds)
- **Threshold Rule**: Both withdrawal requests and group refund requests require **≥ 70% participation** of eligible voters AND **≥ 60% approval** of votes cast, within a **7-day** voting window. Early approval executes immediately once both thresholds are reached.
- **Withdrawals**:
  - **Platform fee**: Show the gross withdrawal, fee, and net wallet credit before authorization. A voted request keeps its quoted fee through execution. Charity groups have no platform withdrawal fee.
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
- **Group invitations** (`InviteMembersDialog` & `/invite/:token`): Creators can enter an email or pick one from device contacts on supported browsers. Seven-day links can be copied, shared, or opened in the email app. Invitees see the group rules before joining, and `accept_group_invitation` checks the verified email and records membership atomically.
- **Receipts & Reports**: Individual PNG/PDF receipts (`ModernReceipt`) and full contributor PDF statements (`PDFGenerator`) via `ContributionHistoryDialog`.
- **Notifications**: Real-time Supabase `notifications` feed rendered in both `Header` and `Dashboard` with unread badges and one-click mark-read / navigation.
- **Monthly activity** — Activity shows settled wallet flows for the selected month in Africa/Lagos time and exports a PDF statement. Group owners have a separate Insights tab for contributions, outside transfers, withdrawals, refunds, and fees.
- **Device notifications** — Preferences control wallet, group, and governance alerts independently. Users can enable device notifications after browser permission. System alerts show an amount and payment category. Full sender details are available inside CollectiPay.

## 8. Super Admin Fintech Operations, Penalties & AML Compliance
- **Live Mechanical Split-Flap User Counter** (`FlipCounterHero`): Real-time 3D split-flap growth board on `/admin` subscribed to `profiles` `INSERT` events via Supabase Realtime, with a **Big Screen Display** fullscreen mode and live KPI tickers (BVN verified, active pools, liquidity, outside payments).
- **Command Center** (`/admin`, `src/pages/admin/Dashboard.tsx`): 7-tab operations workspace (`AML Alerts`, `Outside Pay`, `Users`, `Groups`, `Penalties`, `Ledger`, `Audit Log`) backed by `AdminComplianceService` and `is_admin()`-gated PostgreSQL RPCs.
- **Pricing & revenue**: Edit the daily free-transfer allowance, Friday promotion, and standard group withdrawal percentage. This view shows gross fee revenue from settled transfers and group withdrawals recorded under this policy. The initial withdrawal percentage is 0% until configured by an admin.
- **Anti-Money Laundering Hardening**:
  - **Mandatory Unique BVN Gate**: Organizers must verify a unique 11-digit BVN (`save_user_bvn` — duplicate BVN attempts are blocked and auto-raise a critical AML alert) before creating any group pool; non-admin accounts are capped at 3 new groups per 24h.
  - **Outside Payment Tracking** (`external_payment_tracks` + `webhook-contribution` v5): Every outside bank transfer, virtual account deposit, and third-party checkout is recorded with masked sender account, bank, channel, and real-time AML risk score; high/critical outside payments raise immediate AML alerts.
  - **7-Rule AML Engine** (`admin_scan_aml_alerts`): Screens single txs `≥ ₦500k`, structuring/split transfers, velocity bursts (`≥ 5/hr`), rapid pass-through layering, unverified KYC volume, unverified outside payments (`≥ ₦250k`), and rapid multi-group churn.
- **Viral Share & WhatsApp Story Studio** (`ShareGroupButton`): Branded WhatsApp, X, Facebook sharing + 3-theme (`Emerald Blueprint`, `Daylight Mint`, `Obsidian Vault`), 9:16 Story / 1:1 Square HD PNG campaign posters featuring CollectiPay branding, live progress, optional bank details, and `collectipay.com.ng` URL.
