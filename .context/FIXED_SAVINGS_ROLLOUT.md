# Ice Vault rollout

Ice Vault uses the wallet ledger to reserve principal and records the accepted terms version on each lock. The migrations create a disabled program and install a maturity job that runs every minute.

## Configure the approved operating model

1. Apply `20261122171000_fixed_savings.sql` and `20261122172000_ice_vault_admin.sql` after the wallet PIN and push migrations. Deploy the matching frontend and `deliver-web-push` with its existing Vault token and JWT settings. Confirm that `collectipay-fixed-savings` is scheduled and that `scheduler_seen_at` advances. New locks stop when the scheduler heartbeat is stale. Existing locks continue to mature when intake is switched off.
2. Register `ice-vault-v1` with `https://collectipay.com.ng/terms/ice-vault/v1`. For a terms update, publish a new versioned page before changing the version and URL in Super Admin → Ice Vault. Each lock retains the accepted version and time.
3. Use the default `wallet_ledger` settlement mode with existing wallet payment and bank transfer rails. Super Admin → Ice Vault shows locked principal, active locks, upcoming and late maturities, and recently credited principal. It controls intake, amount and count limits, durations and the terms version.
4. Verify wallet debits and maturity credits in a test wallet. Check the terms link, ledger entries, simultaneous spending and lock attempts, rollback on errors, and notification preferences. Verify that the live terms page loads and the maturity heartbeat is fresh before enabling intake.
5. Monitor overdue locks, reconcile reserved principal and wallet balances, and route release delays and complaints through financial operations.

## Partner API mode

Use this mode when the approved partner itself must confirm each reserve and release. The existing Flutterwave payment integration is independent of these operations. A partner adapter is required for this mode.

The adapter polls `service_claim_fixed_savings_jobs(partner_code)` with server-only credentials after checking partner connectivity. Poll at a cadence below five minutes and continue polling old partner codes as long as existing locks remain. Each job ID is a stable provider idempotency key. Use the user's approved custody account, exact NGN amount and maturity timestamp. Releases always reference the original confirmed reserve.

Authenticate provider callbacks and verify operation, idempotency key, customer, amount, NGN currency, original reserve reference, and maturity through the provider's authenticated status API. Settle through `service_settle_fixed_savings_job` with the current lease and verified references. Use `retry` for uncertain outcomes and reconcile the existing provider operation before resending. A definitive reserve rejection restores the principal. A pending release keeps the funds unavailable. After the provider confirms release, the user can move the matured principal to the wallet.

## Wallet ledger mode

The database locks the wallet row before reducing available funds. Repeating an accepted quote returns the same lock. An identical amount and duration cannot be submitted again for ten minutes. The PostgreSQL job uses the same row order to return the full principal and record one wallet credit. If the job is late, **Withdraw to wallet** calls `withdraw_fixed_savings` for the signed-in owner, even while intake is paused. The database enforces the exact maturity time and posts a single credit across manual requests and scheduled runs. Existing wallet funding and payouts use the Flutterwave integration.

Apply `20261122211000_ice_vault_manual_release.sql` to keep older unsettled locks visible and isolate alert failures from wallet settlement. Check database warnings for alerts that could not be recorded.

New locks require terms acceptance, a transaction PIN, a healthy scheduler, and an enabled program. Customer balances and savings data are scoped to the signed-in account. The database clock determines release eligibility. Super Admin settings edits use a revision check and record the actor and before-and-after settings in the private audit table.
