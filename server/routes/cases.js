/**
 * LawHelper Attorney App - Cases Routes
 * Handles case management with proper JSON responses
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/connection-sqlite');
const { asyncHandler, handleValidationErrors } = require('../middleware/errorHandler');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Get all cases for the authenticated user
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const { status, priority, caseType, search, page = 1, limit = 20 } = req.query;
  
  let queryStr = `
    SELECT 
      c.id, c.case_number, c.title, c.description, c.case_type, c.status, c.priority,
      c.court_name, c.judge_name, c.opposing_counsel, c.filing_date, c.trial_date,
      c.estimated_value, c.billing_method, c.hourly_rate,
      cl.first_name as client_first_name, cl.last_name as client_last_name,
      cl.email as client_email, cl.phone as client_phone,
      COUNT(*) OVER() as total_count,
      c.created_at, c.updated_at
    FROM cases c
    LEFT JOIN clients cl ON c.client_id = cl.id
    WHERE c.user_id = $1
  `;
  
  const params = [req.user.userId];
  let paramIndex = 2;
  
  // Add filters
  if (status) {
    queryStr += ` AND c.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }
  
  if (priority) {
    queryStr += ` AND c.priority = $${paramIndex}`;
    params.push(priority);
    paramIndex++;
  }
  
  if (caseType) {
    queryStr += ` AND c.case_type = $${paramIndex}`;
    params.push(caseType);
    paramIndex++;
  }
  
  if (search) {
    queryStr += ` AND (c.title ILIKE $${paramIndex} OR c.description ILIKE $${paramIndex} OR cl.first_name ILIKE $${paramIndex} OR cl.last_name ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }
  
  queryStr += ` ORDER BY c.created_at DESC`;
  
  // Add pagination
  const offset = (page - 1) * limit;
  queryStr += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);
  
  const result = await query(queryStr, params);
  
  res.json({
    success: true,
    data: {
      cases: result.rows.map(row => ({
        id: row.id,
        caseNumber: row.case_number,
        title: row.title,
        description: row.description,
        caseType: row.case_type,
        status: row.status,
        priority: row.priority,
        courtName: row.court_name,
        judgeName: row.judge_name,
        opposingCounsel: row.opposing_counsel,
        filingDate: row.filing_date,
        trialDate: row.trial_date,
        estimatedValue: row.estimated_value,
        billingMethod: row.billing_method,
        hourlyRate: row.hourly_rate,
        client: {
          firstName: row.client_first_name,
          lastName: row.client_last_name,
          email: row.client_email,
          phone: row.client_phone
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0,
        pages: Math.ceil((result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0) / limit)
      }
    }
  });
}));

// Get single case
router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const result = await query(`
    SELECT 
      c.id, c.case_number, c.title, c.description, c.case_type, c.status, c.priority,
      c.court_name, c.judge_name, c.opposing_counsel, c.filing_date, c.trial_date,
      c.statute_limitations, c.estimated_value, c.contingency_fee, c.billing_method, c.hourly_rate,
      cl.id as client_id, cl.first_name as client_first_name, cl.last_name as client_last_name,
      cl.email as client_email, cl.phone as client_phone, cl.address as client_address,
      c.created_at, c.updated_at
    FROM cases c
    LEFT JOIN clients cl ON c.client_id = cl.id
    WHERE c.id = $1 AND c.user_id = $2
  `, [id, req.user.userId]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Case not found'
    });
  }
  
  const row = result.rows[0];
  
  res.json({
    success: true,
    data: {
      case: {
        id: row.id,
        caseNumber: row.case_number,
        title: row.title,
        description: row.description,
        caseType: row.case_type,
        status: row.status,
        priority: row.priority,
        courtName: row.court_name,
        judgeName: row.judge_name,
        opposingCounsel: row.opposing_counsel,
        filingDate: row.filing_date,
        trialDate: row.trial_date,
        statuteLimitations: row.statute_limitations,
        estimatedValue: row.estimated_value,
        contingencyFee: row.contingency_fee,
        billingMethod: row.billing_method,
        hourlyRate: row.hourly_rate,
        client: {
          id: row.client_id,
          firstName: row.client_first_name,
          lastName: row.client_last_name,
          email: row.client_email,
          phone: row.client_phone,
          address: row.client_address
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    }
  });
}));

// Create new case
router.post('/', authenticateToken, [
  body('title').trim().isLength({ min: 1 }).withMessage('Case title is required'),
  body('description').optional().trim(),
  body('caseType').optional().trim(),
  body('clientId').optional().isInt().withMessage('Client ID must be a number'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high'),
  body('courtName').optional().trim(),
  body('judgeName').optional().trim(),
  body('opposingCounsel').optional().trim(),
  body('filingDate').optional().isISO8601().withMessage('Filing date must be a valid date'),
  body('trialDate').optional().isISO8601().withMessage('Trial date must be a valid date'),
  body('estimatedValue').optional().isFloat({ min: 0 }).withMessage('Estimated value must be a positive number'),
  body('billingMethod').optional().isIn(['hourly', 'flat', 'contingency']).withMessage('Billing method must be hourly, flat, or contingency'),
  body('hourlyRate').optional().isFloat({ min: 0 }).withMessage('Hourly rate must be a positive number')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const {
    title, description, caseType, clientId, priority, courtName, judgeName,
    opposingCounsel, filingDate, trialDate, estimatedValue, billingMethod, hourlyRate
  } = req.body;
  
  // Generate case number
  const caseNumber = `CASE-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  
  const result = await query(`
    INSERT INTO cases (
      user_id, case_number, title, description, case_type, client_id, priority,
      court_name, judge_name, opposing_counsel, filing_date, trial_date,
      estimated_value, billing_method, hourly_rate
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *
  `, [
    req.user.userId, caseNumber, title, description, caseType, clientId, priority,
    courtName, judgeName, opposingCounsel, filingDate, trialDate,
    estimatedValue, billingMethod, hourlyRate
  ]);
  
  const newCase = result.rows[0];
  
  res.status(201).json({
    success: true,
    message: 'Case created successfully',
    data: {
      case: {
        id: newCase.id,
        caseNumber: newCase.case_number,
        title: newCase.title,
        description: newCase.description,
        caseType: newCase.case_type,
        status: newCase.status,
        priority: newCase.priority,
        courtName: newCase.court_name,
        judgeName: newCase.judge_name,
        opposingCounsel: newCase.opposing_counsel,
        filingDate: newCase.filing_date,
        trialDate: newCase.trial_date,
        estimatedValue: newCase.estimated_value,
        billingMethod: newCase.billing_method,
        hourlyRate: newCase.hourly_rate,
        createdAt: newCase.created_at,
        updatedAt: newCase.updated_at
      }
    }
  });
}));

// Update case
router.put('/:id', authenticateToken, [
  body('title').optional().trim().isLength({ min: 1 }).withMessage('Case title cannot be empty'),
  body('description').optional().trim(),
  body('caseType').optional().trim(),
  body('status').optional().isIn(['open', 'closed', 'pending', 'settled']).withMessage('Status must be open, closed, pending, or settled'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high'),
  body('courtName').optional().trim(),
  body('judgeName').optional().trim(),
  body('opposingCounsel').optional().trim(),
  body('filingDate').optional().isISO8601().withMessage('Filing date must be a valid date'),
  body('trialDate').optional().isISO8601().withMessage('Trial date must be a valid date'),
  body('estimatedValue').optional().isFloat({ min: 0 }).withMessage('Estimated value must be a positive number'),
  body('billingMethod').optional().isIn(['hourly', 'flat', 'contingency']).withMessage('Billing method must be hourly, flat, or contingency'),
  body('hourlyRate').optional().isFloat({ min: 0 }).withMessage('Hourly rate must be a positive number')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    title, description, caseType, status, priority, courtName, judgeName,
    opposingCounsel, filingDate, trialDate, estimatedValue, billingMethod, hourlyRate
  } = req.body;
  
  // Check if case exists and belongs to user
  const existingCase = await query('SELECT id FROM cases WHERE id = $1 AND user_id = $2', [id, req.user.userId]);
  if (existingCase.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Case not found'
    });
  }
  
  const result = await query(`
    UPDATE cases 
    SET 
      title = COALESCE($1, title),
      description = COALESCE($2, description),
      case_type = COALESCE($3, case_type),
      status = COALESCE($4, status),
      priority = COALESCE($5, priority),
      court_name = COALESCE($6, court_name),
      judge_name = COALESCE($7, judge_name),
      opposing_counsel = COALESCE($8, opposing_counsel),
      filing_date = COALESCE($9, filing_date),
      trial_date = COALESCE($10, trial_date),
      estimated_value = COALESCE($11, estimated_value),
      billing_method = COALESCE($12, billing_method),
      hourly_rate = COALESCE($13, hourly_rate),
      updated_at = NOW()
    WHERE id = $14 AND user_id = $15
    RETURNING *
  `, [
    title, description, caseType, status, priority, courtName, judgeName,
    opposingCounsel, filingDate, trialDate, estimatedValue, billingMethod, hourlyRate,
    id, req.user.userId
  ]);
  
  const updatedCase = result.rows[0];
  
  res.json({
    success: true,
    message: 'Case updated successfully',
    data: {
      case: {
        id: updatedCase.id,
        caseNumber: updatedCase.case_number,
        title: updatedCase.title,
        description: updatedCase.description,
        caseType: updatedCase.case_type,
        status: updatedCase.status,
        priority: updatedCase.priority,
        courtName: updatedCase.court_name,
        judgeName: updatedCase.judge_name,
        opposingCounsel: updatedCase.opposing_counsel,
        filingDate: updatedCase.filing_date,
        trialDate: updatedCase.trial_date,
        estimatedValue: updatedCase.estimated_value,
        billingMethod: updatedCase.billing_method,
        hourlyRate: updatedCase.hourly_rate,
        createdAt: updatedCase.created_at,
        updatedAt: updatedCase.updated_at
      }
    }
  });
}));

// Delete case
router.delete('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const result = await query('DELETE FROM cases WHERE id = $1 AND user_id = $2 RETURNING id', [id, req.user.userId]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Case not found'
    });
  }
  
  res.json({
    success: true,
    message: 'Case deleted successfully'
  });
}));

module.exports = router;