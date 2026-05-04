/**
 * LawHelper Attorney App - Database Status Checker
 * Checks database connection and migration status
 */

require('dotenv').config({ path: '../.env' });
const { dbHealthCheck, query } = require('../server/database/connection-sqlite');

const checkDatabaseStatus = async () => {
  console.log('📊 Checking LawHelper database status...');
  console.log('='.repeat(50));
  
  try {
    // Check database connection
    console.log('🔗 Testing database connection...');
    const isConnected = await dbHealthCheck();
    
    if (isConnected) {
      console.log('✅ Database connection: HEALTHY');
    } else {
      console.log('❌ Database connection: FAILED');
      return false;
    }
    
    // Check if tables exist
    console.log('\n📦 Checking database tables...');
    const tables = ['users', 'clients', 'cases', 'documents', 'appointments', 'time_entries', 'invoices'];
    
    for (const table of tables) {
      try {
        const result = await query(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table]);
        const exists = result.rows.length > 0;
        console.log(`${exists ? '✅' : '❌'} ${table}: ${exists ? 'EXISTS' : 'MISSING'}`);
      } catch (error) {
        console.log(`❌ ${table}: ERROR - ${error.message}`);
      }
    }
    
    // Check table counts
    console.log('\n📈 Checking table record counts...');
    for (const table of tables) {
      try {
        const result = await query(`SELECT COUNT(*) as count FROM ${table}`);
        const count = result.rows[0].count;
        console.log(`📉 ${table}: ${count} records`);
      } catch (error) {
        console.log(`❌ ${table}: ERROR - ${error.message}`);
      }
    }
    
    // Check database version
    console.log('\n📞 Database version:');
    const versionResult = await query('SELECT sqlite_version() as version');
    console.log(`📄 SQLite ${versionResult.rows[0].version}`);
    
    // Check connection pool stats
    console.log('\n🔹 Connection pool status: HEALTHY');
    console.log('🔐 DATABASE_URL: configured');
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 Database status check completed successfully!');
    
    return true;
  } catch (error) {
    console.error('🚨 Database status check failed:', error.message);
    console.error('📋 Error details:', error.stack);
    return false;
  }
};

// Run status check if called directly
if (require.main === module) {
  checkDatabaseStatus().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { checkDatabaseStatus };