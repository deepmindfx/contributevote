-- Add 'contribution' and 'refund' to allowed transaction types

-- Drop the old constraint
ALTER TABLE transactions DROP CONSTRAINT transactions_type_check;

-- Add new constraint with additional types
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check 
CHECK (type = ANY (ARRAY[
  'deposit'::text, 
  'withdrawal'::text, 
  'transfer'::text, 
  'payment'::text, 
  'vote'::text,
  'contribution'::text,  -- Added for wallet contributions
  'refund'::text         -- Added for group refunds
]));

-- Add comment
COMMENT ON CONSTRAINT transactions_type_check ON transactions IS 
  'Allowed transaction types: deposit, withdrawal, transfer, payment, vote, contribution, refund';
