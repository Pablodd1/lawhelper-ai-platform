/**
 * LawHelper Attorney App - Search Routes
 * Handles search functionality with proper JSON responses
 */

const express = require('express');
const { query } = require('../database/connection-sqlite');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Global search across all entities
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const { q, type = 'all', limit = 20 } = req.query;
  
  if (!q || q.trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: 'Search query must be at least 2 characters long'
    });
  }
  
  const searchTerm = `%${q}%`;
  const results = {
    clients: [],
    cases: [],
    documents: [],
    appointments: []
  };
  
  // Search clients
  if (type === 'all' || type === 'clients') {
    const clientResult = await query(`
      SELECT 
        c.id, c.first_name, c.last_name, c.email, c.phone, c.status,
        c.created_at
      FROM clients c
      WHERE c.user_id = ? AND (
        c.first_name LIKE ? OR 
        c.last_name LIKE ? OR 
        c.email LIKE ? OR 
        c.phone LIKE ?
      )
      ORDER BY c.created_at DESC
      LIMIT ?
    `, [req.user.userId, searchTerm, searchTerm, searchTerm, searchTerm, limit]);
    
    results.clients = clientResult.rows.map(row => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      status: row.status,
      createdAt: row.created_at,
      type: 'client'
    }));
  }
  
  // Search cases
  if (type === 'all' || type === 'cases') {
    const caseResult = await query(`
      SELECT 
        c.id, c.case_number, c.title, c.case_type, c.status, c.priority,
        c.created_at
      FROM cases c
      WHERE c.user_id = ? AND (
        c.title LIKE ? OR 
        c.description LIKE ? OR 
        c.case_number LIKE ? OR
        c.case_type LIKE ?
      )
      ORDER BY c.created_at DESC
      LIMIT ?
    `, [req.user.userId, searchTerm, searchTerm, searchTerm, searchTerm, limit]);
    
    results.cases = caseResult.rows.map(row => ({
      id: row.id,
      caseNumber: row.case_number,
      title: row.title,
      caseType: row.case_type,
      status: row.status,
      priority: row.priority,
      createdAt: row.created_at,
      type: 'case'
    }));
  }
  
  // Search documents
  if (type === 'all' || type === 'documents') {
    const docResult = await query(`
      SELECT 
        d.id, d.file_name, d.original_name, d.category, d.description,
        d.uploaded_at
      FROM documents d
      WHERE d.user_id = ? AND (
        d.file_name LIKE ? OR 
        d.original_name LIKE ? OR 
        d.description LIKE ? OR
        d.category LIKE ?
      )
      ORDER BY d.uploaded_at DESC
      LIMIT ?
    `, [req.user.userId, searchTerm, searchTerm, searchTerm, searchTerm, limit]);
    
    results.documents = docResult.rows.map(row => ({
      id: row.id,
      fileName: row.file_name,
      originalName: row.original_name,
      category: row.category,
      description: row.description,
      uploadedAt: row.uploaded_at,
      type: 'document'
    }));
  }
  
  // Search appointments
  if (type === 'all' || type === 'appointments') {
    const apptResult = await query(`
      SELECT 
        a.id, a.title, a.description, a.appointment_type, a.start_time, a.location,
        a.status
      FROM appointments a
      WHERE a.user_id = ? AND (
        a.title LIKE ? OR 
        a.description LIKE ? OR 
        a.location LIKE ? OR
        a.appointment_type LIKE ?
      )
      ORDER BY a.start_time DESC
      LIMIT ?
    `, [req.user.userId, searchTerm, searchTerm, searchTerm, searchTerm, limit]);
    
    results.appointments = apptResult.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      appointmentType: row.appointment_type,
      startTime: row.start_time,
      location: row.location,
      status: row.status,
      type: 'appointment'
    }));
  }
  
  // Combine all results and sort by relevance/date
  let allResults = [];
  Object.values(results).forEach(arr => {
    allResults = allResults.concat(arr);
  });
  
  // Sort by created date (newest first)
  allResults.sort((a, b) => new Date(b.createdAt || b.uploadedAt || b.startTime) - new Date(a.createdAt || a.uploadedAt || a.startTime));
  
  res.json({
    success: true,
    data: {
      results: allResults,
      summary: {
        total: allResults.length,
        clients: results.clients.length,
        cases: results.cases.length,
        documents: results.documents.length,
        appointments: results.appointments.length
      },
      query: q,
      type: type
    }
  });
}));

module.exports = router;