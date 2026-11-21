# ContributeVote project index

ContributeVote is a group funding app with personal wallets, public discovery, private invitations, and voting on group withdrawals and refunds. The React 18 and TypeScript frontend runs on Vite and uses Tailwind and shadcn/ui. Supabase provides Auth, PostgreSQL, Realtime, and Deno Edge Functions. Flutterwave provides Nigerian bank accounts, checkout, and bank transfers.

## Application entry points

- [src/main.tsx](../src/main.tsx) mounts [App.tsx](../src/App.tsx). `App.tsx` owns the React Router route list, authentication and admin guards, and the provider tree. It mounts `SupabaseUserProvider` and `SupabaseContributionProvider` directly.
- [SupabaseUserContext.tsx](../src/contexts/SupabaseUserContext.tsx) restores the Supabase Auth session, fetches or creates the `profiles` row, and subscribes to profile changes. The [auth screen](../src/pages/Auth.tsx), [settings](../src/pages/UserSettings.tsx), and [admin dashboard](../src/pages/admin/Dashboard.tsx) use this context.
- [SupabaseContributionContext.tsx](../src/contexts/SupabaseContributionContext.tsx) supplies group, transaction, and withdrawal data. The [dashboard](../src/pages/Dashboard.tsx) composes the personal wallet, groups, and recent activity. [Wallet History](../src/pages/WalletHistory.tsx), [Activity History](../src/pages/ActivityHistory.tsx), and [Votes](../src/pages/Votes.tsx) provide dedicated views.
- [supabase/client.ts](../src/integrations/supabase/client.ts) is the shared browser client. [supabase/types.ts](../src/integrations/supabase/types.ts) defines client-side database types. Some newer tables and RPCs are used through casts in the service layer, so check the SQL when changing schemas.

## Group and payment flows

### Group creation and membership

- `/create-group` uses [GroupForm.tsx](../src/components/create-group/GroupForm.tsx). [groupEnhancementService.ts](../src/services/supabase/groupEnhancementService.ts) calls `check_group_creation_eligibility` and `create_group_with_fee_check`. The form can also provision a Flutterwave virtual account for the group. `/groups/:id` is implemented in [GroupDetail.tsx](../src/pages/GroupDetail.tsx), which assembles the panels in [components/contribution](../src/components/contribution).
- `/discover` uses [discoverService.ts](../src/services/supabase/discoverService.ts) to browse public groups. [JoinGroup.tsx](../src/pages/JoinGroup.tsx) and [groupJoinService.ts](../src/services/supabase/groupJoinService.ts) handle public join links. [AcceptInvite.tsx](../src/pages/AcceptInvite.tsx) and [invitationService.ts](../src/services/supabase/invitationService.ts) handle private invitation tokens.

### Wallets and contributions

- The personal wallet balance lives in `profiles.wallet_balance`. [ReservedAccount.tsx](../src/components/wallet/ReservedAccount.tsx) uses [walletService.ts](../src/services/supabase/walletService.ts) to create a Flutterwave virtual account through [edgeFunctionService.ts](../src/services/supabase/edgeFunctionService.ts). The profile stores the account details under `preferences.virtualAccount` and the BVN for reuse when provisioning a group account.
- The group virtual account has its own account details on `contribution_groups`. [virtualAccounts.ts](../src/services/flutterwave/virtualAccounts.ts) provisions it through the Flutterwave virtual-account Edge Function. [webhook-contribution](../supabase/functions/webhook-contribution/index.ts) handles inbound Flutterwave events and contains the database writes for personal top-ups and group credits.
- [ContributeButton.tsx](../src/components/contribution/ContributeButton.tsx) calls [walletContributionService.ts](../src/services/supabase/walletContributionService.ts). Its `contribute_from_wallet` RPC updates the personal wallet balance, group total, contributor record, and transaction history in PostgreSQL. The same service creates recurring and one-time scheduled contributions. [process-scheduled-contributions](../supabase/functions/process-scheduled-contributions/index.ts) processes due contributions and evaluates expired votes when invoked.
- `/contribute/:id` and `/contribute/share/:id` use [ContributePage.tsx](../src/pages/ContributePage.tsx) and [ContributeSharePage.tsx](../src/pages/ContributeSharePage.tsx). Both call the contribution context's `contribute` method, which writes the contributor and transaction records through separate service calls. The share page also looks up the group in browser local storage.

### Governance and payouts

- `contributors` records contribution amounts, verification, and voting rights. Start with [contributorService.ts](../src/services/supabase/contributorService.ts) and [useVotingRights.ts](../src/hooks/useVotingRights.ts) for eligibility and attribution.
- [withdrawalService.ts](../src/services/supabase/withdrawalService.ts) handles requests and votes. The SQL settles an approved withdrawal into the group admin's personal wallet. Groups with voting rights disabled use `process_instant_withdrawal`.
- [GroupRefundDialog.tsx](../src/components/contribution/GroupRefundDialog.tsx) submits a refund request. [RefundRequestsCard.tsx](../src/components/contribution/RefundRequestsCard.tsx) displays votes and subscribes to updates. The master SQL defines `check_and_process_refund` and `process_group_refund` for approval and repayment to contributors' wallets.
- `/transfer` uses [TransferForm.tsx](../src/components/TransferForm.tsx) and [apiService.ts](../src/services/supabase/apiService.ts) for bank lookup, account resolution, and transfers out of the personal wallet. `VITE_USE_SUPABASE=true` selects the Supabase Edge Functions, including [flutterwave-transfer](../supabase/functions/flutterwave-transfer/index.ts). The alternate branch targets the local [Express server](../server.cjs) on port `5000`.

## Backend and deployment

- [master_migration.sql](../master_migration.sql) is the consolidated database setup in the latest commit. It defines the main tables, Auth profile trigger, row-level security policies, financial and voting RPCs, and Realtime publication changes. [supabase/migrations](../supabase/migrations) contains incremental versions of many of the same objects. Check the target database's migration state before selecting a setup path. The cron registration examples in the master file are commented out.
- [supabase/functions](../supabase/functions) contains eight Edge Functions covering bank lookup, account resolution, transfers, virtual accounts, invoices, transaction lookup, incoming payment events, and scheduled contributions. The browser uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to connect. The Flutterwave wrappers read provider credentials from server-side environment variables.
- [netlify.toml](../netlify.toml) builds and publishes `dist` and configures SPA routing. [vercel.json](../vercel.json) configures response headers. The repository also contains [Netlify handlers](../netlify/functions) and [Next-style handler files](../src/pages/api). For local API routing, [vite.config.ts](../vite.config.ts) proxies `/api/flutterwave` to Flutterwave and other `/api` requests to Express.
- Migration carryovers still appear in routed code. [PaymentCallback.tsx](../src/pages/PaymentCallback.tsx) writes contributions through local storage, while the dashboard wallet and wallet history still import [walletIntegration.ts](../src/services/walletIntegration.ts). Some browser modules reference Flutterwave credential variables with a `VITE_` prefix, which makes values used by client code available in the bundle. Keep this boundary in view when tracing payment behavior or configuring an environment.

## Local verification

Use a Node version that satisfies the locked dependency requirements, such as Node 22.12+ or Node 24. The locked React Vite plugin requires Node `^20.19.0 || >=22.12.0`.

```sh
npm ci
npm run dev
npm run build
npm run lint
```

- Vite defaults to port `8080`. `npm run server` starts the Express API for the legacy transfer branch. Use environment variable names from [`.env.example`](../.env.example) and the corresponding service code. The repository tracks `.env`, so avoid adding credentials to it.
- [tests](../tests) contains SQL checks for the wallet system. [simple-wallet-test.sql](../tests/simple-wallet-test.sql) can make a contribution using existing data, so run database checks on a disposable test database. [MANUAL_TEST_GUIDE.md](../MANUAL_TEST_GUIDE.md) documents browser scenarios. [package.json](../package.json) has no `test` script.
- The clean install attempt stopped at npm registry DNS resolution, so build and lint execution remain unverified. The [ESLint config](../eslint.config.js) imports `typescript-eslint`, which is absent from the package manifest and lockfile. The build script runs plain `tsc` against a root config with project references and an empty file list. Use `npx tsc --noEmit -p tsconfig.app.json` after installation for an explicit app type check.
