/**
 * LawHelper Attorney App - Database Initialization Script
 * Initializes database schema and runs migrations
 */

require('dotenv').config({ path: '../.env' });
const { initializeConnection, initializeDatabase } = require('../server/database/connection-sqlite');

const initDatabase = async () => {
  console.log('📝 Starting LawHelper database initialization...');
  
  try {
    // Test database connection
    console.log('📈 Testing database connection...');
    const isConnected = await initializeConnection();
    
    if (!isConnected) {
      console.error('❌ Database connection failed. Please check your DATABASE_URL configuration.');
      process.exit(1);
    }
    
    console.log('✅ Database connection established successfully');
    
    // Initialize database schema
    console.log('📋 Initializing database schema...');
    await initializeDatabase();
    
    console.log('🎉 Database initialization completed successfully!');
    console.log('🔗 You can now start the application with: npm run dev');
    
    process.exit(0);
  } catch (error) {
    console.error('🚨 Database initialization failed:', error.message);
    console.error('📋 Error details:', error.stack);
    process.exit(1);
  }
};

// Run initialization if called directly
if (require.main === module) {
  initDatabase();
}

module.exports = { initDatabase };