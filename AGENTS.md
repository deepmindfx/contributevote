# CollectiPay (ContributeVote) Workspace Instructions

This repository is **CollectiPay**, a React + TypeScript + Supabase + Flutterwave group contribution and democratic governance platform (`NGN` / `₦`).

## Project Knowledge Base & Context
Before making architectural, database, or payment changes, consult the structured knowledge base in `.context/`:
- `.context/README.md` — Project overview, quick index, and active vs. legacy boundaries.
- `.context/ARCHITECTURE.md` — Frontend routes, contexts, services, Edge Functions, and Flutterwave integration.
- `.context/DATABASE_SCHEMA.md` — All 11 PostgreSQL tables, RLS policies, RPCs, triggers, Realtime, and `pg_cron` jobs.
- `.context/FEATURES_AND_WORKFLOWS.md` — End-to-end user flows, voting governance rules (70% participation / 60% approval), and payment flows.
- `.context/OPERATIONS_AND_DEPLOYMENT.md` — Environment variables, Supabase CLI operations, Edge Function deploy rules, and Vercel/Netlify checklists.
- `.context/CHANGELOG_REVIVAL.md` — Record of production hardening fixes and migration status.

## Supabase Access & Tooling
- Activate the workspace skill `.agents/skills/collectipay-supabase/SKILL.md` whenever interacting with the live Supabase project (`sivvjwffekhfabgxhbcd`), running SQL migrations, regenerating types, or deploying Edge Functions.
- **Security Rule**: Never commit secrets (`sbp_*`, `FLWSECK-*`, `SUPABASE_SERVICE_ROLE_KEY`) to Git or `VITE_*` browser variables. Local CLI credentials live strictly in gitignored `.env.local`.
- **Webhook Rule**: `webhook-contribution` MUST always be deployed with `--no-verify-jwt` so Flutterwave can deliver webhooks (signature is verified strictly via `verif-hash` against `FLW_SECRET_HASH`).

## Coding Conventions
- Always use Supabase **snake_case** column names (`wallet_balance`, `current_amount`, `target_amount`, `created_at`, `user_id`), never legacy camelCase localStorage names.
- Never write new features against `src/services/localStorage/` or `src/services/monnify/` — those are deprecated legacy modules.
- When updating `profiles.preferences`, ALWAYS spread existing `user.preferences` so `virtualAccount` and `transactionPin` are never overwritten.
