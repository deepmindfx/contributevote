# System Architecture

## High-Level Topology

```
Browser (React 18 + Vite + Tailwind + shadcn/ui)
  ├── Supabase JS Client (Anon Key + User JWT)
  │     ├── Supabase Auth (email/password sessions)
  │     ├── PostgREST (RLS-protected tables & SECURITY DEFINER RPCs)
  │     ├── Supabase Realtime (profiles, notifications, contribution_groups, contributors, withdrawal_requests, group_refund_requests)
  │     └── Supabase Edge Functions (Deno)
  │           ├── flutterwave-virtual-account  ──► Flutterwave /v3/virtual-account-numbers
  │           ├── flutterwave-banks            ──► Flutterwave /v3/banks/NG
  │           ├── flutterwave-resolve-account  ──► Flutterwave /v3/accounts/resolve
  │           ├── flutterwave-transfer         ──► Flutterwave /v3/transfers (+ wallet debit/rollback)
  │           ├── flutterwave-invoice          ──► Flutterwave /v3/payments
  │           ├── flutterwave-transactions     ──► Flutterwave /v3/virtual-account-numbers/:ref/transactions
  │           └── flutterwave-verify-transaction ─► Flutterwave /v3/transactions/:id/verify (+ idempotent credit)
  │
  ├── External Webhooks (Flutterwave ──► Edge Function, --no-verify-jwt + verif-hash)
  │     └── webhook-contribution ──► credits user wallets, records group bank transfers, updates transfer statuses
  │
  └── Scheduled Automation (pg_cron + pg_net + Supabase Vault)
        └── process-scheduled-contributions (*/15 min & hourly deadlines)
```

## Frontend Routing Map (`src/App.tsx`)

### Public Routes
| Path | Page Component | Purpose |
| :--- | :--- | :--- |
| `/` | `src/pages/Index.tsx` | Marketing landing page |
| `/auth` | `src/pages/Auth.tsx` | User sign-in & sign-up (supports `?redirect=` and `state.returnUrl`) |
| `/admin-login` | `src/pages/AdminAuth.tsx` | Supabase Auth login gated to `profiles.role === 'admin'` |
| `/discover` | `src/pages/Discover.tsx` | Public group marketplace (filters, sorting, pagination) |
| `/join/:id` | `src/pages/JoinGroup.tsx` | Public group join preview & onboarding |
| `/invite/:token` | `src/pages/AcceptInvite.tsx` | Private group invitation preview & acceptance |
| `/contribute/share/:id` | `src/pages/ContributeSharePage.tsx` | Shareable public contribution link + group virtual account card |
| `/payment-callback` | `src/pages/PaymentCallback.tsx` | Flutterwave redirect handler (verifies via `flutterwave-verify-transaction`) |

### Protected Routes (`ProtectedRoute`)
| Path | Page Component | Purpose |
| :--- | :--- | :--- |
| `/dashboard` | `src/pages/Dashboard.tsx` | Wallet card, virtual bank account tab, My Groups, Recent Activity, Notifications |
| `/create-group` | `src/pages/CreateGroup.tsx` | 3-step group creation wizard (`GroupForm`) |
| `/all-groups` | `src/pages/AllGroups.tsx` | Paginated, sortable, category-filterable list including archive toggle |
| `/groups/:id` | `src/pages/GroupDetail.tsx` | Group dashboard: contribute, recurring/scheduled, bank card, votes, refunds, activity, contributors, admin panel |
| `/contribute/:id` | `src/pages/ContributePage.tsx` | Direct wallet contribution page |
| `/votes` | `src/pages/Votes.tsx` | Governance center for active & historical withdrawal votes |
| `/transfer` | `src/components/TransferForm.tsx` | Outbound bank transfer with 4-digit PIN, account resolution, and PNG receipt |
| `/wallet-history` | `src/pages/WalletHistory.tsx` | Full app ledger + virtual account bank history + NGN/USD toggle |
| `/activity` | `src/pages/ActivityHistory.tsx` | Categorized activity feed |
| `/profile` | `src/pages/UserProfile.tsx` | User summary stats, profile info, and recent groups |
| `/settings` | `src/pages/UserSettings.tsx` | Profile info, 4-digit transaction PIN, password change, preferences |
| `/test-transfer-api` | `src/pages/TestTransferAPI.tsx` | **Development only** (`import.meta.env.DEV`) |

### Admin Routes (`AdminRoute`)
| Path | Page Component | Purpose |
| :--- | :--- | :--- |
| `/admin`, `/admin/*` | `src/pages/admin/Dashboard.tsx` | Platform-wide user management, atomic admin wallet credit, user pause/activate, all groups & transactions |

## Context Providers
1. **`SupabaseUserProvider`** (`src/contexts/SupabaseUserContext.tsx`)
   - Manages Supabase Auth session, profile loading/auto-creation, `profiles` & `notifications` Realtime channels, admin user list (only fetched when `role === 'admin'`), and notification actions.
2. **`SupabaseContributionProvider`** (`src/contexts/SupabaseContributionContext.tsx`)
   - Manages user's created & joined groups, user transactions, stats, and group withdrawal requests with 2-second refresh throttling and Realtime subscriptions on `contribution_groups`, `contributors`, and `withdrawal_requests`.

## Active Supabase Services (`src/services/supabase/`)
- `userService.ts` — CRUD on `profiles`
- `notificationService.ts` — Read/mark-read on `notifications`
- `contributionService.ts` — CRUD & joins on `contribution_groups`
- `contributorService.ts` — Safe contributor queries (`get_group_contributors_safe`), voting rights checks, pending bank transfer management
- `walletService.ts` — Personal virtual account provisioning (stores in `profiles.preferences.virtualAccount` & saves `profiles.bvn`) and Flutterwave invoices
- `walletContributionService.ts` — `contribute_from_wallet`, recurring/scheduled contributions, and group refund request creation/voting/execution
- `groupEnhancementService.ts` — 19 categories, free creation eligibility (`check_group_creation_eligibility`), `create_group_with_fee_check`, archiving, sorting/filtering
- `groupContributionService.ts` — Payment/bank transfer helpers and admin verification (supports email or UUID lookup)
- `groupJoinService.ts` — Public group join & share link generation
- `invitationService.ts` — Private group invitations (`get_invitation_by_token`, duplicate check via `lookup_user_id_by_email`)
- `discoverService.ts` — Public marketplace search, filters, sorting, and stats
- `withdrawalService.ts` — Withdrawal request creation, voting (`voteOnWithdrawal` + `record_withdrawal_vote` + `check_withdrawal_voting`), instant withdrawals
- `transactionService.ts` — Transaction queries and summary stats
- `edgeFunctionService.ts` & `apiService.ts` — Typed wrappers around Supabase Edge Functions (defaulting to Supabase Edge Functions unless `VITE_USE_SUPABASE=false`)
- `syncService.ts` — Wallet/group reconciliation helpers
