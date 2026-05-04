/**
 * LawHelper Attorney App - Authentication Routes
 * Handles user authentication with proper JSON responses
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/connection-sqlite');
const { asyncHandler, handleValidationErrors } = require('../middleware/errorHandler');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'lawhelper-jwt-secret-key';

// Register new user
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').trim().isLength({ min: 2 }).withMessage('First name is required'),
  body('lastName').trim().isLength({ min: 2 }).withMessage('Last name is required'),
  body('barNumber').optional().trim(),
  body('firmName').optional().trim()
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, barNumber, firmName } = req.body;
  
  // Check if user already exists
  const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existingUser.rows.length > 0) {
    return res.status(409).json({
      success: false,
      error: 'User already exists with this email'
    });
  }
  
  // Hash password
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);
  
  // Create user
  const result = await query(`
    INSERT INTO users (email, password_hash, first_name, last_name, bar_number, firm_name)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, email, first_name, last_name, bar_number, firm_name, role, created_at
  `, [email, passwordHash, firstName, lastName, barNumber, firmName]);
  
  const user = result.rows[0];
  
  // Generate JWT token
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        barNumber: user.bar_number,
        firmName: user.firm_name,
        role: user.role,
        createdAt: user.created_at
      },
      token
    }
  });
}));

// Login user
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists().withMessage('Password is required')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  // Find user
  const result = await query(`
    SELECT id, email, password_hash, first_name, last_name, bar_number, firm_name, role, is_active, created_at
    FROM users 
    WHERE email = $1 AND is_active = true
  `, [email]);
  
  if (result.rows.length === 0) {
    return res.status(401).json({
      success: false,
      error: 'Invalid email or password'
    });
  }
  
  const user = result.rows[0];
  
  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    return res.status(401).json({
      success: false,
      error: 'Invalid email or password'
    });
  }
  
  // Generate JWT token
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        barNumber: user.bar_number,
        firmName: user.firm_name,
        role: user.role,
        createdAt: user.created_at
      },
      token
    }
  });
}));

// Get current user profile
router.get('/profile', authenticateToken, asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT id, email, first_name, last_name, bar_number, firm_name, phone, role, created_at, updated_at
    FROM users 
    WHERE id = $1 AND is_active = true
  `, [req.user.userId]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }
  
  const user = result.rows[0];
  
  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        barNumber: user.bar_number,
        firmName: user.firm_name,
        phone: user.phone,
        role: user.role,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    }
  });
}));

// Update user profile
router.put('/profile', authenticateToken, [
  body('firstName').optional().trim().isLength({ min: 2 }),
  body('lastName').optional().trim().isLength({ min: 2 }),
  body('phone').optional().trim(),
  body('firmName').optional().trim()
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { firstName, lastName, phone, firmName } = req.body;
  
  const result = await query(`
    UPDATE users 
    SET 
      first_name = COALESCE($1, first_name),
      last_name = COALESCE($2, last_name),
      phone = COALESCE($3, phone),
      firm_name = COALESCE($4, firm_name),
      updated_at = NOW()
    WHERE id = $5
    RETURNING id, email, first_name, last_name, bar_number, firm_name, phone, role, created_at, updated_at
  `, [firstName, lastName, phone, firmName, req.user.userId]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }
  
  const user = result.rows[0];
  
  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        barNumber: user.bar_number,
        firmName: user.firm_name,
        phone: user.phone,
        role: user.role,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    }
  });
}));

// Change password
router.put('/password', authenticateToken, [
  body('currentPassword').exists().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  // Get current user with password hash
  const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.userId]);
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }
  
  const user = result.rows[0];
  
  // Verify current password
  const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValidPassword) {
    return res.status(401).json({
      success: false,
      error: 'Current password is incorrect'
    });
  }
  
  // Hash new password
  const saltRounds = 12;
  const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
  
  // Update password
  await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', 
    [newPasswordHash, req.user.userId]);
  
  res.json({
    success: true,
    message: 'Password changed successfully'
  });
}));

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
    
    req.user = user;
    next();
  });
}

module.exports = router;
module.exports.authenticateToken = authenticateToken;