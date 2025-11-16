# Deploy Webhook Fix - Quick Guide

## ✅ DEPLOYED SUCCESSFULLY!

The webhook fix has been applied and deployed to Supabase.

**Deployment Details:**
- Function: webhook-contribution
- Version: 11
- Status: ACTIVE
- Deployed: Via Supabase MCP

---

## Deployment Command

```bash
supabase functions deploy webhook-contribution
```

---

## What This Fixes

✅ Group account transfers now go to GROUP wallet (not user wallet)
✅ User account transfers still go to USER wallet
✅ Proper routing based on account ownership
✅ Anonymous contributors can contribute to groups
✅ Correct transaction tracking

---

## After Deployment

### Test It:
1. Get a group's bank account details
2. Transfer ₦100 to that account
3. Check the group detail page
4. Verify the group balance increased by ₦100
5. Verify it shows in contributors list

### Monitor:
- Check Supabase function logs for any errors
- Verify webhook is receiving transfers
- Confirm routing is working correctly

---

## Rollback (if needed)

If something goes wrong, you can rollback by redeploying the previous version from git history.

---

## Files Changed

- `supabase/functions/webhook-contribution/index.ts` - Main fix applied here

---

## Support

If you encounter issues:
1. Check Supabase function logs
2. Verify the webhook URL is correct in Flutterwave
3. Test with small amounts first
4. Check database for transaction records

---

That's it! Deploy and test. 🎉
