/**
 * LawHelper Attorney App - Calendar Routes
 * Handles calendar and appointment management with proper JSON responses
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/connection-sqlite');
const { asyncHandler, handleValidationErrors } = require('../middleware/errorHandler');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Get all appointments for the authenticated user
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const { startDate, endDate, status, page = 1, limit = 20 } = req.query;
  
  let queryStr = `
    SELECT 
      a.id, a.title, a.description, a.appointment_type, a.start_time, a.end_time,
      a.location, a.is_all_day, a.status, a.reminder_minutes,
      c.title as case_title, cl.first_name as client_first_name, cl.last_name as client_last_name,
      a.created_at, a.updated_at
    FROM appointments a
    LEFT JOIN cases c ON a.case_id = c.id
    LEFT JOIN clients cl ON a.client_id = cl.id
    WHERE a.user_id = ?
  `;
  
  const params = [req.user.userId];
  
  // Add date range filter
  if (startDate) {
    queryStr += ` AND a.start_time >= ?`;
    params.push(startDate);
  }
  
  if (endDate) {
    queryStr += ` AND a.end_time <= ?`;
    params.push(endDate);
  }
  
  if (status) {
    queryStr += ` AND a.status = ?`;
    params.push(status);
  }
  
  queryStr += ` ORDER BY a.start_time ASC`;
  
  // Add pagination
  const offset = (page - 1) * limit;
  queryStr += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  const result = await query(queryStr, params);
  
  res.json({
    success: true,
    data: {
      appointments: result.rows.map(row => ({
        id: row.id,
        title: row.title,
        description: row.description,
        appointmentType: row.appointment_type,
        startTime: row.start_time,
        endTime: row.end_time,
        location: row.location,
        isAllDay: row.is_all_day,
        status: row.status,
        reminderMinutes: row.reminder_minutes,
        case: row.case_title ? { title: row.case_title } : null,
        client: row.client_first_name ? { 
          firstName: row.client_first_name, 
          lastName: row.client_last_name 
        } : null,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    }
  });
}));

// Get single appointment
router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const result = await query(`
    SELECT 
      a.id, a.title, a.description, a.appointment_type, a.start_time, a.end_time,
      a.location, a.is_all_day, a.status, a.reminder_minutes,
      c.title as case_title, cl.first_name as client_first_name, cl.last_name as client_last_name,
      a.created_at, a.updated_at
    FROM appointments a
    LEFT JOIN cases c ON a.case_id = c.id
    LEFT JOIN clients cl ON a.client_id = cl.id
    WHERE a.id = ? AND a.user_id = ?
  `, [id, req.user.userId]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Appointment not found'
    });
  }
  
  const row = result.rows[0];
  
  res.json({
    success: true,
    data: {
      appointment: {
        id: row.id,
        title: row.title,
        description: row.description,
        appointmentType: row.appointment_type,
        startTime: row.start_time,
        endTime: row.end_time,
        location: row.location,
        isAllDay: row.is_all_day,
        status: row.status,
        reminderMinutes: row.reminder_minutes,
        case: row.case_title ? { title: row.case_title } : null,
        client: row.client_first_name ? { 
          firstName: row.client_first_name, 
          lastName: row.client_last_name 
        } : null,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    }
  });
}));

// Create new appointment
router.post('/', authenticateToken, [
  body('title').trim().isLength({ min: 1 }).withMessage('Appointment title is required'),
  body('description').optional().trim(),
  body('appointmentType').optional().trim(),
  body('startTime').isISO8601().withMessage('Start time must be a valid date'),
  body('endTime').isISO8601().withMessage('End time must be a valid date'),
  body('location').optional().trim(),
  body('isAllDay').optional().isBoolean().withMessage('All day flag must be boolean'),
  body('caseId').optional().isInt().withMessage('Case ID must be a number'),
  body('clientId').optional().isInt().withMessage('Client ID must be a number'),
  body('reminderMinutes').optional().isInt({ min: 0 }).withMessage('Reminder minutes must be a positive number')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const {
    title, description, appointmentType, startTime, endTime, location, isAllDay,
    caseId, clientId, reminderMinutes
  } = req.body;
  
  const result = await query(`
    INSERT INTO appointments (
      user_id, title, description, appointment_type, start_time, end_time,
      location, is_all_day, case_id, client_id, reminder_minutes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    req.user.userId, title, description, appointmentType, startTime, endTime,
    location, isAllDay || false, caseId, clientId, reminderMinutes || 30
  ]);
  
  const newAppointment = await query(`
    SELECT 
      a.id, a.title, a.description, a.appointment_type, a.start_time, a.end_time,
      a.location, a.is_all_day, a.status, a.reminder_minutes,
      a.created_at, a.updated_at
    FROM appointments a
    WHERE a.id = ?
  `, [result.lastID]);
  
  const row = newAppointment.rows[0];
  
  res.status(201).json({
    success: true,
    message: 'Appointment created successfully',
    data: {
      appointment: {
        id: row.id,
        title: row.title,
        description: row.description,
        appointmentType: row.appointment_type,
        startTime: row.start_time,
        endTime: row.end_time,
        location: row.location,
        isAllDay: row.is_all_day,
        status: row.status,
        reminderMinutes: row.reminder_minutes,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    }
  });
}));

// Update appointment
router.put('/:id', authenticateToken, [
  body('title').optional().trim().isLength({ min: 1 }),
  body('description').optional().trim(),
  body('appointmentType').optional().trim(),
  body('startTime').optional().isISO8601().withMessage('Start time must be a valid date'),
  body('endTime').optional().isISO8601().withMessage('End time must be a valid date'),
  body('location').optional().trim(),
  body('isAllDay').optional().isBoolean().withMessage('All day flag must be boolean'),
  body('status').optional().isIn(['scheduled', 'completed', 'cancelled']).withMessage('Status must be scheduled, completed, or cancelled'),
  body('reminderMinutes').optional().isInt({ min: 0 }).withMessage('Reminder minutes must be a positive number')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    title, description, appointmentType, startTime, endTime, location, isAllDay, status, reminderMinutes
  } = req.body;
  
  // Check if appointment exists and belongs to user
  const existingAppointment = await query('SELECT id FROM appointments WHERE id = ? AND user_id = ?', [id, req.user.userId]);
  if (existingAppointment.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Appointment not found'
    });
  }
  
  await query(`
    UPDATE appointments 
    SET 
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      appointment_type = COALESCE(?, appointment_type),
      start_time = COALESCE(?, start_time),
      end_time = COALESCE(?, end_time),
      location = COALESCE(?, location),
      is_all_day = COALESCE(?, is_all_day),
      status = COALESCE(?, status),
      reminder_minutes = COALESCE(?, reminder_minutes),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `, [
    title, description, appointmentType, startTime, endTime, location, isAllDay, status, reminderMinutes,
    id, req.user.userId
  ]);
  
  const updatedAppointment = await query(`
    SELECT 
      a.id, a.title, a.description, a.appointment_type, a.start_time, a.end_time,
      a.location, a.is_all_day, a.status, a.reminder_minutes,
      a.created_at, a.updated_at
    FROM appointments a
    WHERE a.id = ? AND a.user_id = ?
  `, [id, req.user.userId]);
  
  const row = updatedAppointment.rows[0];
  
  res.json({
    success: true,
    message: 'Appointment updated successfully',
    data: {
      appointment: {
        id: row.id,
        title: row.title,
        description: row.description,
        appointmentType: row.appointment_type,
        startTime: row.start_time,
        endTime: row.end_time,
        location: row.location,
        isAllDay: row.is_all_day,
        status: row.status,
        reminderMinutes: row.reminder_minutes,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    }
  });
}));

// Delete appointment
router.delete('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const result = await query('DELETE FROM appointments WHERE id = ? AND user_id = ?', [id, req.user.userId]);
  
  if (result.changes === 0) {
    return res.status(404).json({
      success: false,
      error: 'Appointment not found'
    });
  }
  
  res.json({
    success: true,
    message: 'Appointment deleted successfully'
  });
}));

module.exports = router;