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
| `deliver-web-push` | `true` | Sends queued device notifications using the service role and Web Push VAPID keys |

### Activity, payment status, and Web Push rollout

Apply migrations `20261122040000_activity_and_push.sql` and `20261122040100_payment_followups.sql` before deploying the updated `flutterwave-transfer`, `flutterwave-invoice`, and `deliver-web-push` functions. The worker also requires:

- A VAPID key pair in the Edge secrets `WEB_PUSH_PUBLIC_KEY` and `WEB_PUSH_PRIVATE_KEY`, plus `WEB_PUSH_SUBJECT` as a contact URL or `mailto:` address.
- The same public key as `VITE_WEB_PUSH_PUBLIC_KEY` in the frontend build. Keep the private key in Supabase only.
- `pg_cron`, `pg_net`, Supabase Vault, and the `collectipay_cron_bearer` Vault entry containing the service-role JWT. The migration schedules `deliver-collectipay-web-push` every minute when those extensions are available.
- HTTPS on the app domain and individual device permission in Settings → Preferences. On iOS, add CollectiPay to the Home Screen before enabling device alerts.

## 5. Hosting Configuration (Vercel & Netlify)
- **Vercel** (`vercel.json`): Includes SPA fallback rewrites (`/(.*) -> /index.html`) plus CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`.
- **Netlify** (`netlify.toml`): Includes `npm run build` → `dist`, SPA redirect `/* -> /index.html`, security headers, and immutable asset caching.

## 6. Pre-Launch Production Checklist
- [ ] Confirm `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_FLUTTERWAVE_PUBLIC_KEY`, `VITE_USE_SUPABASE=true` are set in your hosting provider (and NO `VITE_FLW_SECRET_KEY_*` vars exist there).
- [ ] Confirm Flutterwave Dashboard webhook points to `https://sivvjwffekhfabgxhbcd.supabase.co/functions/v1/webhook-contribution` with matching `FLW_SECRET_HASH`.
- [ ] Configure Supabase Auth **Site URL** and **Redirect URLs** in Supabase Dashboard → Authentication → URL Configuration to match your production domain.
- [ ] Promote at least one verified user to admin in Supabase SQL Editor: `UPDATE profiles SET role = 'admin' WHERE email = '<admin-email>';`.
- [ ] Rotate/revoke any old `sbp_*` tokens previously committed in Git history (`.cursor/mcp.json` / `.kiro/settings/mcp.json`).
