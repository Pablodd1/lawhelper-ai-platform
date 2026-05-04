/**
 * LawHelper Attorney App - Database Connection
 * Handles DATABASE_URL configuration and connection pooling
 */

const { Pool } = require('pg');

// Validate DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  console.error('📋 Please set DATABASE_URL in your .env file');
  console.error('📎 Example: DATABASE_URL=postgresql://username:password@localhost:5432/lawhelper');
  process.exit(1);
}

// Parse DATABASE_URL
const parseDatabaseUrl = (url) => {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 5432,
      database: parsed.pathname.slice(1),
      user: parsed.username,
      password: parsed.password,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
  } catch (error) {
    console.error('❌ Invalid DATABASE_URL format:', error.message);
    throw error;
  }
};

// Create connection pool
const poolConfig = {
  ...parseDatabaseUrl(process.env.DATABASE_URL),
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
  acquireTimeoutMillis: 20000, // Return an error after 20 seconds if a connection could not be acquired
  allowExitOnIdle: true
};

console.log('📄 Database configuration:', {
  host: poolConfig.host,
  port: poolConfig.port,
  database: poolConfig.database,
  user: poolConfig.user,
  ssl: poolConfig.ssl ? 'enabled' : 'disabled'
});

const pool = new Pool(poolConfig);

// Handle pool errors
pool.on('error', (err, client) => {
  console.error('🚨 Unexpected error on idle client', err);
  console.error('📊 Client info:', client ? 'active' : 'idle');
});

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as postgres_version');
    client.release();
    
    console.log('✅ Database connection successful');
    console.log('🕒 Current time:', result.rows[0].current_time);
    console.log('📞 PostgreSQL version:', result.rows[0].postgres_version.split(' ')[0]);
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

// Health check function
const dbHealthCheck = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('🚨 Database health check failed:', error.message);
    return false;
  }
};

// Query helper with error handling
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Query executed', { text, duration: `${duration}ms`, rows: res.rowCount });
    }
    
    return res;
  } catch (error) {
    console.error('🚨 Query failed:', error.message);
    console.error('📄 Query:', text);
    console.error('🗈️ Parameters:', params);
    throw error;
  }
};

// Transaction helper
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Initialize database with schema
const initializeDatabase = async () => {
  try {
    console.log('📝 Initializing database schema...');
    
    // Create tables
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        bar_number VARCHAR(50),
        firm_name VARCHAR(255),
        role VARCHAR(50) DEFAULT 'attorney',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(20),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(50),
        zip_code VARCHAR(10),
        date_of_birth DATE,
        ssn VARCHAR(11),
        emergency_contact_name VARCHAR(200),
        emergency_contact_phone VARCHAR(20),
        notes TEXT,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS cases (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        case_number VARCHAR(100) UNIQUE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        case_type VARCHAR(100),
        status VARCHAR(50) DEFAULT 'open',
        priority VARCHAR(20) DEFAULT 'medium',
        court_name VARCHAR(255),
        judge_name VARCHAR(255),
        opposing_counsel VARCHAR(255),
        filing_date DATE,
        trial_date DATE,
        statute_limitations DATE,
        estimated_value DECIMAL(12,2),
        contingency_fee DECIMAL(5,2),
        billing_method VARCHAR(50) DEFAULT 'hourly',
        hourly_rate DECIMAL(10,2),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500),
        file_size INTEGER,
        mime_type VARCHAR(100),
        category VARCHAR(100),
        description TEXT,
        tags TEXT[],
        is_confidential BOOLEAN DEFAULT false,
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        appointment_type VARCHAR(100),
        start_time TIMESTAMP WITH TIME ZONE NOT NULL,
        end_time TIMESTAMP WITH TIME ZONE NOT NULL,
        location VARCHAR(255),
        is_all_day BOOLEAN DEFAULT false,
        status VARCHAR(50) DEFAULT 'scheduled',
        reminder_minutes INTEGER DEFAULT 30,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS time_entries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        hours DECIMAL(5,2) NOT NULL,
        hourly_rate DECIMAL(10,2),
        total_amount DECIMAL(12,2),
        billable BOOLEAN DEFAULT true,
        date DATE NOT NULL,
        start_time TIME,
        end_time TIME,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        invoice_number VARCHAR(100) UNIQUE NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        tax_amount DECIMAL(12,2) DEFAULT 0,
        total_amount DECIMAL(12,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'draft',
        due_date DATE,
        paid_date DATE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    console.log('✅ Database schema initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  }
};

// Initialize connection
const initializeConnection = async () => {
  try {
    const isConnected = await testConnection();
    if (isConnected) {
      await initializeDatabase();
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Failed to initialize database connection:', error.message);
    return false;
  }
};

module.exports = {
  pool,
  query,
  transaction,
  testConnection,
  dbHealthCheck,
  initializeDatabase,
  initializeConnection
};