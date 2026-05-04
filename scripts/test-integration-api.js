/**
 * LawHelper Attorney App - API Integration Test Script
 * Tests actual API endpoints to verify integration
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

class APIIntegrationTester {
  constructor() {
    this.baseURL = process.env.API_BASE_URL || 'http://localhost:3000/api';
    this.testToken = null;
    this.testResults = [];
    this.testUser = {
      email: 'test@lawhelper.com',
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User'
    };
  }

  async run() {
    console.log('🧪 LawHelper API Integration Tests');
    console.log('='.repeat(50));
    console.log(`Testing API at: ${this.baseURL}`);
    console.log('');

    try {
      // Test health endpoint first
      await this.testHealthCheck();
      
      // Test authentication
      await this.testAuthentication();
      
      if (this.testToken) {
        // Test AI endpoints
        await this.testAIEndpoints();
        
        // Test file upload
        await this.testFileUpload();
        
        // Test video consultation
        await this.testVideoConsultation();
        
        // Test data persistence
        await this.testDataPersistence();
      }
      
      this.printResults();
      
      return this.testResults.filter(r => !r.success).length === 0;
      
    } catch (error) {
      console.error('💥 Test suite failed:', error.message);
      return false;
    }
  }

  async test(name, testFunction) {
    process.stdout.write(`Testing ${name}... `);
    
    try {
      const result = await testFunction();
      
      if (result.success) {
        console.log('✅ PASS');
        this.testResults.push({ name, success: true, message: result.message });
      } else {
        console.log('❌ FAIL');
        this.testResults.push({ name, success: false, message: result.message });
        console.log(`   💥 ${result.message}`);
      }
      
      return result;
    } catch (error) {
      console.log('❌ FAIL');
      this.testResults.push({ name, success: false, message: error.message });
      console.log(`   💥 ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  async testHealthCheck() {
    console.log('🚀 Health Check');
    console.log('-'.repeat(30));
    
    await this.test('Health endpoint', async () => {
      const response = await axios.get(`${this.baseURL}/health`);
      
      return {
        success: response.data.success === true,
        message: response.data.message || 'Health check passed'
      };
    });
    
    await this.test('Database status', async () => {
      const response = await axios.get(`${this.baseURL}/db/status`);
      
      return {
        success: response.data.success === true && response.data.database === 'connected',
        message: response.data.database || 'Database status unknown'
      };
    });
  }

  async testAuthentication() {
    console.log('\n🔐 Authentication');
    console.log('-'.repeat(30));
    
    await this.test('User registration', async () => {
      try {
        const response = await axios.post(`${this.baseURL}/auth/register`, this.testUser);
        
        if (response.data.success) {
          this.testToken = response.data.token;
          return { success: true, message: 'User registered successfully' };
        } else {
          return { success: false, message: response.data.error || 'Registration failed' };
        }
      } catch (error) {
        if (error.response && error.response.status === 409) {
          // User already exists, try login
          return this.testUserLogin();
        }
        throw error;
      }
    });
    
    if (!this.testToken) {
      await this.testUserLogin();
    }
  }

  async testUserLogin() {
    try {
      const response = await axios.post(`${this.baseURL}/auth/login`, {
        email: this.testUser.email,
        password: this.testUser.password
      });
      
      if (response.data.success) {
        this.testToken = response.data.token;
        return { success: true, message: 'User logged in successfully' };
      } else {
        return { success: false, message: response.data.error || 'Login failed' };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async testAIEndpoints() {
    console.log('\n🧠 AI Integration');
    console.log('-'.repeat(30));
    
    await this.test('AI service status', async () => {
      const response = await axios.get(`${this.baseURL}/ai/status`, {
        headers: { Authorization: `Bearer ${this.testToken}` }
      });
      
      return {
        success: response.data.success === true,
        message: response.data.data.available ? 'AI service available' : 'AI service not configured'
      };
    });
    
    await this.test('Legal research', async () => {
      const response = await axios.post(`${this.baseURL}/ai/legal-research`, {
        query: 'What are the requirements for forming a contract?',
        jurisdiction: 'US'
      }, {
        headers: { Authorization: `Bearer ${this.testToken}` }
      });
      
      return {
        success: response.data.success === true && response.data.data.research,
        message: response.data.data.research ? 'Research completed' : 'No research returned'
      };
    });
    
    await this.test('Template generation', async () => {
      const response = await axios.post(`${this.baseURL}/ai/generate-template`, {
        type: 'Non-Disclosure Agreement',
        jurisdiction: 'US',
        parties: [{ name: 'Company A', role: 'Disclosing Party' }]
      }, {
        headers: { Authorization: `Bearer ${this.testToken}` }
      });
      
      return {
        success: response.data.success === true && response.data.data.template,
        message: response.data.data.template ? 'Template generated' : 'No template returned'
      };
    });
  }

  async testFileUpload() {
    console.log('\n📁 File Upload');
    console.log('-'.repeat(30));
    
    // Create a test file
    const testFilePath = path.join(__dirname, 'test-document.txt');
    await fs.writeFile(testFilePath, 'This is a test document for LawHelper file upload testing.');
    
    try {
      await this.test('Single file upload', async () => {
        const form = new FormData();
        form.append('file', fs.createReadStream(testFilePath));
        form.append('category', 'test');
        form.append('description', 'Test document upload');
        
        const response = await axios.post(`${this.baseURL}/documents/upload`, form, {
          headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${this.testToken}`
          }
        });
        
        return {
          success: response.data.success === true,
          message: response.data.data.document ? 'File uploaded successfully' : 'No document returned'
        };
      });
      
      await this.test('Document listing', async () => {
        const response = await axios.get(`${this.baseURL}/documents`, {
          headers: { Authorization: `Bearer ${this.testToken}` }
        });
        
        return {
          success: response.data.success === true && Array.isArray(response.data.data.documents),
          message: `${response.data.data.documents?.length || 0} documents found`
        };
      });
      
    } finally {
      // Clean up test file
      try {
        await fs.unlink(testFilePath);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }

  async testVideoConsultation() {
    console.log('\n📹 Video Consultation');
    console.log('-'.repeat(30));
    
    let sessionId = null;
    
    await this.test('WebRTC configuration', async () => {
      const response = await axios.get(`${this.baseURL}/video/webrtc-config`, {
        headers: { Authorization: `Bearer ${this.testToken}` }
      });
      
      return {
        success: response.data.success === true && response.data.data.webrtcConfig,
        message: response.data.data.webrtcConfig ? 'WebRTC config available' : 'No WebRTC config'
      };
    });
    
    await this.test('Create video session', async () => {
      const response = await axios.post(`${this.baseURL}/video/sessions`, {
        title: 'Test Video Consultation',
        scheduledStart: new Date().toISOString()
      }, {
        headers: { Authorization: `Bearer ${this.testToken}` }
      });
      
      if (response.data.success && response.data.data.sessionId) {
        sessionId = response.data.data.sessionId;
        return {
          success: true,
          message: `Session created: ${sessionId}`
        };
      } else {
        return {
          success: false,
          message: 'Session creation failed'
        };
      }
    });
    
    if (sessionId) {
      await this.test('Get session details', async () => {
        const response = await axios.get(`${this.baseURL}/video/sessions/${sessionId}`, {
          headers: { Authorization: `Bearer ${this.testToken}` }
        });
        
        return {
          success: response.data.success === true && response.data.data.session,
          message: response.data.data.session ? 'Session details retrieved' : 'No session details'
        };
      });
    }
  }

  async testDataPersistence() {
    console.log('\n🗄️  Data Persistence');
    console.log('-'.repeat(30));
    
    await this.test('Service statistics', async () => {
      const response = await axios.get(`${this.baseURL}/video/stats`, {
        headers: { Authorization: `Bearer ${this.testToken}` }
      });
      
      return {
        success: response.data.success === true,
        message: `Video service stats: ${response.data.data.stats?.totalSessions || 0} total sessions`
      };
    });
    
    await this.test('AI analysis history', async () => {
      const response = await axios.get(`${this.baseURL}/ai/analysis-history`, {
        headers: { Authorization: `Bearer ${this.testToken}` }
      });
      
      return {
        success: response.data.success === true && Array.isArray(response.data.data.analyses),
        message: `${response.data.data.analyses?.length || 0} AI analyses in history`
      };
    });
  }

  printResults() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 API Integration Test Results');
    console.log('='.repeat(50));
    
    const passed = this.testResults.filter(r => r.success).length;
    const failed = this.testResults.filter(r => !r.success).length;
    const total = this.testResults.length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Total: ${total}`);
    
    const successRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    console.log(`📈 Success Rate: ${successRate}%`);
    
    if (failed > 0) {
      console.log('\n📋 Failed Tests:');
      this.testResults.filter(r => !r.success).forEach(result => {
        console.log(`   ❌ ${result.name}: ${result.message}`);
      });
    }
    
    if (passed === total) {
      console.log('\n🎉 All API integration tests passed!');
    } else {
      console.log(`\n⚠️  ${failed} tests failed. Please review the issues above.`);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new APIIntegrationTester();
  
  // Check if axios is available
  try {
    require('axios');
  } catch (error) {
    console.error('💥 axios is required for API testing. Install with: npm install axios form-data');
    process.exit(1);
  }
  
  tester.run().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('💥 Test suite failed:', error.message);
    process.exit(1);
  });
}

module.exports = APIIntegrationTester;