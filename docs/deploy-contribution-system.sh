#!/bin/bash

echo "========================================"
echo "Contribution Tracking System Deployment"
echo "========================================"
echo ""

echo "Step 1: Deploying webhook-contribution edge function..."
echo ""
supabase functions deploy webhook-contribution
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to deploy webhook-contribution"
    echo "Please check your Supabase CLI authentication"
    exit 1
fi
echo ""
echo "✅ Webhook function deployed successfully!"
echo ""

echo "Step 2: Listing deployed functions..."
echo ""
supabase functions list
echo ""

echo "========================================"
echo "Deployment Complete!"
echo "========================================"
echo ""
echo "Next Steps:"
echo "1. Apply the database migration manually:"
echo "   - Go to Supabase Dashboard > SQL Editor"
echo "   - Copy contents of: supabase/migrations/create_contributors_tracking.sql"
echo "   - Paste and run the SQL"
echo ""
echo "2. Regenerate TypeScript types:"
echo "   supabase gen types typescript --project-id pzctqflzggjqywuafqar > src/integrations/supabase/types.ts"
echo ""
echo "3. Configure Flutterwave webhook:"
echo "   - URL: https://pzctqflzggjqywuafqar.supabase.co/functions/v1/webhook-contribution"
echo "   - Events: charge.completed, transfer.completed"
echo ""
echo "4. Update payment code to include group_id in metadata"
echo ""
echo "See MANUAL_DEPLOYMENT_GUIDE.md for detailed instructions"
echo ""
