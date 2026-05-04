/**
 * LawHelper Attorney App - Users Routes
 * Handles user management with proper JSON responses
 */

const express = require('express');
const { query } = require('../database/connection-sqlite');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Get current user info
router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT id, email, first_name, last_name, bar_number, firm_name, phone, role, is_active, created_at, updated_at
    FROM users 
    WHERE id = ?
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
        isActive: user.is_active,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    }
  });
}));

module.exports = router;