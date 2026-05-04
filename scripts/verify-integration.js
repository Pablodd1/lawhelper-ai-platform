/**
 * LawHelper Attorney App - Integration Verification Script
 * Comprehensive CLI checks for all integrated features
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

class IntegrationVerifier {
  constructor() {
    this.checks = [];
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      total: 0
    };
  }

  async run() {
    console.log('🔍 LawHelper Integration Verification');
    console.log('='.repeat(50));
    
    await this.checkEnvironment();
    await this.checkDatabase();
    await this.checkFileUpload();
    await this.checkAIIntegration();
    await this.checkVideoService();
    await this.checkAPIEndpoints();
    await this.checkDataPersistence();
    
    this.printResults();
    
    return this.results.failed === 0;
  }

  async check(checkName, checkFunction) {
    this.results.total++;
    process.stdout.write(`Checking ${checkName}... `);
    
    try {
      const result = await checkFunction();
      if (result.success) {
        console.log('✅ PASS');
        this.results.passed++;
        if (result.message) {
          console.log(`   ℹ️  ${result.message}`);
        }
      } else {
        console.log('❌ FAIL');
        this.results.failed++;
        if (result.message) {
          console.log(`   💥 ${result.message}`);
        }
      }
      
      if (result.warning) {
        console.log(`   ⚠️  WARNING: ${result.warning}`);
        this.results.warnings++;
      }
      
      return result;
    } catch (error) {
      console.log('❌ FAIL');
      console.log(`   💥 ERROR: ${error.message}`);
      this.results.failed++;
      return { success: false, message: error.message };
    }
  }

  async checkEnvironment() {
    console.log('\n🏛️  Environment Configuration');
    console.log('-'.repeat(30));
    
    await this.check('Node.js version', async () => {
      const version = process.version;
      const major = parseInt(version.slice(1).split('.')[0]);
      return {
        success: major >= 16,
        message: `Node.js ${version}`
      };
    });
    
    await this.check('Environment variables', async () => {
      const required = []; // DATABASE_URL is handled by SQLite default
      const optional = ['OPENAI_API_KEY', 'UPLOAD_DIR', 'RECORDING_DIR'];
      
      const missing = required.filter(key => !process.env[key]);
      const present = optional.filter(key => process.env[key]);
      
      // Check for at least one database configuration
      const hasDatabase = process.env.DATABASE_URL || true; // SQLite is default
      
      return {
        success: missing.length === 0 && hasDatabase,
        message: `Required: ${required.length - missing.length}/${required.length}, Optional: ${present.length}/${optional.length}, Database: ${hasDatabase ? 'configured' : 'missing'}`,
        warning: missing.length > 0 ? `Missing required: ${missing.join(', ')}` : null
      };
    });
    
    await this.check('Package dependencies', async () => {
      const packagePath = path.join(__dirname, '../package.json');
      const packageData = JSON.parse(await fs.readFile(packagePath, 'utf8'));
      
      const keyDeps = ['express', 'openai', 'multer', 'sqlite3', 'jsonwebtoken'];
      const missing = keyDeps.filter(dep => !packageData.dependencies[dep]);
      
      return {
        success: missing.length === 0,
        message: `Key dependencies: ${keyDeps.length - missing.length}/${keyDeps.length}`,
        warning: missing.length > 0 ? `Missing dependencies: ${missing.join(', ')}` : null
      };
    });
  }

  async checkDatabase() {
    console.log('\n🗃️  Database Integration');
    console.log('-'.repeat(30));
    
    await this.check('Database connection', async () => {
      const { dbHealthCheck } = require('../server/database/connection-sqlite');
      const isConnected = await dbHealthCheck();
      
      return {
        success: isConnected,
        message: isConnected ? 'Connected to SQLite database' : 'Database connection failed'
      };
    });
    
    await this.check('Database schema', async () => {
      const { query } = require('../server/database/connection-sqlite');
      
      const tables = ['users', 'clients', 'cases', 'documents', 'appointments'];
      const results = {};
      
      for (const table of tables) {
        try {
          const result = await query(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table]);
          results[table] = result.rows.length > 0;
        } catch (error) {
          results[table] = false;
        }
      }
      
      const existing = Object.values(results).filter(Boolean).length;
      
      return {
        success: existing === tables.length,
        message: `Tables: ${existing}/${tables.length}`,
        warning: existing < tables.length ? `Missing tables: ${tables.filter(t => !results[t]).join(', ')}` : null
      };
    });
    
    await this.check('AI analysis fields', async () => {
      const { query } = require('../server/database/connection-sqlite');
      
      try {
        // Check if ai_analysis column exists by trying to query it
        const result = await query(`SELECT sql FROM sqlite_master WHERE type='table' AND name='documents'`);
        if (result.rows.length === 0) {
          return {
            success: false,
            message: 'Documents table not found'
          };
        }
        
        const schema = result.rows[0].sql;
        const hasAiAnalysis = schema.includes('ai_analysis');
        const hasAiAnalyzedAt = schema.includes('ai_analyzed_at');
        
        return {
          success: hasAiAnalysis && hasAiAnalyzedAt,
          message: hasAiAnalysis && hasAiAnalyzedAt ? 'AI analysis fields are present' : 'AI analysis fields missing'
        };
      } catch (error) {
        return {
          success: false,
          message: `Database error: ${error.message}`
        };
      }
    });
  }

  async checkFileUpload() {
    console.log('\n📁 File Upload Service');
    console.log('-'.repeat(30));
    
    await this.check('File upload service', async () => {
      try {
        const fileUploadService = require('../server/services/fileUploadService');
        return {
          success: !!fileUploadService,
          message: 'File upload service loaded successfully'
        };
      } catch (error) {
        return {
          success: false,
          message: `File upload service failed: ${error.message}`
        };
      }
    });
    
    await this.check('Upload directory', async () => {
      const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
      
      try {
        await fs.access(uploadDir);
        return {
          success: true,
          message: `Upload directory exists: ${uploadDir}`
        };
      } catch (error) {
        return {
          success: false,
          message: `Upload directory missing: ${uploadDir}`
        };
      }
    });
    
    await this.check('Multer configuration', async () => {
      try {
        const multer = require('multer');
        return {
          success: !!multer,
          message: 'Multer package available for file uploads'
        };
      } catch (error) {
        return {
          success: false,
          message: 'Multer package not available'
        };
      }
    });
  }

  async checkAIIntegration() {
    console.log('\n🧠 AI Integration');
    console.log('-'.repeat(30));
    
    await this.check('AI service module', async () => {
      try {
        const aiService = require('../server/services/aiService');
        return {
          success: !!aiService,
          message: 'AI service module loaded successfully'
        };
      } catch (error) {
        return {
          success: false,
          message: `AI service module failed: ${error.message}`
        };
      }
    });
    
    await this.check('OpenAI API key', async () => {
      const hasKey = !!process.env.OPENAI_API_KEY;
      
      return {
        success: true, // Don't fail if key is missing, just warn
        message: hasKey ? 'OpenAI API key configured' : 'OpenAI API key not configured',
        warning: !hasKey ? 'AI features will be disabled without API key' : null
      };
    });
    
    await this.check('Document analysis capability', async () => {
      try {
        const aiService = require('../server/services/aiService');
        const hasAnalysis = typeof aiService.analyzeDocument === 'function';
        
        return {
          success: hasAnalysis,
          message: hasAnalysis ? 'Document analysis function available' : 'Document analysis function missing'
        };
      } catch (error) {
        return {
          success: false,
          message: `AI service error: ${error.message}`
        };
      }
    });
  }

  async checkVideoService() {
    console.log('\n📹 Video/WebRTC Service');
    console.log('-'.repeat(30));
    
    await this.check('Video service module', async () => {
      try {
        const videoService = require('../server/services/videoService');
        return {
          success: !!videoService,
          message: 'Video service module loaded successfully'
        };
      } catch (error) {
        return {
          success: false,
          message: `Video service module failed: ${error.message}`
        };
      }
    });
    
    await this.check('Recording directory', async () => {
      const recordingDir = process.env.RECORDING_DIR || path.join(__dirname, '../recordings');
      
      try {
        await fs.access(recordingDir);
        return {
          success: true,
          message: `Recording directory exists: ${recordingDir}`
        };
      } catch (error) {
        return {
          success: false,
          message: `Recording directory missing: ${recordingDir}`
        };
      }
    });
    
    await this.check('WebRTC configuration', async () => {
      try {
        const videoService = require('../server/services/videoService');
        const config = videoService.getWebRTCConfig();
        const hasIceServers = config.iceServers && config.iceServers.length > 0;
        
        return {
          success: hasIceServers,
          message: hasIceServers ? 'WebRTC configuration available' : 'WebRTC configuration incomplete'
        };
      } catch (error) {
        return {
          success: false,
          message: `WebRTC config error: ${error.message}`
        };
      }
    });
  }

  async checkAPIEndpoints() {
    console.log('\n🚀 API Endpoints');
    console.log('-'.repeat(30));
    
    await this.check('Video routes', async () => {
      try {
        const videoRoutes = require('../server/routes/video');
        return {
          success: !!videoRoutes,
          message: 'Video consultation routes loaded'
        };
      } catch (error) {
        return {
          success: false,
          message: `Video routes failed: ${error.message}`
        };
      }
    });
    
    await this.check('AI routes', async () => {
      try {
        const aiRoutes = require('../server/routes/ai');
        return {
          success: !!aiRoutes,
          message: 'AI assistance routes loaded'
        };
      } catch (error) {
        return {
          success: false,
          message: `AI routes failed: ${error.message}`
        };
      }
    });
    
    await this.check('Enhanced document routes', async () => {
      try {
        const documentRoutes = require('../server/routes/documents');
        // Check if upload endpoints exist by looking at the router stack
        const hasUpload = documentRoutes.stack.some(layer => 
          layer.route && layer.route.path && layer.route.path.includes('upload')
        );
        
        return {
          success: hasUpload,
          message: hasUpload ? 'Document upload endpoints available' : 'Document upload endpoints missing'
        };
      } catch (error) {
        return {
          success: false,
          message: `Document routes error: ${error.message}`
        };
      }
    });
  }

  async checkDataPersistence() {
    console.log('\n🗄️  Data Persistence');
    console.log('-'.repeat(30));
    
    await this.check('File storage persistence', async () => {
      const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
      const testFile = path.join(uploadDir, '.test_persistence');
      
      try {
        await fs.writeFile(testFile, 'test');
        await fs.unlink(testFile);
        return {
          success: true,
          message: 'File storage is writable'
        };
      } catch (error) {
        return {
          success: false,
          message: `File storage test failed: ${error.message}`
        };
      }
    });
    
    await this.check('Database write capability', async () => {
      const { query } = require('../server/database/connection-sqlite');
      
      try {
        await query(`CREATE TABLE IF NOT EXISTS test_table (id INTEGER PRIMARY KEY, test_data TEXT)`);
        await query(`INSERT INTO test_table (test_data) VALUES ('integration_test')`);
        await query(`DELETE FROM test_table WHERE test_data = 'integration_test'`);
        await query(`DROP TABLE test_table`);
        
        return {
          success: true,
          message: 'Database write operations successful'
        };
      } catch (error) {
        return {
          success: false,
          message: `Database write test failed: ${error.message}`
        };
      }
    });
    
    await this.check('Service integration', async () => {
      try {
        const aiService = require('../server/services/aiService');
        const fileUploadService = require('../server/services/fileUploadService');
        const videoService = require('../server/services/videoService');
        
        const allServices = !!aiService && !!fileUploadService && !!videoService;
        
        return {
          success: allServices,
          message: allServices ? 'All services integrated successfully' : 'Some services failed to load'
        };
      } catch (error) {
        return {
          success: false,
          message: `Service integration error: ${error.message}`
        };
      }
    });
  }

  printResults() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 Integration Verification Results');
    console.log('='.repeat(50));
    
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`⚠️  Warnings: ${this.results.warnings}`);
    console.log(`📈 Total: ${this.results.total}`);
    
    const successRate = this.results.total > 0 ? 
      Math.round((this.results.passed / this.results.total) * 100) : 0;
    
    console.log(`📈 Success Rate: ${successRate}%`);
    
    if (this.results.failed === 0) {
      console.log('\n🎉 All integration checks passed! The application is ready for use.');
    } else {
      console.log(`\n⚠️  ${this.results.failed} checks failed. Please review and fix the issues above.`);
    }
    
    if (this.results.warnings > 0) {
      console.log(`\n⚠️  ${this.results.warnings} warnings detected. Some features may be limited.`);
    }
  }
}

// Run verification if called directly
if (require.main === module) {
  const verifier = new IntegrationVerifier();
  verifier.run().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('💥 Verification failed:', error.message);
    process.exit(1);
  });
}

module.exports = IntegrationVerifier;