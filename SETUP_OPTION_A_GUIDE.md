# Option A Setup Guide: Real-Time Refunds + 15-Min Cron

Follow these steps to implement Option A with instant refund processing.

## 📋 Prerequisites

- Access to your Supabase Dashboard
- Project URL: https://supabase.com/dashboard/project/qnkezzhrhbosekxhfqzo

## 🚀 Step-by-Step Instructions

### Step 1: Open SQL Editor

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/qnkezzhrhbosekxhfqzo
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query** button

---

### Step 2: Create Wallet Contribution Tables

Copy and paste the entire content from:
```
supabase/migrations/20250115_wallet_contribution_system.sql
```

**What this does:**
- Creates tables for recurring contributions, scheduled contributions, and refund requests
- Adds database functions for wallet contributions and refund processing
- Sets up Row Level Security (RLS) policies

**Click "Run" to execute**

✅ You should see: "Success. No rows returned"

---

### Step 3: Add Real-Time Refund Trigger

Copy and paste the entire content from:
```
supabase/migrations/20250115_realtime_refund_trigger.sql
```

**What this does:**
- Creates a trigger that automatically processes refunds when voting thresholds are met
- Checks governance rules: 60% approval + 70% participation
- Processes refund instantly without waiting for cron job

**Click "Run" to execute**

✅ You should see: "Success. No rows returned"

---

### Step 4: Update Cron Schedule to 15 Minutes

Copy and paste this SQL:

```sql
-- Unschedule the old hourly job
SELECT cron.unschedule('process-scheduled-contributions');

-- Schedule to run every 15 minutes for recurring and scheduled contributions
SELECT cron.schedule(
  'process-scheduled-contributions',
  '*/15 * * * *', -- Every 15 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://qnkezzhrhbosekxhfqzo.supabase.co/functions/v1/process-scheduled-contributions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Add a separate hourly job just for deadline checks (less urgent)
SELECT cron.schedule(
  'check-refund-deadlines',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
      url := 'https://qnkezzhrhbosekxhfqzo.supabase.co/functions/v1/process-scheduled-contributions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object('deadlines_only', true)
    ) as request_id;
  $$
);
```

**What this does:**
- Updates cron to run every 15 minutes (instead of every hour)
- Adds a separate hourly job for deadline checks only
- Reduces wait time from 1 hour to 15 minutes max

**Click "Run" to execute**

✅ You should see: "Success. 2 rows returned" (the two cron job IDs)

---

### Step 5: Verify Setup

Run this query to check everything is working:

```sql
-- Check if tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'recurring_contributions', 
  'scheduled_contributions', 
  'group_refund_requests', 
  'refund_transactions'
);

-- Check if trigger was created
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trigger_check_refund_approval';

-- Check cron jobs
SELECT jobid, jobname, schedule, active 
FROM cron.job;
```

**Expected Results:**
- ✅ 4 tables listed
- ✅ 1 trigger listed
- ✅ 2 cron jobs listed (both active)

---

## 🎉 What You've Accomplished

### ✅ Real-Time Refund Processing
- Refunds are processed **instantly** when voting thresholds are met
- No waiting for cron job
- Users get their money back immediately

### ✅ Optimized Cron Schedule
- **Every 15 minutes:** Process recurring and scheduled contributions
- **Every hour:** Check for expired voting deadlines
- **Max wait time:** 15 minutes (down from 1 hour)

### ✅ Cost-Effective
- ~96 invocations per day
- Estimated cost: ~$0.30/month
- Much better UX with minimal cost increase

---

## 🔍 How to Monitor

### Check Cron Job Logs
1. Go to **Edge Functions** in Supabase Dashboard
2. Click on `process-scheduled-contributions`
3. View **Logs** tab

### Check Trigger Activity
1. Go to **SQL Editor**
2. Run this query:
```sql
SELECT * FROM group_refund_requests 
WHERE status = 'approved' 
ORDER BY updated_at DESC 
LIMIT 10;
```

---

## 🧪 How to Test

### Test Real-Time Refund
1. Create a test group with a few contributors
2. Request a refund
3. Have contributors vote
4. When thresholds are met (60% approval + 70% participation), refund processes **instantly**
5. Check wallets - money should be refunded immediately

### Test Scheduled Contribution
1. Schedule a contribution for 20 minutes from now
2. Wait 20 minutes
3. Check logs - should be processed within 15 minutes of scheduled time

---

## 📊 Performance Comparison

| Feature | Before | After (Option A) |
|---------|--------|------------------|
| Refund Processing | Up to 1 hour | **Instant** |
| Scheduled Contributions | Up to 1 hour | Up to 15 minutes |
| Recurring Contributions | Up to 1 hour | Up to 15 minutes |
| Cost per Month | ~$0.08 | ~$0.30 |
| User Experience | Poor | **Excellent** |

---

## ❓ Troubleshooting

### If tables don't exist:
- Make sure Step 2 completed successfully
- Check for error messages in SQL Editor

### If trigger doesn't fire:
- Check that `group_refund_requests` table exists
- Verify trigger is active with the verification query

### If cron jobs don't run:
- Check that `pg_cron` and `pg_net` extensions are enabled
- Verify jobs are active with the verification query
- Check Edge Function logs for errors

---

## 🎯 Next Steps

After setup is complete:
1. ✅ Test with a real refund request
2. ✅ Monitor logs for first few runs
3. ✅ Verify instant refund processing works
4. ✅ Check that scheduled contributions process within 15 minutes

---

## 💡 Need Help?

If you encounter any issues:
1. Check the SQL Editor for error messages
2. Review the Edge Function logs
3. Verify all tables and triggers exist using the verification queries

