/**
 * LawHelper Attorney App - AI Service
 * Integrates OpenAI API for legal document analysis and assistance
 */

const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');

class AIService {
  constructor() {
    try {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    } catch (error) {
      console.warn('⚠️  OpenAI initialization failed:', error.message);
      this.openai = null;
    }
    
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️  OPENAI_API_KEY not configured. AI features will be disabled.');
    }
  }

  /**
   * Analyze a legal document and extract key information
   */
  async analyzeDocument(filePath, fileName) {
    try {
      if (!this.openai || !this.openai.apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      // Read file content based on file type
      const content = await this.extractTextFromFile(filePath, fileName);
      
      const prompt = `
        You are a legal document analysis expert. Please analyze the following legal document and provide:
        
        1. Document type and category
        2. Key legal concepts and terms
        3. Important dates and deadlines
        4. Parties involved
        5. Legal issues identified
        6. Recommended actions
        7. Risk assessment (low/medium/high)
        8. Summary of key points
        
        Document content:
        ${content}
        
        Please provide the analysis in JSON format with the following structure:
        {
          "documentType": "string",
          "category": "string", 
          "keyTerms": ["term1", "term2"],
          "importantDates": [{"date": "YYYY-MM-DD", "description": "string"}],
          "parties": [{"name": "string", "role": "string"}],
          "legalIssues": [{"issue": "string", "severity": "low|medium|high"}],
          "recommendedActions": ["action1", "action2"],
          "riskLevel": "low|medium|high",
          "summary": "string",
          "confidence": 0.0-1.0
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are an experienced legal document analyst. Provide accurate, professional analysis of legal documents."
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      return {
        success: true,
        analysis,
        metadata: {
          model: response.model,
          tokens: response.usage.total_tokens,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('❌ Document analysis failed:', error.message);
      return {
        success: false,
        error: error.message,
        analysis: null
      };
    }
  }

  /**
   * Extract text from different file types
   */
  async extractTextFromFile(filePath, fileName) {
    const ext = path.extname(fileName).toLowerCase();
    
    try {
      switch (ext) {
        case '.txt':
        case '.md':
          return await fs.readFile(filePath, 'utf8');
        
        case '.pdf':
          const pdfParse = require('pdf-parse');
          const pdfBuffer = await fs.readFile(filePath);
          const pdfData = await pdfParse(pdfBuffer);
          return pdfData.text;
        
        case '.docx':
          const mammoth = require('mammoth');
          const docxBuffer = await fs.readFile(filePath);
          const docxResult = await mammoth.extractRawText({ buffer: docxBuffer });
          return docxResult.value;
        
        default:
          // For other file types, return a placeholder
          return `[File: ${fileName}] - Text extraction not supported for this file type`;
      }
    } catch (error) {
      console.error(`❌ Failed to extract text from ${fileName}:`, error.message);
      throw new Error(`Failed to extract text from file: ${error.message}`);
    }
  }

  /**
   * Generate legal document template
   */
  async generateDocumentTemplate(type, data) {
    try {
      if (!this.openai || !this.openai.apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      const prompt = `
        Generate a professional legal document template for: ${type}
        
        Context:
        - Jurisdiction: ${data.jurisdiction || 'General'}
        - Case Type: ${data.caseType || 'General'}
        - Parties: ${JSON.stringify(data.parties || [])}
        - Specific Requirements: ${data.requirements || 'Standard format'}
        
        Please provide:
        1. Proper legal formatting
        2. Relevant legal citations
        3. Fill-in-the-blank sections
        4. Professional language
        5. Standard clauses
        
        Return the document as plain text with proper formatting.
      `;

      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are an experienced legal professional. Generate accurate, professional legal document templates."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 3000
      });

      return {
        success: true,
        template: response.choices[0].message.content,
        metadata: {
          type,
          jurisdiction: data.jurisdiction,
          timestamp: new Date().toISOString(),
          tokens: response.usage.total_tokens
        }
      };

    } catch (error) {
      console.error('❌ Template generation failed:', error.message);
      return {
        success: false,
        error: error.message,
        template: null
      };
    }
  }

  /**
   * Provide legal research assistance
   */
  async legalResearch(query, jurisdiction = 'US') {
    try {
      if (!this.openai || !this.openai.apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      const prompt = `
        Provide legal research assistance for the following query:
        
        Query: ${query}
        Jurisdiction: ${jurisdiction}
        
        Please provide:
        1. Relevant legal principles
        2. Key statutes or regulations
        3. Case law references (if applicable)
        4. Practical considerations
        5. Recommended next steps
        6. Disclaimer about seeking professional legal advice
        
        Format the response in a clear, professional manner suitable for an attorney.
      `;

      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a legal research assistant. Provide accurate, helpful legal information while emphasizing the need for professional legal advice."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      });

      return {
        success: true,
        research: response.choices[0].message.content,
        metadata: {
          query,
          jurisdiction,
          timestamp: new Date().toISOString(),
          tokens: response.usage.total_tokens
        }
      };

    } catch (error) {
      console.error('❌ Legal research failed:', error.message);
      return {
        success: false,
        error: error.message,
        research: null
      };
    }
  }

  /**
   * Check if AI service is available
   */
  isAvailable() {
    return !!(this.openai && this.openai.apiKey);
  }
}

module.exports = new AIService();