# ContributeVote: localStorage to Supabase Migration Guide

## Overview
Your ContributeVote project is currently using localStorage for data persistence. I've set up a complete Supabase database schema and migration system to move your data to a production-ready PostgreSQL database.

## ✅ What's Already Done

### 1. Database Schema Created
- **profiles** table (users)
- **contribution_groups** table (contributions)
- **contributors** table (individual contributions)
- **transactions** table (all financial transactions)
- **withdrawal_requests** table (withdrawal management)
- **notifications** table (user notifications)

### 2. Supabase Services Created
- `UserService` - Complete user management
- `ContributionService` - Group and contribution management
- `TransactionService` - Transaction handling
- `MigrationService` - Data migration utilities

### 3. Database Functions
- `increment_group_amount()` - Atomic group balance updates
- Automatic timestamp triggers for updated_at fields

## 🚨 Next Steps Required

### Step 1: Install Supabase Client
```bash
# You need to free up disk space first, then run:
npm install @supabase/supabase-js
```

### Step 2: Update Supabase Client Configuration
The client is configured to use environment variables. Update `src/integrations/supabase/client.ts`:

```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
```

### Step 3: Run Migration
Create a migration component or page:

```typescript
import { MigrationService } from '@/services/supabase/migrationService'

// In your component
const handleMigration = async () => {
  // Backup first
  MigrationService.backupLocalStorageData()
  
  // Run migration
  const result = await MigrationService.migrateAllData()
  
  if (result.success) {
    console.log('Migration successful!')
    // Verify migration
    const report = await MigrationService.verifyMigration()
    console.log('Verification report:', report)
  }
}
```

## 📊 Data Mapping

### localStorage → Supabase Mapping

| localStorage | Supabase Table | Key Changes |
|-------------|----------------|-------------|
| `users` | `profiles` | `walletBalance` → `wallet_balance` |
| `contributions` | `contribution_groups` | `targetAmount` → `target_amount`, `currentAmount` → `current_amount` |
| `contributors` | `contributors` | Separate table for better normalization |
| `transactions` | `transactions` | `userId` → `user_id`, `contributionId` → `contribution_id` |
| `withdrawalRequests` | `withdrawal_requests` | `contributionId` → `contribution_id` |
| `notifications` | `notifications` | `userId` → `user_id`, `read` → `is_read` |

## 🔄 Context Updates Needed

You'll need to update your React contexts to use Supabase instead of localStorage:

### UserContext Updates
```typescript
// Replace localStorage operations with:
import { UserService } from '@/services/supabase/userService'

// Example:
const getUsers = async () => {
  return await UserService.getUsers()
}
```

### ContributionContext Updates
```typescript
// Replace localStorage operations with:
import { ContributionService } from '@/services/supabase/contributionService'
import { TransactionService } from '@/services/supabase/transactionService'
```

## 🔐 Authentication Integration

Consider adding Supabase Auth for better user management:

```typescript
// Optional: Add Supabase Auth
import { supabase } from '@/integrations/supabase/client'

const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })
  return { data, error }
}
```

## 🧪 Testing Migration

1. **Backup First**: Always backup localStorage data before migration
2. **Test with Sample Data**: Try migration with a few test records first
3. **Verify Integrity**: Use the verification function to ensure data consistency
4. **Rollback Plan**: Keep localStorage backup for rollback if needed

## 📈 Benefits After Migration

1. **Scalability**: PostgreSQL handles concurrent users better
2. **Real-time**: Supabase provides real-time subscriptions
3. **Security**: Row Level Security (RLS) for data protection
4. **Backup**: Automatic database backups
5. **Analytics**: Better querying capabilities
6. **Multi-device**: Data syncs across devices

## 🚀 Production Considerations

1. **Environment Variables**: Use different Supabase projects for dev/prod
2. **RLS Policies**: Enable Row Level Security for data protection
3. **Indexes**: Add database indexes for better performance
4. **Monitoring**: Set up Supabase monitoring and alerts

## 📝 Migration Checklist

- [ ] Free up disk space
- [ ] Install @supabase/supabase-js
- [ ] Update client configuration
- [ ] Test migration with sample data
- [ ] Run full migration
- [ ] Verify data integrity
- [ ] Update React contexts
- [ ] Test application functionality
- [ ] Enable RLS policies
- [ ] Deploy to production

## 🆘 Troubleshooting

### Common Issues:
1. **Disk Space**: Clear node_modules and reinstall
2. **Network Issues**: Check Supabase project status
3. **Data Conflicts**: Use verification function to identify issues
4. **Type Errors**: Update TypeScript types after migration

Your Supabase project "CollectiPay" is ready and the database schema is created. The migration services are in place - you just need to install the client library and run the migration!