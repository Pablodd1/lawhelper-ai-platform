/**
 * LawHelper Attorney App - Documents Routes
 * Handles document management with file upload and AI analysis
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/connection-sqlite');
const { asyncHandler, handleValidationErrors } = require('../middleware/errorHandler');
const { authenticateToken } = require('./auth');
const fileUploadService = require('../services/fileUploadService');
const aiService = require('../services/aiService');

const router = express.Router();

// Get all documents for the authenticated user
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const { caseId, clientId, category, search, page = 1, limit = 20 } = req.query;
  
  let queryStr = `
    SELECT 
      d.id, d.file_name, d.original_name, d.file_path, d.file_size, d.mime_type,
      d.category, d.description, d.tags, d.is_confidential, d.uploaded_at,
      c.title as case_title, cl.first_name as client_first_name, cl.last_name as client_last_name
    FROM documents d
    LEFT JOIN cases c ON d.case_id = c.id
    LEFT JOIN clients cl ON d.client_id = cl.id
    WHERE d.user_id = ?
  `;
  
  const params = [req.user.userId];
  
  // Add filters
  if (caseId) {
    queryStr += ` AND d.case_id = ?`;
    params.push(caseId);
  }
  
  if (clientId) {
    queryStr += ` AND d.client_id = ?`;
    params.push(clientId);
  }
  
  if (category) {
    queryStr += ` AND d.category = ?`;
    params.push(category);
  }
  
  if (search) {
    queryStr += ` AND (d.file_name LIKE ? OR d.description LIKE ?)`;
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam);
  }
  
  queryStr += ` ORDER BY d.uploaded_at DESC`;
  
  // Add pagination
  const offset = (page - 1) * limit;
  queryStr += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  const result = await query(queryStr, params);
  
  res.json({
    success: true,
    data: {
      documents: result.rows.map(row => ({
        id: row.id,
        fileName: row.file_name,
        originalName: row.original_name,
        filePath: row.file_path,
        fileSize: row.file_size,
        mimeType: row.mime_type,
        category: row.category,
        description: row.description,
        tags: row.tags,
        isConfidential: row.is_confidential,
        uploadedAt: row.uploaded_at,
        case: row.case_title ? { title: row.case_title } : null,
        client: row.client_first_name ? { 
          firstName: row.client_first_name, 
          lastName: row.client_last_name 
        } : null
      }))
    }
  });
}));

// Get single document
router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const result = await query(`
    SELECT 
      d.id, d.file_name, d.original_name, d.file_path, d.file_size, d.mime_type,
      d.category, d.description, d.tags, d.is_confidential, d.uploaded_at,
      c.title as case_title, cl.first_name as client_first_name, cl.last_name as client_last_name
    FROM documents d
    LEFT JOIN cases c ON d.case_id = c.id
    LEFT JOIN clients cl ON d.client_id = cl.id
    WHERE d.id = ? AND d.user_id = ?
  `, [id, req.user.userId]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Document not found'
    });
  }
  
  const row = result.rows[0];
  
  res.json({
    success: true,
    data: {
      document: {
        id: row.id,
        fileName: row.file_name,
        originalName: row.original_name,
        filePath: row.file_path,
        fileSize: row.file_size,
        mimeType: row.mime_type,
        category: row.category,
        description: row.description,
        tags: row.tags,
        isConfidential: row.is_confidential,
        uploadedAt: row.uploaded_at,
        case: row.case_title ? { title: row.case_title } : null,
        client: row.client_first_name ? { 
          firstName: row.client_first_name, 
          lastName: row.client_last_name 
        } : null
      }
    }
  });
}));

// Get single document
router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const result = await query(`
    SELECT 
      d.id, d.file_name, d.original_name, d.file_path, d.file_size, d.mime_type,
      d.category, d.description, d.tags, d.is_confidential, d.uploaded_at,
      c.title as case_title, cl.first_name as client_first_name, cl.last_name as client_last_name
    FROM documents d
    LEFT JOIN cases c ON d.case_id = c.id
    LEFT JOIN clients cl ON d.client_id = cl.id
    WHERE d.id = ? AND d.user_id = ?
  `, [id, req.user.userId]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Document not found'
    });
  }
  
  const row = result.rows[0];
  
  res.json({
    success: true,
    data: {
      document: {
        id: row.id,
        fileName: row.file_name,
        originalName: row.original_name,
        filePath: row.file_path,
        fileSize: row.file_size,
        mimeType: row.mime_type,
        category: row.category,
        description: row.description,
        tags: row.tags,
        isConfidential: row.is_confidential,
        uploadedAt: row.uploaded_at,
        case: row.case_title ? { title: row.case_title } : null,
        client: row.client_first_name ? { 
          firstName: row.client_first_name, 
          lastName: row.client_last_name 
        } : null
      }
    }
  });
}));

// Upload document with file handling
router.post('/upload', authenticateToken, asyncHandler(async (req, res) => {
  try {
    // Validate upload request
    const validation = fileUploadService.validateUploadRequest(req);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }

    // Handle file upload
    const uploadResult = await fileUploadService.uploadSingle(req, res, 'file');
    
    if (!uploadResult.success) {
      return res.status(400).json({
        success: false,
        error: uploadResult.error,
        code: uploadResult.code
      });
    }

    const { file } = uploadResult;
    const {
      caseId, clientId, category, description, tags, isConfidential
    } = req.body;

    // Save document record to database
    const result = await query(`
      INSERT INTO documents (
        user_id, case_id, client_id, file_name, original_name, file_path, file_size,
        mime_type, category, description, tags, is_confidential
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      req.user.userId, caseId, clientId, file.fileName, file.originalName, file.filePath, file.fileSize,
      file.mimeType, category, description, tags, isConfidential || false
    ]);

    // Get the created document
    const newDocument = await query(`
      SELECT 
        d.id, d.file_name, d.original_name, d.file_path, d.file_size, d.mime_type,
        d.category, d.description, d.tags, d.is_confidential, d.uploaded_at
      FROM documents d
      WHERE d.id = ?
    `, [result.lastID]);

    const row = newDocument.rows[0];

    // Trigger AI analysis if configured
    let aiAnalysis = null;
    if (aiService.isAvailable() && file.mimeType === 'application/pdf') {
      try {
        aiAnalysis = await aiService.analyzeDocument(file.filePath, file.originalName);
      } catch (error) {
        console.warn('⚠️  AI analysis failed:', error.message);
        // Continue without AI analysis
      }
    }

    res.status(201).json({
      success: true,
      message: 'Document uploaded and processed successfully',
      data: {
        document: {
          id: row.id,
          fileName: row.file_name,
          originalName: row.original_name,
          filePath: row.file_path,
          fileSize: row.file_size,
          mimeType: row.mime_type,
          category: row.category,
          description: row.description,
          tags: row.tags,
          isConfidential: row.is_confidential,
          uploadedAt: row.uploaded_at
        },
        aiAnalysis: aiAnalysis?.analysis || null,
        aiMetadata: aiAnalysis?.metadata || null
      }
    });

  } catch (error) {
    console.error('❌ Document upload failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Document upload failed',
      message: error.message
    });
  }
}));

// Upload multiple documents
router.post('/upload-multiple', authenticateToken, asyncHandler(async (req, res) => {
  try {
    // Validate upload request
    const validation = fileUploadService.validateUploadRequest(req);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }

    // Handle multiple file uploads
    const uploadResult = await fileUploadService.uploadMultiple(req, res, 'files', 5);
    
    if (!uploadResult.success) {
      return res.status(400).json({
        success: false,
        error: uploadResult.error,
        code: uploadResult.code
      });
    }

    const {
      caseId, clientId, category, description, tags, isConfidential
    } = req.body;

    const uploadedDocuments = [];

    // Process each file
    for (const file of uploadResult.files) {
      const result = await query(`
        INSERT INTO documents (
          user_id, case_id, client_id, file_name, original_name, file_path, file_size,
          mime_type, category, description, tags, is_confidential
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        req.user.userId, caseId, clientId, file.fileName, file.originalName, file.filePath, file.fileSize,
        file.mimeType, category, description, tags, isConfidential || false
      ]);

      const newDocument = await query(`
        SELECT 
          d.id, d.file_name, d.original_name, d.file_path, d.file_size, d.mime_type,
          d.category, d.description, d.tags, d.is_confidential, d.uploaded_at
        FROM documents d
        WHERE d.id = ?
      `, [result.lastID]);

      uploadedDocuments.push(newDocument.rows[0]);
    }

    res.status(201).json({
      success: true,
      message: `${uploadResult.count} documents uploaded successfully`,
      data: {
        documents: uploadedDocuments.map(row => ({
          id: row.id,
          fileName: row.file_name,
          originalName: row.original_name,
          filePath: row.file_path,
          fileSize: row.file_size,
          mimeType: row.mime_type,
          category: row.category,
          description: row.description,
          tags: row.tags,
          isConfidential: row.is_confidential,
          uploadedAt: row.uploaded_at
        })),
        count: uploadedDocuments.length
      }
    });

  } catch (error) {
    console.error('❌ Multiple document upload failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Document upload failed',
      message: error.message
    });
  }
}));

// Update document
router.put('/:id', authenticateToken, [
  body('category').optional().trim(),
  body('description').optional().trim(),
  body('isConfidential').optional().isBoolean().withMessage('Confidential flag must be boolean')
], handleValidationErrors, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { category, description, isConfidential } = req.body;
  
  // Check if document exists and belongs to user
  const existingDoc = await query('SELECT id FROM documents WHERE id = ? AND user_id = ?', [id, req.user.userId]);
  if (existingDoc.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Document not found'
    });
  }
  
  await query(`
    UPDATE documents 
    SET 
      category = COALESCE(?, category),
      description = COALESCE(?, description),
      is_confidential = COALESCE(?, is_confidential)
    WHERE id = ? AND user_id = ?
  `, [category, description, isConfidential, id, req.user.userId]);
  
  const updatedDocument = await query(`
    SELECT 
      d.id, d.file_name, d.original_name, d.file_path, d.file_size, d.mime_type,
      d.category, d.description, d.tags, d.is_confidential, d.uploaded_at
    FROM documents d
    WHERE d.id = ? AND d.user_id = ?
  `, [id, req.user.userId]);
  
  const row = updatedDocument.rows[0];
  
  res.json({
    success: true,
    message: 'Document updated successfully',
    data: {
      document: {
        id: row.id,
        fileName: row.file_name,
        originalName: row.original_name,
        filePath: row.file_path,
        fileSize: row.file_size,
        mimeType: row.mime_type,
        category: row.category,
        description: row.description,
        tags: row.tags,
        isConfidential: row.is_confidential,
        uploadedAt: row.uploaded_at
      }
    }
  });
}));

// Delete document
router.delete('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const result = await query('DELETE FROM documents WHERE id = ? AND user_id = ?', [id, req.user.userId]);
  
  if (result.changes === 0) {
    return res.status(404).json({
      success: false,
      error: 'Document not found'
    });
  }
  
  res.json({
    success: true,
    message: 'Document deleted successfully'
  });
}));

module.exports = router;