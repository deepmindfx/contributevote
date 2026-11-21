# CollectiPay Knowledge Base & Context

Welcome to the central knowledge base for **CollectiPay (ContributeVote)** — a Nigerian (`NGN` / `₦`) group contribution, personal wallet, and democratic withdrawal/refund governance platform.

## Quick Index
| Document | What It Covers |
| :--- | :--- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Tech stack, frontend routing, React contexts, Supabase services, Edge Functions, Flutterwave architecture, and legacy boundaries. |
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | Complete reference of all 11 PostgreSQL tables, RLS policies, 18 RPCs/functions, triggers, Realtime publications, and Vault-backed `pg_cron` jobs. |
| [FEATURES_AND_WORKFLOWS.md](./FEATURES_AND_WORKFLOWS.md) | End-to-end feature map: Auth, Personal Wallet & Virtual Accounts, BVN Reuse, Group Creation & Free Quota, Funding Modes, Voting Governance, Recurring/Scheduled Contributions, Invites, Receipts, and Admin Panel. |
| [OPERATIONS_AND_DEPLOYMENT.md](./OPERATIONS_AND_DEPLOYMENT.md) | Local dev setup, environment variables, Supabase CLI/Management API operations, Flutterwave webhook setup, Vercel/Netlify deployment, and security checklist. |
| [CHANGELOG_REVIVAL.md](./CHANGELOG_REVIVAL.md) | Complete log of issues discovered and fixed during the 2026 backend revival & production hardening pass. |

## Live Backend Identifiers
- **Supabase Project**: `CollectiPay` (`sivvjwffekhfabgxhbcd`)
- **Supabase URL**: `https://sivvjwffekhfabgxhbcd.supabase.co`
- **Region**: `eu-central-2` (PostgreSQL 17)
- **Payment Provider**: Flutterwave v3 (via Supabase Edge Functions)
- **Workspace Skill**: `.agents/skills/collectipay-supabase/SKILL.md`

## Active vs. Deprecated Code Boundaries
This repository evolved from an early `localStorage` + Monnify + Express prototype into a full Supabase + Flutterwave production app:
- **Active (Use These)**:
  - Contexts: `src/contexts/SupabaseUserContext.tsx`, `src/contexts/SupabaseContributionContext.tsx`
  - Services: `src/services/supabase/*`
  - Edge Functions: `supabase/functions/*` (9 deployed functions)
  - Schema: `master_migration.sql` + `supabase/migrations/20261121_production_hardening.sql`
- **Deprecated / Legacy (Do Not Build New Features Here)**:
  - `src/services/localStorage/*`, `src/localStorage.ts`
  - `src/services/monnify/*`, `src/services/wallet/*`, `src/services/walletIntegration.ts`
  - `src/contexts/UserContext.tsx`, `ContributionContext.tsx`, `AdminContext.tsx`, `SecureAuthContext.tsx`, `AppProviders.tsx`
  - `server.cjs` (legacy local Express proxy on port 5000) and `src/pages/api/*` (unused Next.js-style stubs)
