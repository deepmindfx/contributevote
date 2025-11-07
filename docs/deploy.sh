#!/bin/bash

# ContributeVote Edge Functions Deployment Script
echo "🚀 Deploying ContributeVote Edge Functions to Supabase..."

PROJECT_REF="qnkezzhrhbosekxhfqzo"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Login to Supabase (if not already logged in)
echo "🔐 Checking Supabase authentication..."
supabase projects list > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Please login to Supabase:"
    supabase login
fi

# Deploy Edge Functions
echo "📦 Deploying Edge Functions..."

echo "1/3 Deploying flutterwave-virtual-account..."
supabase functions deploy flutterwave-virtual-account --project-ref $PROJECT_REF

echo "2/3 Deploying flutterwave-transactions..."
supabase functions deploy flutterwave-transactions --project-ref $PROJECT_REF

echo "3/3 Deploying flutterwave-invoice..."
supabase functions deploy flutterwave-invoice --project-ref $PROJECT_REF

echo "✅ All Edge Functions deployed successfully!"
echo ""
echo "🔧 Next steps:"
echo "1. Set environment variables in Supabase Dashboard"
echo "2. Test virtual account creation in your app"
echo "3. Verify no CORS errors"
echo ""
echo "🎉 Your ContributeVote app is now fully migrated to Supabase!"