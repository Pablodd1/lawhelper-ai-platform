/**
 * LawHelper Attorney App - Main Server
 * Fixes HTML-instead-of-JSON API failures and ensures proper error handling
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Import routes
const registerRoutes = require('./routes');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { dbHealthCheck } = require('./database/connection-sqlite');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure DATABASE_URL is properly configured
const isProduction = process.env.NODE_ENV === 'production';
const hasDatabase = process.env.DATABASE_URL;

if (!hasDatabase) {
  if (isProduction) {
    console.warn('⚠️  DATABASE_URL not set — running in mock mode (no persistence)');
    process.env.MOCK_MODE = 'true';
  } else {
    console.warn('⚠️  DATABASE_URL environment variable not set');
    console.warn('📋 Running with SQLite fallback for development');
  }
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing middleware
// Update: Skip file logging in production (Vercel serverless)
app.use(morgan(isProduction ? 'dev' : 'combined'));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// CRITICAL FIX: Force JSON responses for all API routes
app.use('/api/*', (req, res, next) => {
  // Set content type to JSON for all API responses
  res.type('application/json');
  
  // Override send method to ensure JSON responses
  const originalSend = res.send;
  res.send = function(data) {
    // If data is a string and not already JSON, try to parse it
    if (typeof data === 'string' && !res.get('Content-Type').includes('application/json')) {
      try {
        // Test if it's valid JSON
        JSON.parse(data);
        res.type('application/json');
      } catch (e) {
        // Not valid JSON, convert to JSON error response
        data = JSON.stringify({ 
          error: data,
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method
        });
        res.type('application/json');
      }
    }
    
    // Ensure consistent JSON structure for errors
    if (data && typeof data === 'object' && data.error && !data.success !== undefined) {
      data.success = false;
      data.timestamp = data.timestamp || new Date().toISOString();
    }
    
    return originalSend.call(this, data);
  };
  
  next();
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    let dbStatus = 'disconnected';
    try {
      const connected = await dbHealthCheck();
      dbStatus = connected ? 'connected' : 'disconnected';
    } catch (e) {
      dbStatus = process.env.MOCK_MODE === 'true' ? 'mock' : 'disconnected';
    }
    res.json({
      success: true,
      message: 'LawHelper Attorney App is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: dbStatus,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Database status endpoint
app.get('/api/db/status', async (req, res) => {
  try {
    const dbStatus = await dbHealthCheck();
    res.json({
      success: true,
      database: 'connected',
      timestamp: new Date().toISOString(),
      connectionString: process.env.DATABASE_URL ? 'configured' : 'missing'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Database connection failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Register all routes
registerRoutes(app);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const frontendBuildPath = path.join(__dirname, '../frontend/build');
  const fs = require('fs');
  
  if (fs.existsSync(frontendBuildPath)) {
    app.use(express.static(frontendBuildPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendBuildPath, 'index.html'));
    });
  } else {
    // No frontend build — serve API landing page as root
    app.get('/', (req, res) => {
      res.json({
        success: true,
        message: 'LawHelper Attorney AI Platform — API Online',
        version: '1.0.0',
        endpoints: {
          health: '/api/health',
          auth: '/api/auth/login',
          register: '/api/auth/register',
          cases: '/api/cases',
          documents: '/api/documents',
          db_status: '/api/db/status'
        },
        environment: process.env.NODE_ENV
      });
    });
  }
}

// Error handling middleware - CRITICAL FIX for HTML errors
app.use(notFound);
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 LawHelper Attorney App running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 Database: ${process.env.DATABASE_URL ? 'configured' : 'missing'}`);
  console.log(`🧪 Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

module.exports = app;