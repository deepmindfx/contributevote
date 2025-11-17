# Wallet vs Group Account Clarification

**Date:** November 17, 2025  
**Status:** DOCUMENTED

---

## Important Distinction

### 1. **User Wallet** 💰
- **Database Field:** `profiles.wallet_balance`
- **Purpose:** Personal funds for each user
- **Usage:** 
  - Receive payments from card/bank transfers to personal account
  - Contribute to groups from wallet
  - Withdraw to bank account
- **Virtual Account:** User can have their own virtual bank account

### 2. **Group Wallet** 🏦
- **Database Field:** `contribution_groups.current_amount`
- **Purpose:** Collective funds for the group
- **Usage:**
  - Accumulates all contributions to the group
  - Used for group expenses/withdrawals
  - Managed by group admin
- **Virtual Account:** Group can have its own virtual bank account

---

## How They Work Together

### User Contributes to Group

**Option 1: From User Wallet**
```
User Wallet (₦10,000)
    ↓ Contribute ₦5,000
User Wallet (₦5,000)
Group Wallet (₦5,000) ✅
```

**Option 2: Direct Payment (Card)**
```
User pays ₦5,000 via card
    ↓
Group Wallet (₦5,000) ✅
User Wallet (unchanged)
```

**Option 3: Bank Transfer to Group Account**
```
User transfers ₦5,000 to group's bank account
    ↓
Group Wallet (₦5,000) ✅
User Wallet (unchanged)
```

---

## Virtual Bank Accounts

### User Virtual Account
- **Purpose:** Receive bank transfers to personal wallet
- **Created:** When user sets up their account
- **Credits:** `profiles.wallet_balance`
- **Example:** User receives salary → User wallet increases

### Group Virtual Account
- **Purpose:** Receive bank transfers to group wallet
- **Created:** 
  - Automatically when group is created
  - Manually by group creator if failed
- **Credits:** `contribution_groups.current_amount`
- **Example:** Member transfers to group → Group wallet increases

---

## Database Schema

### Profiles Table (User)
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  wallet_balance NUMERIC DEFAULT 0,  -- User's personal wallet
  preferences JSONB,  -- Contains virtualAccount details
  ...
);
```

### Contribution Groups Table
```sql
CREATE TABLE contribution_groups (
  id UUID PRIMARY KEY,
  name TEXT,
  current_amount NUMERIC DEFAULT 0,  -- Group's collective wallet
  account_number TEXT,  -- Group's virtual account number
  bank_name TEXT,
  account_name TEXT,
  ...
);
```

---

## Webhook Routing

The webhook correctly routes based on account ownership:

### Bank Transfer Received
```typescript
// 1. Check if account belongs to a GROUP
const group = groups?.find(g => 
  g.account_number === accountNumber
);

if (group) {
  // Credit GROUP wallet
  update contribution_groups 
  set current_amount = current_amount + amount
  where id = group.id;
}

// 2. Check if account belongs to a USER
const user = users?.find(u => 
  u.preferences?.virtualAccount?.accountNumber === accountNumber
);

if (user) {
  // Credit USER wallet
  update profiles 
  set wallet_balance = wallet_balance + amount
  where id = user.id;
}
```

---

## Common Scenarios

### Scenario 1: User Funds Personal Wallet
```
User transfers ₦10,000 to their virtual account
    ↓
Webhook receives notification
    ↓
Finds user by account number
    ↓
Credits user.wallet_balance += ₦10,000 ✅
```

### Scenario 2: Member Contributes to Group
```
Member transfers ₦5,000 to group's virtual account
    ↓
Webhook receives notification
    ↓
Finds group by account number
    ↓
Credits group.current_amount += ₦5,000 ✅
Creates anonymous contributor record
```

### Scenario 3: User Contributes from Wallet
```
User has ₦10,000 in wallet
User contributes ₦5,000 to group
    ↓
user.wallet_balance -= ₦5,000 (now ₦5,000)
group.current_amount += ₦5,000 ✅
Creates contributor record with voting rights
```

---

## Key Points

1. **Separate Balances**
   - User wallet and group wallet are completely separate
   - No automatic transfer between them

2. **Virtual Accounts**
   - Both users and groups can have virtual accounts
   - Each account routes to its respective wallet

3. **Contributions**
   - Can be made from user wallet (deducts from user)
   - Can be made via card (doesn't affect user wallet)
   - Can be made via bank transfer to group account

4. **Voting Rights**
   - Wallet contributions: Automatic voting rights ✅
   - Card payments: Automatic voting rights ✅
   - Bank transfers: Requires admin verification ⚠️

---

## Visual Representation

```
┌─────────────────────────────────────────────────────┐
│                    USER                             │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │  User Wallet: ₦10,000                        │  │
│  │  (profiles.wallet_balance)                   │  │
│  │                                              │  │
│  │  Virtual Account: 8817080779                │  │
│  │  Bank: Sterling Bank                        │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  Actions:                                          │
│  • Receive salary/payments                        │
│  • Contribute to groups                           │
│  • Withdraw to bank                               │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                    GROUP                            │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │  Group Wallet: ₦50,000                       │  │
│  │  (contribution_groups.current_amount)        │  │
│  │                                              │  │
│  │  Virtual Account: 8817955211                │  │
│  │  Bank: Sterling Bank                        │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  Actions:                                          │
│  • Receive contributions                          │
│  • Pay group expenses                             │
│  • Distribute refunds                             │
└─────────────────────────────────────────────────────┘
```

---

## Summary

- **User Wallet** = Personal money
- **Group Wallet** = Collective money
- **Virtual Accounts** = Bank accounts for receiving transfers
- **Completely Separate** = No automatic mixing of funds
- **Webhook Routes Correctly** = Based on account ownership

This separation ensures:
- ✅ Clear fund tracking
- ✅ No accidental mixing of personal/group funds
- ✅ Proper accounting
- ✅ Transparent governance

---

**Status:** DOCUMENTED ✅  
**Importance:** CRITICAL 🔴  
**Understanding:** REQUIRED 📚
