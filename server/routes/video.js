/**
 * LawHelper Attorney App - Video Consultation Routes
 * Handles WebRTC video consultations and session management
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/connection-sqlite');
const { asyncHandler, handleValidationErrors } = require('../middleware/errorHandler');
const { authenticateToken } = require('./auth');
const videoService = require('../services/videoService');

const router = express.Router();

// Get all video sessions for the authenticated user
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const userSessions = videoService.getUserSessions(req.user.userId, req.user.role);
    
    res.json({
      success: true,
      data: {
        sessions: userSessions,
        count: userSessions.length
      }
    });
  } catch (error) {
    console.error('❌ Failed to get user sessions:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve video sessions',
      message: error.message
    });
  }
}));

// Create a new video consultation session
router.post('/sessions', authenticateToken, [
  body('caseId').optional().isInt().withMessage('Case ID must be a number'),
  body('clientId').optional().isInt().withMessage('Client ID must be a number'),
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required and must be less than 200 characters'),
  body('scheduledStart').optional().isISO8601().withMessage('Scheduled start must be a valid ISO date'),
  body('attorneyId').optional().isInt().withMessage('Attorney ID must be a number')
], handleValidationErrors, asyncHandler(async (req, res) => {
  try {
    const { caseId, clientId, title, scheduledStart, attorneyId } = req.body;
    
    // Create session data
    const sessionData = {
      caseId,
      clientId,
      attorneyId: attorneyId || req.user.userId,
      title,
      scheduledStart: scheduledStart ? new Date(scheduledStart) : new Date()
    };

    const result = videoService.createSession(sessionData);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    // Save session to database
    const dbResult = await query(`
      INSERT INTO appointments (
        user_id, case_id, client_id, title, description, appointment_type,
        start_time, end_time, location, status
      )
      VALUES (?, ?, ?, ?, ?, 'video_consultation', ?, ?, 'Video Consultation', 'scheduled')
    `, [
      req.user.userId, caseId, clientId, title, 'Video consultation session',
      result.session.scheduledStart,
      new Date(new Date(result.session.scheduledStart).getTime() + 60 * 60 * 1000) // 1 hour duration
    ]);

    res.status(201).json({
      success: true,
      message: 'Video consultation session created successfully',
      data: {
        sessionId: result.sessionId,
        session: result.session,
        joinUrl: result.joinUrl,
        token: result.token,
        appointmentId: dbResult.lastID
      }
    });

  } catch (error) {
    console.error('❌ Failed to create video session:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to create video session',
      message: error.message
    });
  }
}));

// Join a video consultation session
router.post('/sessions/:sessionId/join', authenticateToken, [
  body('name').trim().isLength({ min: 1 }).withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('role').isIn(['attorney', 'client']).withMessage('Role must be attorney or client'),
  body('isHost').optional().isBoolean().withMessage('isHost must be a boolean')
], handleValidationErrors, asyncHandler(async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { name, email, role, isHost } = req.body;
    
    const result = videoService.joinSession(sessionId, {
      name,
      email,
      role,
      isHost: isHost || false
    });
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'Successfully joined video consultation session',
      data: {
        participant: result.participant,
        session: result.session,
        webrtcConfig: result.webrtcConfig
      }
    });

  } catch (error) {
    console.error('❌ Failed to join video session:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to join video session',
      message: error.message
    });
  }
}));

// Start recording a session
router.post('/sessions/:sessionId/recording/start', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { audioOnly, quality } = req.body;
    
    const result = await videoService.startRecording(sessionId, {
      audioOnly: audioOnly || false,
      quality: quality || 'hd'
    });
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'Recording started successfully',
      data: {
        recordingId: result.recordingId,
        filename: result.filename,
        startTime: result.startTime
      }
    });

  } catch (error) {
    console.error('❌ Failed to start recording:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to start recording',
      message: error.message
    });
  }
}));

// Stop recording a session
router.post('/sessions/:sessionId/recording/stop', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const result = await videoService.stopRecording(sessionId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'Recording stopped successfully',
      data: {
        recording: result.recording,
        duration: result.duration
      }
    });

  } catch (error) {
    console.error('❌ Failed to stop recording:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to stop recording',
      message: error.message
    });
  }
}));

// End a video consultation session
router.post('/sessions/:sessionId/end', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const result = await videoService.endSession(sessionId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    // Update appointment status in database
    await query(`
      UPDATE appointments 
      SET status = 'completed', updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND id = (
        SELECT id FROM appointments 
        WHERE user_id = ? AND title = ? 
        ORDER BY created_at DESC LIMIT 1
      )
    `, [req.user.userId, req.user.userId, result.session.title]);

    res.json({
      success: true,
      message: 'Video consultation session ended successfully',
      data: {
        session: result.session
      }
    });

  } catch (error) {
    console.error('❌ Failed to end video session:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to end video session',
      message: error.message
    });
  }
}));

// Get session details
router.get('/sessions/:sessionId', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const sessionInfo = videoService.getSessionInfo(sessionId);
    
    if (!sessionInfo) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      data: {
        session: sessionInfo
      }
    });

  } catch (error) {
    console.error('❌ Failed to get session details:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve session details',
      message: error.message
    });
  }
}));

// Get WebRTC configuration
router.get('/webrtc-config', authenticateToken, (req, res) => {
  try {
    const webrtcConfig = videoService.getWebRTCConfig();
    
    res.json({
      success: true,
      data: {
        webrtcConfig
      }
    });
  } catch (error) {
    console.error('❌ Failed to get WebRTC config:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve WebRTC configuration',
      message: error.message
    });
  }
});

// Get video service statistics
router.get('/stats', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const stats = videoService.getStats();
    
    res.json({
      success: true,
      data: {
        stats
      }
    });
  } catch (error) {
    console.error('❌ Failed to get video service stats:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics',
      message: error.message
    });
  }
}));

module.exports = router;