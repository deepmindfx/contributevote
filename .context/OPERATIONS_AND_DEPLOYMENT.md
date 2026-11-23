# Operations, Security & Deployment Guide

## 1. Local Development Setup
```bash
npm install
npm run dev      # Vite dev server at http://localhost:8080
npm run build    # TypeScript check + production Vite bundle (dist/)
npm run preview  # Serve production build locally
```

## 2. Environment Variables

### Frontend (Vercel / Netlify / `.env`)
Only public client-safe variables should use the `VITE_` prefix:
| Variable | Required | Description |
| :--- | :---: | :--- |
| `VITE_SUPABASE_URL` | Yes | `https://sivvjwffekhfabgxhbcd.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase project anon/publishable key |
| `VITE_FLUTTERWAVE_PUBLIC_KEY` | Yes | Flutterwave public key (`FLWPUBK-...`) for checkout UI |
| `VITE_USE_SUPABASE` | Yes | Set to `true` (default in code) to route all API calls through Edge Functions |

> **CRITICAL**: Never set `VITE_FLW_SECRET_KEY_*`, `VITE_FLW_ENCRYPTION_KEY_*`, or `SUPABASE_SERVICE_ROLE_KEY` in frontend hosting environments — Vite injects all `VITE_*` values into client JavaScript bundles.

### Local CLI Credentials (`.env.local` — Gitignored)
```env
SUPABASE_ACCESS_TOKEN=sbp_...
SUPABASE_PROJECT_REF=sivvjwffekhfabgxhbcd
```

### Supabase Edge Function Secrets (Server-Side Only)
Manage via `supabase secrets list/set --project-ref sivvjwffekhfabgxhbcd`:
- `FLUTTERWAVE_SECRET_KEY` — Live Flutterwave v3 secret key (`FLWSECK-...`)
- `FLW_SECRET_HASH` — Secret hash configured in the Flutterwave Dashboard webhook settings
- Built-in Supabase secrets (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)

## 3. Flutterwave Dashboard Configuration
Set your Flutterwave webhook URL to:
```
https://sivvjwffekhfabgxhbcd.supabase.co/functions/v1/webhook-contribution
```
- **Secret Hash**: Must match the Supabase Edge Function secret `FLW_SECRET_HASH` (sent in the `verif-hash` HTTP header).
- **Events to Enable**: `charge.completed`, `transfer.completed`.
- **Redirect URL**: `https://<your-production-domain>/payment-callback`

## 4. Supabase Edge Functions Inventory
| Function | `verify_jwt` | Purpose |
| :--- | :---: | :--- |
| `webhook-contribution` | **`false`** | Receives Flutterwave webhooks (verifies `verif-hash` header strictly) |
| `process-scheduled-contributions` | `true` | Called by `pg_cron` via Vault bearer token |
| `flutterwave-banks` | `true` | Lists Nigerian banks (`GET /v3/banks/NG`) |
| `flutterwave-resolve-account` | `true` | Resolves account number + bank code (`POST /v3/accounts/resolve`) |
| `flutterwave-virtual-account` | `true` | Creates permanent NGN virtual bank accounts |
| `flutterwave-transfer` | `true` | Initiates bank transfer with balance check, debit, rollback on failure, and ledger entry |
| `flutterwave-invoice` | `true` | Creates Flutterwave Standard payment link |
| `flutterwave-transactions` | `true` | Queries virtual account transactions |
| `flutterwave-verify-transaction` | `true` | Server-side verification of payment callbacks (idempotent with webhook) |
| `deliver-web-push` | `false` | Sends queued device notifications after verifying its dedicated Vault token |

### Activity, payment status, and Web Push rollout

Apply migrations `20261122040000_activity_and_push.sql` and `20261122040100_payment_followups.sql` before deploying the updated `flutterwave-transfer`, `flutterwave-invoice`, and `deliver-web-push` functions. The worker also requires:

- A VAPID key pair in the Edge secrets `WEB_PUSH_PUBLIC_KEY` and `WEB_PUSH_PRIVATE_KEY`, plus `WEB_PUSH_SUBJECT` as a contact URL or `mailto:` address.
- The same public key as `VITE_WEB_PUSH_PUBLIC_KEY` in the frontend build. Keep the private key in Supabase only.
- `pg_cron`, `pg_net`, and Supabase Vault. Use the push worker setup below for its dedicated token and schedule.
- HTTPS on the app domain and individual device permission in Settings → Preferences. On iOS, add CollectiPay to the Home Screen before enabling device alerts. Wallet and group payment alerts are independent of the account-wide Payment vibration preference.

### Personal bank account bonus, transfer authorization and password requirements

1. Apply `20261122130000_wallet_bank_setup_bonus.sql` and `20261122140000_wallet_transfer_security.sql` in order. Coordinate deployment of `flutterwave-virtual-account`, `flutterwave-transfer`, and the frontend in the same release because the migration replaces the transfer authorization RPC and moves PINs out of profile preferences.
2. The ₦500 offer is paused by default. Obtain Flutterwave merchant approval for BVN consent. Verify the consent return using a test account, including the BVN and confirmed email match. Set `COLLECTIPAY_SITE_URL` in the Edge secrets if the return URL differs from the production site. Once approved and verified, set `verification_ready` on the singleton `wallet_bank_bonus_settings` row using the privileged database connection. Use Super Admin → Pricing & Revenue to open the offer. The database enforces the total cap and retains past claims if it is reopened.
3. In hosted Supabase Auth, set the minimum password length to 10 and allow any character combination. Enable leaked-password protection on supported plans for Auth API enforcement. The app already blocks common sequences, repeated values and familiar passwords before submission. Verify one random numeric password is accepted and a short or commonly used password is rejected.

### Fee controls, refunds, phone signup and incoming payment alerts

- Before applying `20261122153000_push_delivery_repair.sql` to the hosted project, create the Vault entry `collectipay_push_worker_base_url` with the project's HTTPS API origin and no trailing slash. The migration generates a separate worker token, updates the schedule, and protects the token in Vault. Deploy `deliver-web-push` with JWT gateway verification disabled. Its POST authorizes the Vault token and its GET exposes only the public VAPID key. Confirm the scheduler gets HTTP 200 and send a test alert from an opted-in device.
- Apply the numbered migrations in order. Deploy `flutterwave-transfer`, `flutterwave-virtual-account`, `flutterwave-verify-transaction`, `process-scheduled-contributions`, and `webhook-contribution` alongside the frontend. Continue deploying `webhook-contribution` with `--no-verify-jwt`; it validates the Flutterwave signature. Scheduled reconciliation requires its existing service-role bearer. Dispatched transfers without a matching provider record remain reserved for review.
- Enable the hosted Supabase **Before User Created** Auth hook `public.require_signup_phone` alongside the frontend. Existing users sign in normally. New account signup stores a normalized phone number and continues to use email confirmation.
- Existing unverified refund votes are closed during migration and remain visible in history. The owner can open a new secure vote. An approved refund returns the available amount proportionally to registered contributors, including nonvoters. Link unassigned outside payments to registered wallets before settlement.

### Profile settings and pending group bank accounts

- Apply `20261123030000_atomic_profile_settings.sql` before publishing the frontend. Settings saves merge the submitted keys into the current profile row so concurrent photo and preference updates preserve each other.
- Deploy `flutterwave-virtual-account` with JWT verification enabled. Group retries check Flutterwave when the original response supplied an order reference. If no reference came back, use the group's `GROUP_<group_id>_VA` reference to confirm the outcome with Flutterwave. After confirming the order belongs to that exact request, operations can record its `order_ref` in the existing unresolved `group_bank_account_setups.provider_account` object so the owner can retry. Clear a reservation only after Flutterwave confirms it issued no account for that request.

## 5. Hosting Configuration (Vercel & Netlify)
- **Vercel** (`vercel.json`): Includes SPA fallback rewrites (`/(.*) -> /index.html`) plus CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`.
- **Netlify** (`netlify.toml`): Includes `npm run build` → `dist`, SPA redirect `/* -> /index.html`, security headers, and immutable asset caching.

## 6. Pre-Launch Production Checklist
- [ ] Confirm `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_FLUTTERWAVE_PUBLIC_KEY`, `VITE_USE_SUPABASE=true` are set in your hosting provider (and NO `VITE_FLW_SECRET_KEY_*` vars exist there).
- [ ] Confirm Flutterwave Dashboard webhook points to `https://sivvjwffekhfabgxhbcd.supabase.co/functions/v1/webhook-contribution` with matching `FLW_SECRET_HASH`.
- [ ] Configure Supabase Auth **Site URL** and **Redirect URLs** in Supabase Dashboard → Authentication → URL Configuration to match your production domain.
- [ ] Promote at least one verified user to admin in Supabase SQL Editor: `UPDATE profiles SET role = 'admin' WHERE email = '<admin-email>';`.
- [ ] Rotate/revoke any old `sbp_*` tokens previously committed in Git history (`.cursor/mcp.json` / `.kiro/settings/mcp.json`).
