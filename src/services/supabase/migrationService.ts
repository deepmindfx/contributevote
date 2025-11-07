import { UserService } from './userService'
import { ContributionService } from './contributionService'
import { TransactionService } from './transactionService'
import { getBaseUsers, getBaseContributions, getBaseTransactions } from '../localStorage/storageUtils'
import { User, Contribution, Transaction } from '../localStorage/types'

export class MigrationService {
  // Migrate all localStorage data to Supabase
  static async migrateAllData() {
    console.log('Starting migration from localStorage to Supabase...')
    
    try {
      // Step 1: Migrate users
      await this.migrateUsers()
      
      // Step 2: Migrate contributions
      await this.migrateContributions()
      
      // Step 3: Migrate transactions
      await this.migrateTransactions()
      
      console.log('Migration completed successfully!')
      return { success: true, message: 'All data migrated successfully' }
    } catch (error) {
      console.error('Migration failed:', error)
      return { success: false, error: error.message }
    }
  }

  // Migrate users from localStorage to Supabase
  static async migrateUsers() {
    console.log('Migrating users...')
    const localUsers = getBaseUsers()
    
    for (const user of localUsers) {
      try {
        // Check if user already exists
        const existingUser = await UserService.getUserByEmail(user.email)
        
        if (!existingUser) {
          await UserService.createUser({
            id: user.id,
            email: user.email,
            name: user.name,
            phone: user.phone || user.phoneNumber,
            wallet_balance: user.walletBalance || 0,
            preferences: user.preferences || {},
            role: user.role || 'user',
            status: user.status || 'active'
          })
          console.log(`Migrated user: ${user.email}`)
        } else {
          console.log(`User already exists: ${user.email}`)
        }
      } catch (error) {
        console.error(`Failed to migrate user ${user.email}:`, error)
      }
    }
  }

  // Migrate contributions from localStorage to Supabase
  static async migrateContributions() {
    console.log('Migrating contributions...')
    const localContributions = getBaseContributions()
    
    for (const contribution of localContributions) {
      try {
        // Check if contribution already exists
        const existingContribution = await ContributionService.getContributionGroupById(contribution.id)
        
        if (!existingContribution) {
          // Create the contribution group
          const newGroup = await ContributionService.createContributionGroup({
            id: contribution.id,
            name: contribution.name,
            description: contribution.description,
            target_amount: contribution.targetAmount,
            current_amount: contribution.currentAmount || 0,
            category: contribution.category,
            frequency: contribution.frequency,
            contribution_amount: contribution.contributionAmount,
            start_date: contribution.startDate,
            end_date: contribution.endDate,
            creator_id: contribution.creatorId,
            privacy: contribution.privacy || contribution.visibility || 'public',
            status: contribution.status || 'active',
            voting_threshold: contribution.votingThreshold || 1,
            account_number: contribution.accountNumber,
            account_name: contribution.accountName,
            bank_name: contribution.bankName,
            account_reference: contribution.accountReference,
            account_details: contribution.accountDetails || {}
          })

          // Migrate contributors
          if (contribution.contributors && contribution.contributors.length > 0) {
            for (const contributor of contribution.contributors) {
              try {
                await ContributionService.addContributor({
                  group_id: newGroup.id,
                  user_id: contributor.userId || null,
                  amount: contributor.amount,
                  anonymous: contributor.anonymous || false,
                  date: contributor.date || new Date().toISOString()
                })
              } catch (error) {
                console.error(`Failed to migrate contributor for ${contribution.name}:`, error)
              }
            }
          }

          console.log(`Migrated contribution: ${contribution.name}`)
        } else {
          console.log(`Contribution already exists: ${contribution.name}`)
        }
      } catch (error) {
        console.error(`Failed to migrate contribution ${contribution.name}:`, error)
      }
    }
  }

  // Migrate transactions from localStorage to Supabase
  static async migrateTransactions() {
    console.log('Migrating transactions...')
    const localTransactions = getBaseTransactions()
    
    for (const transaction of localTransactions) {
      try {
        // Check if transaction already exists by reference
        let existingTransaction = null
        if (transaction.reference) {
          existingTransaction = await TransactionService.getTransactionByReference(transaction.reference)
        }
        
        if (!existingTransaction) {
          await TransactionService.createTransaction({
            id: transaction.id,
            user_id: transaction.userId,
            contribution_id: transaction.contributionId || null,
            type: transaction.type,
            amount: transaction.amount,
            description: transaction.description || transaction.narration,
            status: transaction.status || 'completed',
            reference_id: transaction.reference,
            payment_method: transaction.paymentMethod,
            anonymous: transaction.anonymous || false,
            metadata: transaction.metadata || transaction.metaData || {}
          })
          console.log(`Migrated transaction: ${transaction.id}`)
        } else {
          console.log(`Transaction already exists: ${transaction.id}`)
        }
      } catch (error) {
        console.error(`Failed to migrate transaction ${transaction.id}:`, error)
      }
    }
  }

  // Backup localStorage data before migration
  static backupLocalStorageData() {
    const backup = {
      users: getBaseUsers(),
      contributions: getBaseContributions(),
      transactions: getBaseTransactions(),
      timestamp: new Date().toISOString()
    }
    
    // Save backup to localStorage with timestamp
    localStorage.setItem(`backup_${Date.now()}`, JSON.stringify(backup))
    console.log('LocalStorage data backed up successfully')
    
    return backup
  }

  // Verify migration integrity
  static async verifyMigration() {
    console.log('Verifying migration integrity...')
    
    const localUsers = getBaseUsers()
    const localContributions = getBaseContributions()
    const localTransactions = getBaseTransactions()
    
    const supabaseUsers = await UserService.getUsers()
    const supabaseContributions = await ContributionService.getContributionGroups()
    const supabaseTransactions = await TransactionService.getTransactions()
    
    const report = {
      users: {
        local: localUsers.length,
        supabase: supabaseUsers.length,
        migrated: supabaseUsers.filter(u => localUsers.some(lu => lu.id === u.id)).length
      },
      contributions: {
        local: localContributions.length,
        supabase: supabaseContributions.length,
        migrated: supabaseContributions.filter(c => localContributions.some(lc => lc.id === c.id)).length
      },
      transactions: {
        local: localTransactions.length,
        supabase: supabaseTransactions.length,
        migrated: supabaseTransactions.filter(t => localTransactions.some(lt => lt.id === t.id)).length
      }
    }
    
    console.log('Migration verification report:', report)
    return report
  }
}