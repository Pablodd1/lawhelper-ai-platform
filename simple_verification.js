/**
 * LawHelper Attorney App - Simple Verification Script
 * Quick smoke test and verification
 */

const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

class SimpleVerification {
    constructor(baseUrl = 'http://localhost:3001') {
        this.baseUrl = baseUrl;
        this.results = [];
    }

    async runTests() {
        console.log('🚀 Starting LawHelper Simple Verification...');
        
        // Test 1: Basic connectivity
        await this.testConnectivity();
        
        // Test 2: API endpoints
        await this.testApiEndpoints();
        
        // Test 3: CLI verification
        await this.testCLI();
        
        // Test 4: Data persistence
        await this.testDataPersistence();
        
        return this.generateReport();
    }

    async testConnectivity() {
        console.log('\n🔍 Testing basic connectivity...');
        
        const endpoints = [
            '/api/health',
            '/api/db/status',
            '/',
            '/login',
            '/dashboard'
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.makeRequest(endpoint);
                const success = response.statusCode === 200;
                
                this.results.push({
                    test: `Connectivity - ${endpoint}`,
                    success,
                    statusCode: response.statusCode,
                    responseTime: response.responseTime
                });
                
                console.log(`${success ? '✅' : '❌'} ${endpoint} - ${response.statusCode}`);
            } catch (error) {
                this.results.push({
                    test: `Connectivity - ${endpoint}`,
                    success: false,
                    error: error.message
                });
                console.log(`❌ ${endpoint} - Error: ${error.message}`);
            }
        }
    }

    async testApiEndpoints() {
        console.log('\n🚀 Testing API endpoints...');
        
        const endpoints = [
            { method: 'GET', path: '/api/cases' },
            { method: 'GET', path: '/api/clients' },
            { method: 'POST', path: '/api/auth/login', body: { email: 'test@example.com', password: 'test' } },
            { method: 'GET', path: '/api/documents' },
            { method: 'GET', path: '/api/calendar' }
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await this.makeRequest(endpoint.path, {
                    method: endpoint.method,
                    body: endpoint.body
                });
                
                // Check if response is JSON
                let isJson = false;
                try {
                    JSON.parse(response.body);
                    isJson = true;
                } catch (e) {
                    isJson = false;
                }
                
                const success = response.statusCode < 400 && isJson;
                
                this.results.push({
                    test: `API - ${endpoint.method} ${endpoint.path}`,
                    success,
                    statusCode: response.statusCode,
                    isJson,
                    responseTime: response.responseTime
                });
                
                console.log(`${success ? '✅' : '❌'} ${endpoint.method} ${endpoint.path} - ${isJson ? 'JSON' : 'HTML'}`);
            } catch (error) {
                this.results.push({
                    test: `API - ${endpoint.method} ${endpoint.path}`,
                    success: false,
                    error: error.message
                });
                console.log(`❌ ${endpoint.method} ${endpoint.path} - Error: ${error.message}`);
            }
        }
    }

    async testCLI() {
        console.log('\n🖥️  Testing CLI with curl...');
        
        const commands = [
            `curl -s -w "\\nTIME:%{time_total}s" ${this.baseUrl}/api/health`,
            `curl -s -H "Accept: application/json" ${this.baseUrl}/api/cases | head -c 100`,
            `curl -s -I ${this.baseUrl}/api/health | head -3`,
            `curl -s ${this.baseUrl}/api/db/status`
        ];

        for (const command of commands) {
            try {
                const output = execSync(command, { encoding: 'utf8', timeout: 5000 });
                const hasOutput = output && output.length > 0;
                const hasJson = output.includes('{') && output.includes('}');
                
                const success = hasOutput;
                
                this.results.push({
                    test: `CLI - ${command.split(' ')[2]}`,
                    success,
                    hasJson,
                    outputLength: output.length
                });
                
                console.log(`${success ? '✅' : '❌'} ${command.split(' ')[2]} - ${hasJson ? 'JSON' : 'Text'}`);
            } catch (error) {
                this.results.push({
                    test: `CLI - ${command.split(' ')[2]}`,
                    success: false,
                    error: error.message
                });
                console.log(`❌ ${command.split(' ')[2]} - Error: ${error.message}`);
            }
        }
    }

    async testDataPersistence() {
        console.log('\n💾 Testing data persistence...');
        
        try {
            // Test database connectivity
            const response = await this.makeRequest('/api/db/status');
            const data = JSON.parse(response.body);
            
            const success = response.statusCode === 200 && data.success === true;
            
            this.results.push({
                test: 'Data Persistence - Database Status',
                success,
                database: data.database,
                connectionString: data.connectionString
            });
            
            console.log(`${success ? '✅' : '❌'} Database Status - ${data.database}`);
        } catch (error) {
            this.results.push({
                test: 'Data Persistence - Database Status',
                success: false,
                error: error.message
            });
            console.log(`❌ Database Status - Error: ${error.message}`);
        }
    }

    async makeRequest(path, options = {}) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, this.baseUrl);
            const protocol = url.protocol === 'https:' ? https : http;
            
            const startTime = Date.now();
            
            const requestOptions = {
                method: options.method || 'GET',
                timeout: 10000,
                headers: {
                    'User-Agent': 'LawHelper-Verification/1.0',
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            };

            const req = protocol.request(url, requestOptions, (res) => {
                let body = '';
                
                res.on('data', (chunk) => {
                    body += chunk;
                });
                
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: body,
                        responseTime: Date.now() - startTime
                    });
                });
            });

            req.on('error', reject);
            req.on('timeout', () => reject(new Error('Request timeout')));
            
            if (options.body) {
                req.write(JSON.stringify(options.body));
            }
            
            req.end();
        });
    }

    generateReport() {
        const total = this.results.length;
        const passed = this.results.filter(r => r.success).length;
        const failed = total - passed;
        const successRate = ((passed / total) * 100).toFixed(1);
        
        const report = {
            timestamp: new Date().toISOString(),
            totalTests: total,
            passedTests: passed,
            failedTests: failed,
            successRate: `${successRate}%`,
            status: successRate >= 90 ? 'PASS' : successRate >= 70 ? 'WARNING' : 'FAIL',
            results: this.results
        };
        
        console.log('\n' + '='.repeat(50));
        console.log('📊 VERIFICATION SUMMARY');
        console.log('='.repeat(50));
        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);
        console.log(`Success Rate: ${successRate}%`);
        console.log(`Status: ${report.status}`);
        
        return report;
    }
}

// Run the verification
if (require.main === module) {
    const verifier = new SimpleVerification('http://localhost:3001');
    verifier.runTests()
        .then(report => {
            console.log('\n🎯 Simple verification complete!');
            process.exit(report.status === 'PASS' ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Verification failed:', error);
            process.exit(1);
        });
}

module.exports = SimpleVerification;