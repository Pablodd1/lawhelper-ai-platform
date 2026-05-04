/**
 * LawHelper Attorney App - Clients Routes
 * Handles client management with proper JSON responses
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/connection-sqlite');
const { asyncHandler, handleValidationErrors } = require('../middleware/errorHandler');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Get all clients for the authenticated user
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query;
  
  let queryStr = `
    SELECT 
      c.id, c.first_name, c.last_name, c.email, c.phone, c.address, c.city, c.state, c.zip_code,
      c.date_of_birth, c.emergency_contact_name, c.emergency_contact_phone, c.notes, c.status,
      COUNT(*) OVER() as total_count,
      c.created_at, c.updated_at
    FROM clients c
    WHERE c.user_id = ?
  `;
  
  const params = [req.user.userId];
  
  // Add filters
  if (status) {
    queryStr += ` AND c.status = ?`;
    params.push(status);
  }
  
  if (search) {
    queryStr += ` AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ?)`;
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam);
  }
  
  queryStr += ` ORDER BY c.created_at DESC`;
  
  // Add pagination
  const offset = (page - 1) * limit;
  queryStr += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  const result = await query(queryStr, params);
  
  res.json({
    success: true,
    data: {
      clients: result.rows.map(row => ({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        address: row.address,
        city: row.city,
        state: row.state,
        zipCode: row.zip_code,
        dateOfBirth: row.date_of_birth,
        emergencyContactName: row.emergency_contact_name,
        emergencyContactPhone: row.emergency_contact_phone,
        notes: row.notes,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.rows.length > 0 ? result.rows[0].total_count : 0,
        pages: Math.ceil((result.rows.length > 0 ? result.rows[0].total_count : 0) / limit)
      }
    }
  });
}));

// Get single client
router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const result = await query(`
    SELECT 
      c.id, c.first_name, c.last_name, c.email, c.phone, c.address, c.city, c.state, c.zip_code,
      c.date_of_birth, c.ssn, c.emergency_contact_name, c.emergency_contact_phone, c.notes, c.status,
      c.created_at, c.updated_at
    FROM clients c
    WHERE c.id = ? AND c.user_id = ?
  `, [id, req.user.userId]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Client not found'
    });
  }
  
  const row = result.rows[0];
  
  res.json({
    success: true,
    data: {
      client: {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        address: row.address,
        city: row.city,
        state: row.state,
        zipCode: row.zip_code,
        dateOfBirth: row.date_of_birth,
        ssn: row.ssn,
        emergencyContactName: row.emergency_contact_name,
        emergencyContactPhone: row.emergency_contact_phone,
        notes: row.notes,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    }
  });
}));

// Create new client
router.post('/', authenticateToken, [
  body('firstName').trim().isLength({ min: 1 }).withMessage('First name is required'),
  body('lastName').trim().isLength({ min: 1 }).withMessage('Last name is required'),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().trim(),
  body('address').optional().trim(),
  body('city').optional().trim(),
  body('state').optional().trim(),
  body('zipCode').optional().trim(),
  body('dateOfBirth').optional().isISO8601().withMessage('Date of birth must be a valid date'),
  body('ssn').optional().trim(),
  body('emergencyContactName').optional().trim(),
  body('emergencyContactPhone').optional().trim(),
  body('notes').optional().trim()
], handleValidationErrors, asyncHandler(async (req, res) => {
  const {
    firstName, lastName, email, phone, address, city, state, zipCode,
    dateOfBirth, ssn, emergencyContactName, emergencyContactPhone, notes
  } = req.body;
  
  const result = await query(`
    INSERT INTO clients (
      user_id, first_name, last_name, email, phone, address, city, state, zip_code,
      date_of_birth, ssn, emergency_contact_name, emergency_contact_phone, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    req.user.userId, firstName, lastName, email, phone, address, city, state, zipCode,
    dateOfBirth, ssn, emergencyContactName, emergencyContactPhone, notes
  ]);
  
  const newClient = await query(`
    SELECT 
      c.id, c.first_name, c.last_name, c.email, c.phone, c.address, c.city, c.state, c.zip_code,
      c.date_of_birth, c.ssn, c.emergency_contact_name, c.emergency_contact_phone, c.notes, c.status,
      c.created_at, c.updated_at
    FROM clients c
    WHERE c.id = ?
  `, [result.lastID]);
  
  const row = newClient.rows[0];
  
  res.status(201).json({
    success: true,
    message: 'Client created successfully',
    data: {
      client: {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        address: row.address,
        city: row.city,
        state: row.state,
        zipCode: row.zip_code,
        dateOfBirth: row.date_of_birth,
        ssn: row.ssn,
        emergencyContactName: row.emergency_contact_name,
        emergencyContactPhone: row.emergency_contact_phone,
        notes: row.notes,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    }
  });
}));

// Update client
router.put('/:id', authenticateToken, [
  body('firstName').optional().trim().isLength({ min: 1 }),
  body('lastName').optional().trim().isLength({ min: 1 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().trim(),
  body('address').optional().trim(),
  body('city').optional().trim(),
  body('state').optional().trim(),
  body('zipCode').optional().trim(),
  body('dateOfBirth').optional().isISO8601().withMessage('Date of birth must be a valid date'),
  body('ssn').optional().trim(),
  body('emergencyContactName').optional().trim(),
  body('emergencyContactPhone').optional().trim(),
  body('notes').optional().trim()
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    firstName, lastName, email, phone, address, city, state, zipCode,
    dateOfBirth, ssn, emergencyContactName, emergencyContactPhone, notes
  } = req.body;
  
  // Check if client exists and belongs to user
  const existingClient = await query('SELECT id FROM clients WHERE id = ? AND user_id = ?', [id, req.user.userId]);
  if (existingClient.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Client not found'
    });
  }
  
  await query(`
    UPDATE clients 
    SET 
      first_name = COALESCE(?, first_name),
      last_name = COALESCE(?, last_name),
      email = COALESCE(?, email),
      phone = COALESCE(?, phone),
      address = COALESCE(?, address),
      city = COALESCE(?, city),
      state = COALESCE(?, state),
      zip_code = COALESCE(?, zip_code),
      date_of_birth = COALESCE(?, date_of_birth),
      ssn = COALESCE(?, ssn),
      emergency_contact_name = COALESCE(?, emergency_contact_name),
      emergency_contact_phone = COALESCE(?, emergency_contact_phone),
      notes = COALESCE(?, notes),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `, [
    firstName, lastName, email, phone, address, city, state, zipCode,
    dateOfBirth, ssn, emergencyContactName, emergencyContactPhone, notes,
    id, req.user.userId
  ]);
  
  const updatedClient = await query(`
    SELECT 
      c.id, c.first_name, c.last_name, c.email, c.phone, c.address, c.city, c.state, c.zip_code,
      c.date_of_birth, c.ssn, c.emergency_contact_name, c.emergency_contact_phone, c.notes, c.status,
      c.created_at, c.updated_at
    FROM clients c
    WHERE c.id = ? AND c.user_id = ?
  `, [id, req.user.userId]);
  
  const row = updatedClient.rows[0];
  
  res.json({
    success: true,
    message: 'Client updated successfully',
    data: {
      client: {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        address: row.address,
        city: row.city,
        state: row.state,
        zipCode: row.zip_code,
        dateOfBirth: row.date_of_birth,
        ssn: row.ssn,
        emergencyContactName: row.emergency_contact_name,
        emergencyContactPhone: row.emergency_contact_phone,
        notes: row.notes,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    }
  });
}));

// Delete client
router.delete('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const result = await query('DELETE FROM clients WHERE id = ? AND user_id = ?', [id, req.user.userId]);
  
  if (result.changes === 0) {
    return res.status(404).json({
      success: false,
      error: 'Client not found'
    });
  }
  
  res.json({
    success: true,
    message: 'Client deleted successfully'
  });
}));

module.exports = router;