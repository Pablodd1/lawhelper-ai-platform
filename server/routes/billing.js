/**
 * LawHelper Attorney App - Billing Routes
 * Handles billing and invoicing with proper JSON responses
 */

const express = require('express');
const { query } = require('../database/connection-sqlite');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Get billing overview
router.get('/overview', authenticateToken, asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  // Get total billable hours and amounts
  const timeResult = await query(`
    SELECT 
      COUNT(*) as total_entries,
      SUM(hours) as total_hours,
      SUM(total_amount) as total_amount
    FROM time_entries 
    WHERE user_id = ? AND billable = 1
    ${startDate ? 'AND date >= ?' : ''}
    ${endDate ? 'AND date <= ?' : ''}
  `, [req.user.userId, startDate, endDate].filter(Boolean));
  
  // Get invoice summary
  const invoiceResult = await query(`
    SELECT 
      status,
      COUNT(*) as count,
      SUM(total_amount) as total_amount
    FROM invoices 
    WHERE user_id = ?
    GROUP BY status
  `, [req.user.userId]);
  
  res.json({
    success: true,
    data: {
      timeEntries: {
        totalEntries: timeResult.rows[0].total_entries || 0,
        totalHours: timeResult.rows[0].total_hours || 0,
        totalAmount: timeResult.rows[0].total_amount || 0
      },
      invoices: invoiceResult.rows.map(row => ({
        status: row.status,
        count: row.count,
        totalAmount: row.total_amount
      }))
    }
  });
}));

// Get all invoices
router.get('/invoices', authenticateToken, asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  
  let queryStr = `
    SELECT 
      i.id, i.invoice_number, i.amount, i.tax_amount, i.total_amount, i.status,
      i.due_date, i.paid_date, i.notes, i.created_at, i.updated_at,
      c.title as case_title, cl.first_name as client_first_name, cl.last_name as client_last_name
    FROM invoices i
    LEFT JOIN cases c ON i.case_id = c.id
    LEFT JOIN clients cl ON i.client_id = cl.id
    WHERE i.user_id = ?
  `;
  
  const params = [req.user.userId];
  
  if (status) {
    queryStr += ` AND i.status = ?`;
    params.push(status);
  }
  
  queryStr += ` ORDER BY i.created_at DESC`;
  
  const offset = (page - 1) * limit;
  queryStr += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  const result = await query(queryStr, params);
  
  res.json({
    success: true,
    data: {
      invoices: result.rows.map(row => ({
        id: row.id,
        invoiceNumber: row.invoice_number,
        amount: row.amount,
        taxAmount: row.tax_amount,
        totalAmount: row.total_amount,
        status: row.status,
        dueDate: row.due_date,
        paidDate: row.paid_date,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        case: row.case_title ? { title: row.case_title } : null,
        client: row.client_first_name ? { 
          firstName: row.client_first_name, 
          lastName: row.client_last_name 
        } : null
      }))
    }
  });
}));

// Get time entries
router.get('/time-entries', authenticateToken, asyncHandler(async (req, res) => {
  const { caseId, billable, startDate, endDate, page = 1, limit = 20 } = req.query;
  
  let queryStr = `
    SELECT 
      te.id, te.description, te.hours, te.hourly_rate, te.total_amount, te.billable, te.date,
      te.start_time, te.end_time, te.created_at,
      c.title as case_title, c.case_number
    FROM time_entries te
    LEFT JOIN cases c ON te.case_id = c.id
    WHERE te.user_id = ?
  `;
  
  const params = [req.user.userId];
  
  if (caseId) {
    queryStr += ` AND te.case_id = ?`;
    params.push(caseId);
  }
  
  if (billable !== undefined) {
    queryStr += ` AND te.billable = ?`;
    params.push(billable === 'true' ? 1 : 0);
  }
  
  if (startDate) {
    queryStr += ` AND te.date >= ?`;
    params.push(startDate);
  }
  
  if (endDate) {
    queryStr += ` AND te.date <= ?`;
    params.push(endDate);
  }
  
  queryStr += ` ORDER BY te.date DESC`;
  
  const offset = (page - 1) * limit;
  queryStr += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  const result = await query(queryStr, params);
  
  res.json({
    success: true,
    data: {
      timeEntries: result.rows.map(row => ({
        id: row.id,
        description: row.description,
        hours: row.hours,
        hourlyRate: row.hourly_rate,
        totalAmount: row.total_amount,
        billable: row.billable,
        date: row.date,
        startTime: row.start_time,
        endTime: row.end_time,
        createdAt: row.created_at,
        case: row.case_title ? { 
          title: row.case_title, 
          caseNumber: row.case_number 
        } : null
      }))
    }
  });
}));

module.exports = router;