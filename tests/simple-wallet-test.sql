-- Simple Wallet Contribution Test
-- Run this to quickly test if wallet contributions work

-- Test 1: Check if function exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'contribute_from_wallet') THEN
    RAISE NOTICE '✅ contribute_from_wallet function exists';
  ELSE
    RAISE EXCEPTION '❌ contribute_from_wallet function missing - run migration first!';
  END IF;
END $$;

-- Test 2: Check if tables exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recurring_contributions') THEN
    RAISE NOTICE '✅ recurring_contributions table exists';
  ELSE
    RAISE EXCEPTION '❌ recurring_contributions table missing - run migration first!';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scheduled_contributions') THEN
    RAISE NOTICE '✅ scheduled_contributions table exists';
  ELSE
    RAISE EXCEPTION '❌ scheduled_contributions table missing - run migration first!';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'group_refund_requests') THEN
    RAISE NOTICE '✅ group_refund_requests table exists';
  ELSE
    RAISE EXCEPTION '❌ group_refund_requests table missing - run migration first!';
  END IF;
END $$;

-- Test 3: Simple contribution test with real user
-- UNCOMMENT AND EDIT THIS TEST TO TRY WITH YOUR DATA
/*
DO $$
DECLARE
  v_user_id UUID := 'paste-your-user-id-here'; -- Get from: SELECT id FROM profiles WHERE email = 'your@email.com';
  v_group_id UUID := 'paste-your-group-id-here'; -- Get from: SELECT id FROM contribution_groups LIMIT 1;
  v_result JSON;
  v_initial_balance NUMERIC;
  v_final_balance NUMERIC;
BEGIN
  -- Get initial balance
  SELECT wallet_balance INTO v_initial_balance 
  FROM profiles WHERE id = v_user_id;
  
  RAISE NOTICE 'Initial balance: %', COALESCE(v_initial_balance, 0);
  
  -- Try to contribute 100
  SELECT contribute_from_wallet(v_user_id, v_group_id, 100, false) INTO v_result;
  
  RAISE NOTICE 'Result: %', v_result;
  
  -- Get final balance
  SELECT wallet_balance INTO v_final_balance 
  FROM profiles WHERE id = v_user_id;
  
  RAISE NOTICE 'Final balance: %', COALESCE(v_final_balance, 0);
  
  IF (v_result->>'success')::boolean = true THEN
    RAISE NOTICE '✅ Contribution succeeded!';
  ELSE
    RAISE NOTICE '❌ Contribution failed: %', v_result->>'error';
  END IF;
END $$;
*/

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════╗';
  RAISE NOTICE '║   Simple Wallet Test Completed         ║';
  RAISE NOTICE '╚════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE 'If all tests passed, your wallet system is working!';
  RAISE NOTICE '';
  RAISE NOTICE 'To test with real data:';
  RAISE NOTICE '1. Get your user ID: SELECT id FROM profiles WHERE email = ''your@email.com'';';
  RAISE NOTICE '2. Get a group ID: SELECT id FROM contribution_groups LIMIT 1;';
  RAISE NOTICE '3. Uncomment Test 3 above (remove /* and */)';
  RAISE NOTICE '4. Replace the UUID placeholders with your actual IDs';
  RAISE NOTICE '5. Run the test again';
  RAISE NOTICE '';
END $$;
