/**
 * LawHelper Attorney App - Error Handling Middleware
 * Ensures all errors return JSON responses instead of HTML
 */

const winston = require('winston');
const path = require('path');

// Configure logger
const logger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(__dirname, '../../logs/error.log') }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// 404 Not Found handler
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.status = 404;
  next(error);
};

// Global error handler - CRITICAL FIX for HTML errors
const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Determine status code
  const statusCode = err.status || err.statusCode || 500;
  
  // Ensure we don't send HTML errors for API routes
  if (req.path.startsWith('/api/')) {
    // Always return JSON for API routes
    res.status(statusCode).json({
      success: false,
      error: {
        message: err.message,
        status: statusCode,
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
        // Include stack trace in development
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      }
    });
  } else {
    // For non-API routes, still prefer JSON if client accepts it
    if (req.accepts('json') && !req.accepts('html')) {
      res.status(statusCode).json({
        success: false,
        error: {
          message: err.message,
          status: statusCode,
          timestamp: new Date().toISOString(),
          path: req.path
        }
      });
    } else {
      // Fallback to HTML for browser requests
      res.status(statusCode).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Error ${statusCode} - LawHelper</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .error-container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .error-title { color: #d32f2f; font-size: 24px; margin-bottom: 15px; }
            .error-message { color: #666; font-size: 16px; margin-bottom: 20px; }
            .error-details { background: #f8f8f8; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 14px; }
            .back-link { margin-top: 20px; }
            .back-link a { color: #1976d2; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1 class="error-title">Error ${statusCode}</h1>
            <p class="error-message">${err.message}</p>
            <div class="error-details">
              <strong>Timestamp:</strong> ${new Date().toISOString()}<br>
              <strong>Path:</strong> ${req.path}<br>
              <strong>Method:</strong> ${req.method}
            </div>
            <div class="back-link">
              <a href="/">← Return to LawHelper Dashboard</a>
            </div>
          </div>
        </body>
        </html>
      `);
    }
  }
};

// Async error wrapper to catch promise rejections
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        details: errors.array(),
        timestamp: new Date().toISOString()
      }
    });
  }
  next();
};

// Database error handler
const handleDatabaseError = (err, req, res, next) => {
  if (err.code) {
    // PostgreSQL error codes
    switch (err.code) {
      case '23505': // Unique violation
        return res.status(409).json({
          success: false,
          error: {
            message: 'Resource already exists',
            field: err.detail,
            timestamp: new Date().toISOString()
          }
        });
      case '23503': // Foreign key violation
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid reference to related resource',
            timestamp: new Date().toISOString()
          }
        });
      case '23502': // Not null violation
        return res.status(400).json({
          success: false,
          error: {
            message: 'Required field is missing',
            field: err.column,
            timestamp: new Date().toISOString()
          }
        });
      default:
        break;
    }
  }
  next(err);
};

module.exports = {
  notFound,
  errorHandler,
  asyncHandler,
  handleValidationErrors,
  handleDatabaseError
};