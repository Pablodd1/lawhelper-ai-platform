/**
 * LawHelper Attorney App - SQLite Database Connection (Development)
 * Alternative database connection using SQLite for development without PostgreSQL
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure database directory exists
const dbDir = path.join(__dirname, '../../database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'lawhelper.db');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening SQLite database:', err.message);
  } else {
    console.log('✅ Connected to SQLite database:', dbPath);
  }
});

// Promisify database operations
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        console.error('🚨 SQLite run error:', err.message);
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        console.error('🚨 SQLite get error:', err.message);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('🚨 SQLite all error:', err.message);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

// Health check function
const dbHealthCheck = async () => {
  try {
    await get('SELECT 1');
    return true;
  } catch (error) {
    console.error('🚨 SQLite health check failed:', error.message);
    return false;
  }
};

// Query helper (PostgreSQL-compatible interface)
const query = async (text, params = []) => {
  try {
    const start = Date.now();
    
    // Convert PostgreSQL-style queries to SQLite
    let sqliteText = text;
    
    // Replace PostgreSQL-specific syntax
    sqliteText = sqliteText.replace(/NOW\(\)/g, "datetime('now')");
    sqliteText = sqliteText.replace(/\$\d+/g, '?'); // Replace $1, $2 with ?
    sqliteText = sqliteText.replace(/SERIAL/g, 'INTEGER PRIMARY KEY AUTOINCREMENT');
    sqliteText = sqliteText.replace(/::\w+/g, ''); // Remove type casts
    sqliteText = sqliteText.replace(/TEXT\[\]/g, 'TEXT'); // Replace array types
    
    // Handle different query types
    const upperText = text.toUpperCase();
    
    if (upperText.includes('INSERT') && upperText.includes('RETURNING')) {
      // Handle INSERT with RETURNING
      await run(sqliteText.replace(/RETURNING \*/g, ''), params);
      const lastId = await get('SELECT last_insert_rowid() as id');
      return { rows: [{ id: lastId.id }], rowCount: 1 };
    } else if (upperText.includes('UPDATE') && upperText.includes('RETURNING')) {
      // Handle UPDATE with RETURNING (simplified)
      await run(sqliteText.replace(/RETURNING \*/g, ''), params);
      return { rows: [], rowCount: 1 };
    } else if (upperText.includes('SELECT')) {
      // Handle SELECT queries
      const rows = await all(sqliteText, params);
      return { rows, rowCount: rows.length };
    } else {
      // Handle other queries
      const result = await run(sqliteText, params);
      return { rows: [], rowCount: result.changes };
    }
  } catch (error) {
    console.error('🚨 Query failed:', error.message);
    console.error('📄 Query:', text);
    console.error('🗘️ Parameters:', params);
    throw error;
  }
};

// Initialize database schema
const initializeDatabase = async () => {
  console.log('📝 Initializing SQLite database schema...');
  
  try {
    // Create users table
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT,
        bar_number TEXT,
        firm_name TEXT,
        role TEXT DEFAULT 'attorney',
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create clients table
    await run(`
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        zip_code TEXT,
        date_of_birth DATE,
        ssn TEXT,
        emergency_contact_name TEXT,
        emergency_contact_phone TEXT,
        notes TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create cases table
    await run(`
      CREATE TABLE IF NOT EXISTS cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        case_number TEXT UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        case_type TEXT,
        status TEXT DEFAULT 'open',
        priority TEXT DEFAULT 'medium',
        court_name TEXT,
        judge_name TEXT,
        opposing_counsel TEXT,
        filing_date DATE,
        trial_date DATE,
        statute_limitations DATE,
        estimated_value REAL,
        contingency_fee REAL,
        billing_method TEXT DEFAULT 'hourly',
        hourly_rate REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create documents table
    await run(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_path TEXT,
        file_size INTEGER,
        mime_type TEXT,
        category TEXT,
        description TEXT,
        tags TEXT,
        is_confidential BOOLEAN DEFAULT 0,
        ai_analysis TEXT,
        ai_analyzed_at DATETIME,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add AI columns if they don't exist (for existing databases)
    try {
      await run(`ALTER TABLE documents ADD COLUMN ai_analysis TEXT`);
      console.log('✅ Added ai_analysis column to documents table');
    } catch (error) {
      if (!error.message.includes('duplicate column name')) {
        console.log('ℹ️  ai_analysis column already exists or other error:', error.message);
      }
    }

    try {
      await run(`ALTER TABLE documents ADD COLUMN ai_analyzed_at DATETIME`);
      console.log('✅ Added ai_analyzed_at column to documents table');
    } catch (error) {
      if (!error.message.includes('duplicate column name')) {
        console.log('ℹ️  ai_analyzed_at column already exists or other error:', error.message);
      }
    }

    // Create appointments table
    await run(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        appointment_type TEXT,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        location TEXT,
        is_all_day BOOLEAN DEFAULT 0,
        status TEXT DEFAULT 'scheduled',
        reminder_minutes INTEGER DEFAULT 30,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create time_entries table
    await run(`
      CREATE TABLE IF NOT EXISTS time_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        hours REAL NOT NULL,
        hourly_rate REAL,
        total_amount REAL,
        billable BOOLEAN DEFAULT 1,
        date DATE NOT NULL,
        start_time TIME,
        end_time TIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create invoices table
    await run(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        invoice_number TEXT UNIQUE NOT NULL,
        amount REAL NOT NULL,
        tax_amount REAL DEFAULT 0,
        total_amount REAL NOT NULL,
        status TEXT DEFAULT 'draft',
        due_date DATE,
        paid_date DATE,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ SQLite database schema initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ SQLite database initialization failed:', error.message);
    throw error;
  }
};

// Test connection
const testConnection = async () => {
  try {
    await get('SELECT 1');
    console.log('✅ SQLite connection successful');
    return true;
  } catch (error) {
    console.error('❌ SQLite connection failed:', error.message);
    return false;
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
    console.error('❌ Failed to initialize SQLite connection:', error.message);
    return false;
  }
};

module.exports = {
  db,
  query,
  get,
  all,
  run,
  dbHealthCheck,
  testConnection,
  initializeDatabase,
  initializeConnection
};