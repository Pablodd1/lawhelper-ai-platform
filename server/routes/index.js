/**
 * LawHelper Attorney App - Routes Registration
 * Properly registers all API routes to ensure JSON responses
 */

const authRoutes = require('./auth');
const caseRoutes = require('./cases');
const clientRoutes = require('./clients');
const documentRoutes = require('./documents');
const calendarRoutes = require('./calendar');
const billingRoutes = require('./billing');
const searchRoutes = require('./search');
const settingsRoutes = require('./settings');
const userRoutes = require('./users');
const videoRoutes = require('./video');
const aiRoutes = require('./ai');

const registerRoutes = (app) => {
  console.log('📋 Registering LawHelper API routes...');
  
  // Mount all route modules
  app.use('/api/auth', authRoutes);
  app.use('/api/cases', caseRoutes);
  app.use('/api/clients', clientRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/calendar', calendarRoutes);
  app.use('/api/billing', billingRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/video', videoRoutes);
  app.use('/api/ai', aiRoutes);
  
  console.log('✅ All API routes registered successfully');
};

module.exports = registerRoutes;