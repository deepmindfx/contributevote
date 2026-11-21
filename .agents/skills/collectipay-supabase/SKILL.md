---
name: collectipay-supabase
description: >-
  Run Supabase CLI commands, Management API SQL queries, type generation, and
  Edge Function deployments for the CollectiPay Supabase project
  (sivvjwffekhfabgxhbcd) using the safely stored local access token in .env.local.
---

# CollectiPay Supabase Operations Skill

Use this skill whenever you need to inspect or modify the live CollectiPay Supabase backend (`sivvjwffekhfabgxhbcd`).

## Project Metadata
- **Project Name**: CollectiPay
- **Project Ref**: `sivvjwffekhfabgxhbcd`
- **Organization ID**: `ababdgdkwdxzdvpolfts`
- **Region**: `eu-central-2`
- **API URL**: `https://sivvjwffekhfabgxhbcd.supabase.co`
- **Local Supabase CLI Binary**: `.\supabase_cli\supabase.exe` (or global `supabase` if installed)

## Safe Credential Loading (Never Leak Token)
The Supabase Personal Access Token (`SUPABASE_ACCESS_TOKEN`) is stored locally in the gitignored `.env.local` file at the repository root.

**CRITICAL**: Never print, echo, or commit the token value to tracked files, logs, or chat output.

### Verify Token Presence (PowerShell)
```powershell
if (Select-String -Path .env.local -Pattern '^SUPABASE_ACCESS_TOKEN=sbp_' -Quiet) {
  Write-Host "SUPABASE_ACCESS_TOKEN is configured in .env.local"
} else {
  Write-Error "SUPABASE_ACCESS_TOKEN missing in .env.local"
}
```

### Load Token Into Current PowerShell Session
```powershell
$env:SUPABASE_ACCESS_TOKEN = (Get-Content .env.local | Where-Object { $_ -match '^SUPABASE_ACCESS_TOKEN=' }).Split('=', 2)[1].Trim()
$ref = "sivvjwffekhfabgxhbcd"
```

## Common Workflows

### 1. List Projects, Functions & Secrets
```powershell
.\supabase_cli\supabase.exe projects list
.\supabase_cli\supabase.exe functions list --project-ref $ref
.\supabase_cli\supabase.exe secrets list --project-ref $ref
```

### 2. Deploy Edge Functions
> **IMPORTANT**: `webhook-contribution` MUST always be deployed with `--no-verify-jwt` so external Flutterwave webhooks are accepted (it verifies `verif-hash` against `FLW_SECRET_HASH`).

```powershell
# Webhook (MUST include --no-verify-jwt)
.\supabase_cli\supabase.exe functions deploy webhook-contribution --project-ref $ref --no-verify-jwt

# Authenticated / Cron Edge Functions
.\supabase_cli\supabase.exe functions deploy process-scheduled-contributions --project-ref $ref
.\supabase_cli\supabase.exe functions deploy flutterwave-transfer --project-ref $ref
.\supabase_cli\supabase.exe functions deploy flutterwave-resolve-account --project-ref $ref
.\supabase_cli\supabase.exe functions deploy flutterwave-verify-transaction --project-ref $ref
.\supabase_cli\supabase.exe functions deploy flutterwave-virtual-account --project-ref $ref
.\supabase_cli\supabase.exe functions deploy flutterwave-banks --project-ref $ref
.\supabase_cli\supabase.exe functions deploy flutterwave-invoice --project-ref $ref
.\supabase_cli\supabase.exe functions deploy flutterwave-transactions --project-ref $ref
```

### 3. Run SQL Against Live Postgres (Management API)
Note: The `/database/query` endpoint has a ~10 KB body limit; split large migrations into sections.

```powershell
$headers = @{
  Authorization  = "Bearer $env:SUPABASE_ACCESS_TOKEN"
  "Content-Type" = "application/json"
}
$body = @{ query = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1;" } | ConvertTo-Json
Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/$ref/database/query" -Method POST -Headers $headers -Body $body
```

### 4. Regenerate Frontend Database Types
Run after any schema or RPC change:
```powershell
$types = .\supabase_cli\supabase.exe gen types typescript --project-id $ref 2>$null
Set-Content -Path "src\integrations\supabase\types.ts" -Value $types -Encoding UTF8
```

### 5. Live Secrets Configured in Supabase
- `FLUTTERWAVE_SECRET_KEY` — Server-side Flutterwave v3 secret key (used by all `flutterwave-*` functions).
- `FLW_SECRET_HASH` — Flutterwave webhook verification hash (checked via `verif-hash` header in `webhook-contribution`).
- Vault secret `collectipay_cron_bearer` — Used by `pg_cron` jobs (`process-scheduled-contributions` and `check-refund-deadlines`) to authenticate `net.http_post` calls.
