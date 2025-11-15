# Cron Job Setup for Automated Contributions

## ✅ Edge Function Deployed

**Function Name:** `process-scheduled-contributions`  
**Status:** ACTIVE  
**Version:** 1

## 🎯 What It Does

This edge function automatically processes:

1. **Recurring Contributions** - Daily/weekly/monthly auto-contributions
2. **Scheduled Contributions** - One-time future contributions
3. **Refund Voting Deadlines** - Checks if voting period ended and processes results

## 🔧 How to Set Up Cron Job

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/qnkezzhrhbosekxhfqzo
2. Navigate to **Database** → **Cron Jobs** (or use pg_cron extension)
3. Create a new cron job with this SQL:

```sql
-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the edge function to run every hour
SELECT cron.schedule(
  'process-scheduled-contributions',
  '0 * * * *', -- Every hour at minute 0
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
```

### Option 2: Using External Cron Service

If you prefer an external service like **cron-job.org** or **EasyCron**:

1. **URL:** `https://qnkezzhrhbosekxhfqzo.supabase.co/functions/v1/process-scheduled-contributions`
2. **Method:** POST
3. **Headers:**
   - `Content-Type: application/json`
   - `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`
4. **Schedule:** Every hour (or more frequently if needed)

### Option 3: Using GitHub Actions

Create `.github/workflows/cron-contributions.yml`:

```yaml
name: Process Scheduled Contributions

on:
  schedule:
    - cron: '0 * * * *' # Every hour
  workflow_dispatch: # Allow manual trigger

jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - name: Call Edge Function
        run: |
          curl -X POST \
            https://qnkezzhrhbosekxhfqzo.supabase.co/functions/v1/process-scheduled-contributions \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}"
```

## 📊 Monitoring

### Check Function Logs

1. Go to **Edge Functions** in Supabase Dashboard
2. Click on `process-scheduled-contributions`
3. View **Logs** tab to see execution results

### Expected Response

```json
{
  "success": true,
  "timestamp": "2025-11-15T10:00:00.000Z",
  "results": {
    "recurring": {
      "processed": 5,
      "failed": 0
    },
    "scheduled": {
      "processed": 2,
      "failed": 0
    },
    "refunds": {
      "processed": 1,
      "failed": 0
    }
  }
}
```

## 🔐 Security Notes

- The function uses `SUPABASE_SERVICE_ROLE_KEY` for admin access
- This key is automatically available in edge functions
- Never expose this key in client-side code
- The function bypasses RLS policies to process contributions

## ⚙️ Customizing Schedule

### Run More Frequently

For more real-time processing, you can run it more often:

- **Every 15 minutes:** `*/15 * * * *`
- **Every 30 minutes:** `*/30 * * * *`
- **Every 6 hours:** `0 */6 * * *`

### Run at Specific Times

- **Daily at midnight:** `0 0 * * *`
- **Daily at 9 AM:** `0 9 * * *`
- **Twice daily (9 AM & 9 PM):** `0 9,21 * * *`

## 🧪 Testing the Function

You can manually trigger the function to test it:

```bash
curl -X POST \
  https://qnkezzhrhbosekxhfqzo.supabase.co/functions/v1/process-scheduled-contributions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

Or use the Supabase CLI:

```bash
supabase functions invoke process-scheduled-contributions
```

## 📈 Performance Considerations

- The function processes all due contributions in a single run
- Each contribution is processed independently (failures don't affect others)
- Database transactions ensure consistency
- Failed contributions are logged and marked appropriately

## 🚨 Error Handling

The function handles errors gracefully:

1. **Insufficient Balance** - Scheduled contribution marked as failed
2. **Invalid Group** - Contribution skipped, logged
3. **Database Error** - Transaction rolled back, logged
4. **Network Error** - Retried on next cron run

## 📝 Status

1. ✅ Edge function deployed
2. ✅ Cron job set up and running (every hour)
3. ✅ Migration applied successfully
4. ⏳ Test with a scheduled contribution
5. ⏳ Monitor logs for first few runs
6. ⏳ Set up alerts for failures (optional)

## ✅ Cron Job Active

**Job Name:** `process-scheduled-contributions`  
**Schedule:** Every hour at minute 0 (`0 * * * *`)  
**Status:** Active  
**Next Run:** Top of the next hour

You can view the cron job status by running:
```sql
SELECT jobid, jobname, schedule, active FROM cron.job;
```

## 🎉 Benefits

- **Automated Processing** - No manual intervention needed
- **Reliable** - Runs on schedule, retries on failure
- **Scalable** - Handles multiple contributions efficiently
- **Transparent** - Full logging and monitoring
- **Secure** - Uses service role key, bypasses RLS safely

