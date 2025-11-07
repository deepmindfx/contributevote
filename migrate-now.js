// Simple migration script to run directly
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qnkezzhrhbosekxhfqzo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFua2V6emhyaGJvc2VreGhmcXpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0MzczNzEsImV4cCI6MjA3ODAxMzM3MX0.uuqw82a1m2THtHEvyZ4YYY8uDq9a8FCS-FzCq48BuxI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('🔗 Testing Supabase connection...');
  
  try {
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    
    if (error) {
      console.error('❌ Connection failed:', error.message);
      return false;
    }
    
    console.log('✅ Supabase connection successful!');
    return true;
  } catch (err) {
    console.error('❌ Connection error:', err.message);
    return false;
  }
}

async function migrateUsers() {
  console.log('👥 Migrating users...');
  
  // Get users from localStorage (you'll need to copy this data)
  const users = [
    // Add your localStorage users here
    // Example:
    // {
    //   id: 'user-1',
    //   name: 'Test User',
    //   email: 'test@example.com',
    //   walletBalance: 1000
    // }
  ];
  
  for (const user of users) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          name: user.name,
          email: user.email,
          wallet_balance: user.walletBalance || 0,
          role: user.role || 'user',
          status: user.status || 'active'
        });
      
      if (error) {
        console.error(`❌ Failed to migrate user ${user.email}:`, error.message);
      } else {
        console.log(`✅ Migrated user: ${user.email}`);
      }
    } catch (err) {
      console.error(`❌ Error migrating user ${user.email}:`, err.message);
    }
  }
}

async function runMigration() {
  console.log('🚀 Starting Direct Migration...');
  
  const connected = await testConnection();
  if (!connected) {
    console.log('❌ Cannot proceed without Supabase connection');
    return;
  }
  
  await migrateUsers();
  
  console.log('🎉 Migration completed!');
  console.log('📋 Next steps:');
  console.log('   1. Set VITE_USE_SUPABASE=true in .env');
  console.log('   2. Add Flutterwave secrets to Supabase dashboard');
  console.log('   3. Test your application');
}

// Run the migration
runMigration().catch(console.error);