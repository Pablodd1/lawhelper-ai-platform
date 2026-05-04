/**
 * LawHelper Attorney App - Video Service
 * Handles WebRTC video consultations and recording
 */

const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs').promises;

class VideoService extends EventEmitter {
  constructor() {
    super();
    this.activeSessions = new Map();
    this.recordingDir = process.env.RECORDING_DIR || path.join(__dirname, '../../recordings');
    this.maxSessionDuration = parseInt(process.env.MAX_VIDEO_SESSION_DURATION) || 3600000; // 1 hour default
    
    this.ensureRecordingDirectory();
  }

  /**
   * Ensure recording directory exists
   */
  async ensureRecordingDirectory() {
    try {
      await fs.mkdir(this.recordingDir, { recursive: true });
      console.log(`✅ Recording directory ensured: ${this.recordingDir}`);
    } catch (error) {
      console.error(`❌ Failed to create recording directory: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new video consultation session
   */
  createSession(sessionData) {
    try {
      const sessionId = this.generateSessionId();
      const session = {
        id: sessionId,
        caseId: sessionData.caseId,
        clientId: sessionData.clientId,
        attorneyId: sessionData.attorneyId,
        title: sessionData.title || 'Video Consultation',
        scheduledStart: sessionData.scheduledStart || new Date(),
        actualStart: null,
        end: null,
        status: 'scheduled',
        participants: [],
        recording: {
          isRecording: false,
          filename: null,
          startTime: null
        },
        metadata: {
          created: new Date().toISOString(),
          duration: 0,
          quality: 'hd',
          maxParticipants: 2
        }
      };

      this.activeSessions.set(sessionId, session);
      
      // Set up session timeout
      this.setupSessionTimeout(sessionId);
      
      this.emit('sessionCreated', { sessionId, session });
      
      return {
        success: true,
        sessionId,
        session,
        joinUrl: `/api/video/join/${sessionId}`,
        token: this.generateToken(sessionId)
      };

    } catch (error) {
      console.error('❌ Failed to create video session:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Join a video consultation session
   */
  joinSession(sessionId, participantData) {
    try {
      const session = this.activeSessions.get(sessionId);
      
      if (!session) {
        return {
          success: false,
          error: 'Session not found'
        };
      }

      if (session.status !== 'active') {
        return {
          success: false,
          error: 'Session is not active'
        };
      }

      if (session.participants.length >= session.metadata.maxParticipants) {
        return {
          success: false,
          error: 'Session is full'
        };
      }

      const participant = {
        id: this.generateParticipantId(),
        name: participantData.name,
        email: participantData.email,
        role: participantData.role, // 'attorney' or 'client'
        joinedAt: new Date().toISOString(),
        isHost: participantData.isHost || false,
        streamId: participantData.streamId || null
      };

      session.participants.push(participant);
      
      this.emit('participantJoined', { sessionId, participant });
      
      return {
        success: true,
        participant,
        session: this.getSessionInfo(sessionId),
        webrtcConfig: this.getWebRTCConfig()
      };

    } catch (error) {
      console.error('❌ Failed to join video session:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Start recording a session
   */
  async startRecording(sessionId, options = {}) {
    try {
      const session = this.activeSessions.get(sessionId);
      
      if (!session) {
        return {
          success: false,
          error: 'Session not found'
        };
      }

      if (session.recording.isRecording) {
        return {
          success: false,
          error: 'Session is already being recorded'
        };
      }

      const recordingId = this.generateRecordingId();
      const filename = `recording_${sessionId}_${recordingId}_${Date.now()}.webm`;
      const filePath = path.join(this.recordingDir, filename);

      session.recording = {
        isRecording: true,
        recordingId,
        filename,
        filePath,
        startTime: new Date().toISOString(),
        options: {
          audioOnly: options.audioOnly || false,
          quality: options.quality || 'hd',
          ...options
        }
      };

      this.emit('recordingStarted', { sessionId, recording: session.recording });
      
      return {
        success: true,
        recordingId,
        filename,
        startTime: session.recording.startTime
      };

    } catch (error) {
      console.error('❌ Failed to start recording:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Stop recording a session
   */
  async stopRecording(sessionId) {
    try {
      const session = this.activeSessions.get(sessionId);
      
      if (!session) {
        return {
          success: false,
          error: 'Session not found'
        };
      }

      if (!session.recording.isRecording) {
        return {
          success: false,
          error: 'Session is not being recorded'
        };
      }

      const recording = { ...session.recording };
      recording.endTime = new Date().toISOString();
      recording.duration = new Date(recording.endTime) - new Date(recording.startTime);
      
      session.recording.isRecording = false;
      
      this.emit('recordingStopped', { sessionId, recording });
      
      return {
        success: true,
        recording,
        duration: recording.duration
      };

    } catch (error) {
      console.error('❌ Failed to stop recording:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * End a video consultation session
   */
  async endSession(sessionId) {
    try {
      const session = this.activeSessions.get(sessionId);
      
      if (!session) {
        return {
          success: false,
          error: 'Session not found'
        };
      }

      // Stop recording if active
      if (session.recording.isRecording) {
        await this.stopRecording(sessionId);
      }

      session.status = 'ended';
      session.end = new Date().toISOString();
      session.metadata.duration = new Date(session.end) - new Date(session.actualStart || session.scheduledStart);
      
      // Clean up after a delay
      setTimeout(() => {
        this.cleanupSession(sessionId);
      }, 5000);
      
      this.emit('sessionEnded', { sessionId, session });
      
      return {
        success: true,
        session: this.getSessionInfo(sessionId)
      };

    } catch (error) {
      console.error('❌ Failed to end video session:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get session information
   */
  getSessionInfo(sessionId) {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    return {
      id: session.id,
      caseId: session.caseId,
      clientId: session.clientId,
      attorneyId: session.attorneyId,
      title: session.title,
      status: session.status,
      scheduledStart: session.scheduledStart,
      actualStart: session.actualStart,
      end: session.end,
      participants: session.participants.length,
      recording: session.recording,
      metadata: session.metadata
    };
  }

  /**
   * Get all sessions for a user
   */
  getUserSessions(userId, role = 'attorney') {
    const userSessions = [];
    
    for (const [sessionId, session] of this.activeSessions) {
      const isParticipant = session.participants.some(p => p.email === userId);
      const isOwner = role === 'attorney' ? session.attorneyId === userId : session.clientId === userId;
      
      if (isParticipant || isOwner) {
        userSessions.push(this.getSessionInfo(sessionId));
      }
    }
    
    return userSessions;
  }

  /**
   * Get WebRTC configuration
   */
  getWebRTCConfig() {
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      sdpSemantics: 'unified-plan',
      bundlePolicy: 'max-bundle',
      iceCandidatePoolSize: 10
    };
  }

  /**
   * Generate session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate participant ID
   */
  generateParticipantId() {
    return `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate recording ID
   */
  generateRecordingId() {
    return `recording_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate secure token
   */
  generateToken(sessionId) {
    return Buffer.from(JSON.stringify({
      sessionId,
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substr(2, 9)
    })).toString('base64');
  }

  /**
   * Set up session timeout
   */
  setupSessionTimeout(sessionId) {
    setTimeout(() => {
      const session = this.activeSessions.get(sessionId);
      if (session && session.status === 'active') {
        this.endSession(sessionId);
      }
    }, this.maxSessionDuration);
  }

  /**
   * Clean up ended session
   */
  async cleanupSession(sessionId) {
    try {
      const session = this.activeSessions.get(sessionId);
      if (session && session.status === 'ended') {
        this.activeSessions.delete(sessionId);
        console.log(`🧽 Cleaned up session: ${sessionId}`);
      }
    } catch (error) {
      console.error(`❌ Failed to cleanup session ${sessionId}:`, error.message);
    }
  }

  /**
   * Get service statistics
   */
  getStats() {
    const activeCount = Array.from(this.activeSessions.values()).filter(s => s.status === 'active').length;
    const scheduledCount = Array.from(this.activeSessions.values()).filter(s => s.status === 'scheduled').length;
    const recordingCount = Array.from(this.activeSessions.values()).filter(s => s.recording.isRecording).length;
    
    return {
      totalSessions: this.activeSessions.size,
      activeSessions: activeCount,
      scheduledSessions: scheduledCount,
      recordingSessions: recordingCount,
      uptime: process.uptime()
    };
  }
}

module.exports = new VideoService();