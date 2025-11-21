#!/bin/bash

# Deploy Transfer Edge Functions to Supabase
# Run this script to deploy all three transfer-related edge functions

echo "🚀 Deploying Transfer Edge Functions to Supabase..."
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

echo "📦 Deploying flutterwave-banks..."
npx supabase functions deploy flutterwave-banks
if [ $? -eq 0 ]; then
    echo "✅ flutterwave-banks deployed successfully"
else
    echo "❌ Failed to deploy flutterwave-banks"
    exit 1
fi

echo ""
echo "📦 Deploying flutterwave-resolve-account..."
npx supabase functions deploy flutterwave-resolve-account
if [ $? -eq 0 ]; then
    echo "✅ flutterwave-resolve-account deployed successfully"
else
    echo "❌ Failed to deploy flutterwave-resolve-account"
    exit 1
fi

echo ""
echo "📦 Deploying flutterwave-transfer..."
npx supabase functions deploy flutterwave-transfer
if [ $? -eq 0 ]; then
    echo "✅ flutterwave-transfer deployed successfully"
else
    echo "❌ Failed to deploy flutterwave-transfer"
    exit 1
fi

echo ""
echo "🎉 All transfer edge functions deployed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Set environment variables in Supabase dashboard:"
echo "   - FLUTTERWAVE_SECRET_KEY"
echo "   - SUPABASE_URL"
echo "   - SUPABASE_ANON_KEY"
echo ""
echo "2. Update your .env file:"
echo "   VITE_USE_SUPABASE=true"
echo ""
echo "3. Test the transfer functionality"
echo ""
