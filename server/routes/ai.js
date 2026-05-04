/**
 * LawHelper Attorney App - AI Routes
 * Handles AI-powered legal assistance and document analysis
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/connection-sqlite');
const { asyncHandler, handleValidationErrors } = require('../middleware/errorHandler');
const { authenticateToken } = require('./auth');
const aiService = require('../services/aiService');
const fileUploadService = require('../services/fileUploadService');

const router = express.Router();

// Analyze a document using AI
router.post('/analyze-document', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { documentId } = req.body;
    
    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: 'Document ID is required'
      });
    }

    // Get document from database
    const documentResult = await query(`
      SELECT file_path, original_name, mime_type
      FROM documents 
      WHERE id = ? AND user_id = ?
    `, [documentId, req.user.userId]);

    if (documentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    const document = documentResult.rows[0];
    
    // Check if AI service is available
    if (!aiService.isAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'AI service is not available. Please configure OpenAI API key.'
      });
    }

    // Check file type support
    if (document.mime_type !== 'application/pdf') {
      return res.status(400).json({
        success: false,
        error: 'AI analysis is currently only supported for PDF documents'
      });
    }

    // Perform AI analysis
    const analysisResult = await aiService.analyzeDocument(document.file_path, document.original_name);

    if (!analysisResult.success) {
      return res.status(500).json({
        success: false,
        error: 'AI analysis failed',
        details: analysisResult.error
      });
    }

    // Save analysis to database
    const analysisJson = JSON.stringify(analysisResult.analysis);
    await query(`
      UPDATE documents 
      SET ai_analysis = ?, ai_analyzed_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `, [analysisJson, documentId, req.user.userId]);

    res.json({
      success: true,
      message: 'Document analyzed successfully',
      data: {
        analysis: analysisResult.analysis,
        metadata: analysisResult.metadata
      }
    });

  } catch (error) {
    console.error('❌ AI document analysis failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'AI document analysis failed',
      message: error.message
    });
  }
}));

// Generate legal document template
router.post('/generate-template', authenticateToken, [
  body('type').trim().isLength({ min: 1 }).withMessage('Template type is required'),
  body('jurisdiction').optional().trim(),
  body('caseType').optional().trim(),
  body('parties').optional().isArray(),
  body('requirements').optional().trim()
], handleValidationErrors, asyncHandler(async (req, res) => {
  try {
    const { type, jurisdiction, caseType, parties, requirements } = req.body;

    // Check if AI service is available
    if (!aiService.isAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'AI service is not available. Please configure OpenAI API key.'
      });
    }

    const templateData = {
      jurisdiction: jurisdiction || 'US',
      caseType: caseType || 'General',
      parties: parties || [],
      requirements: requirements || 'Standard format'
    };

    const result = await aiService.generateDocumentTemplate(type, templateData);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'Template generation failed',
        details: result.error
      });
    }

    // Save template to database
    const templateJson = JSON.stringify({
      type,
      template: result.template,
      metadata: result.metadata
    });

    await query(`
      INSERT INTO documents (user_id, file_name, original_name, mime_type, category, description, file_path, file_size)
      VALUES (?, ?, ?, 'text/plain', 'template', ?, 'generated', 0)
    `, [
      req.user.userId,
      `${type.replace(/\s+/g, '_').toLowerCase()}_template_${Date.now()}.txt`,
      `${type} Template`,
      `AI-generated ${type} template`
    ]);

    res.json({
      success: true,
      message: 'Template generated successfully',
      data: {
        template: result.template,
        metadata: result.metadata
      }
    });

  } catch (error) {
    console.error('❌ Template generation failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Template generation failed',
      message: error.message
    });
  }
}));

// Legal research assistance
router.post('/legal-research', authenticateToken, [
  body('query').trim().isLength({ min: 1 }).withMessage('Research query is required'),
  body('jurisdiction').optional().trim()
], handleValidationErrors, asyncHandler(async (req, res) => {
  try {
    const { query: researchQuery, jurisdiction } = req.body;

    // Check if AI service is available
    if (!aiService.isAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'AI service is not available. Please configure OpenAI API key.'
      });
    }

    const result = await aiService.legalResearch(researchQuery, jurisdiction);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'Legal research failed',
        details: result.error
      });
    }

    // Save research to database for history
    await query(`
      INSERT INTO documents (user_id, file_name, original_name, mime_type, category, description, file_path, file_size)
      VALUES (?, ?, ?, 'text/plain', 'research', ?, 'generated', 0)
    `, [
      req.user.userId,
      `legal_research_${Date.now()}.txt`,
      `Legal Research: ${researchQuery.substring(0, 50)}...`,
      `AI-generated legal research on: ${researchQuery}`
    ]);

    res.json({
      success: true,
      message: 'Legal research completed successfully',
      data: {
        research: result.research,
        metadata: result.metadata
      }
    });

  } catch (error) {
    console.error('❌ Legal research failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Legal research failed',
      message: error.message
    });
    
  }
}));

// Get AI service status
router.get('/status', authenticateToken, (req, res) => {
  try {
    const isAvailable = aiService.isAvailable();
    
    res.json({
      success: true,
      data: {
        available: isAvailable,
        message: isAvailable ? 'AI service is available' : 'AI service is not configured',
        features: [
          'Document Analysis',
          'Template Generation', 
          'Legal Research',
          'Text Extraction'
        ]
      }
    });
  } catch (error) {
    console.error('❌ Failed to get AI status:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve AI service status',
      message: error.message
    });
  }
});

// Get document analysis history
router.get('/analysis-history', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    const result = await query(`
      SELECT 
        d.id, d.original_name, d.ai_analysis, d.ai_analyzed_at,
        d.category, d.mime_type, d.file_size,
        c.title as case_title, cl.first_name as client_first_name, cl.last_name as client_last_name
      FROM documents d
      LEFT JOIN cases c ON d.case_id = c.id
      LEFT JOIN clients cl ON d.client_id = cl.id
      WHERE d.user_id = ? AND d.ai_analysis IS NOT NULL
      ORDER BY d.ai_analyzed_at DESC
      LIMIT ? OFFSET ?
    `, [req.user.userId, limit, offset]);

    const totalResult = await query(`
      SELECT COUNT(*) as total
      FROM documents
      WHERE user_id = ? AND ai_analysis IS NOT NULL
    `, [req.user.userId]);

    const analyses = result.rows.map(row => ({
      documentId: row.id,
      documentName: row.original_name,
      case: row.case_title ? { title: row.case_title } : null,
      client: row.client_first_name ? { 
        firstName: row.client_first_name, 
        lastName: row.client_last_name 
      } : null,
      category: row.category,
      mimeType: row.mime_type,
      fileSize: row.file_size,
      analyzedAt: row.ai_analyzed_at,
      analysis: JSON.parse(row.ai_analysis || '{}')
    }));

    res.json({
      success: true,
      data: {
        analyses,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalResult.rows[0].total,
          pages: Math.ceil(totalResult.rows[0].total / limit)
        }
      }
    });

  } catch (error) {
    console.error('❌ Failed to get analysis history:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analysis history',
      message: error.message
    });
  }
}));

module.exports = router;