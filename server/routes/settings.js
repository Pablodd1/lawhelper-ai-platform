/**
 * LawHelper Attorney App - Settings Routes
 * Handles user settings with proper JSON responses
 */

const express = require('express');
const { query } = require('../database/connection-sqlite');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Get user settings
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  // For now, return user profile as settings
  const result = await query(`
    SELECT id, email, first_name, last_name, bar_number, firm_name, phone, role, created_at, updated_at
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
      settings: {
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
        },
        preferences: {
          theme: 'light',
          notifications: true,
          emailNotifications: true,
          defaultBillingMethod: 'hourly',
          defaultHourlyRate: 300,
          currency: 'USD',
          timezone: 'America/New_York'
        }
      }
    }
  });
}));

// Update settings
router.put('/', authenticateToken, asyncHandler(async (req, res) => {
  const { theme, notifications, emailNotifications, defaultBillingMethod, defaultHourlyRate, currency, timezone } = req.body;
  
  // For now, just return success (in a real app, you'd save these to a settings table)
  res.json({
    success: true,
    message: 'Settings updated successfully',
    data: {
      settings: {
        preferences: {
          theme: theme || 'light',
          notifications: notifications !== undefined ? notifications : true,
          emailNotifications: emailNotifications !== undefined ? emailNotifications : true,
          defaultBillingMethod: defaultBillingMethod || 'hourly',
          defaultHourlyRate: defaultHourlyRate || 300,
          currency: currency || 'USD',
          timezone: timezone || 'America/New_York'
        }
      }
    }
  });
}));

module.exports = router;