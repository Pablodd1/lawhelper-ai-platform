
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const cheerio = require('cheerio');
const natural = require('natural');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP'
});
app.use('/api/', limiter);

// Legal Database APIs Configuration
const legalDatabases = {
    'fastcase': {
        apiUrl: 'https://api.fastcase.com/v1',
        apiKey: process.env.FASTCASE_API_KEY,
        endpoints: {
            search: '/search/cases',
            statutes: '/search/statutes',
            regulations: '/search/regulations'
        }
    },
    'caselaw_access_project': {
        apiUrl: 'https://api.case.law/v1',
        apiKey: process.env.CAP_API_KEY,
        endpoints: {
            cases: '/cases',
            courts: '/courts',
            jurisdictions: '/jurisdictions'
        }
    },
    'court_listener': {
        apiUrl: 'https://www.courtlistener.com/api/rest/v3',
        endpoints: {
            opinions: '/opinions',
            dockets: '/dockets',
            courts: '/courts'
        }
    }
};

// Legal Document Templates
const legalTemplates = {
    'contracts': {
        'employment_agreement': {
            sections: ['parties', 'term', 'duties', 'compensation', 'termination', 'confidentiality'],
            required_fields: ['employee_name', 'position', 'salary', 'start_date'],
            jurisdiction_specific: true
        },
        'nda': {
            sections: ['definition', 'obligations', 'term', 'exceptions', 'remedies'],
            required_fields: ['parties', 'purpose', 'term_years'],
            jurisdiction_specific: false
        },
        'service_agreement': {
            sections: ['services', 'payment', 'term', 'ip_rights', 'liability'],
            required_fields: ['service_description', 'fee_amount', 'payment_terms'],
            jurisdiction_specific: true
        }
    },
    'litigation': {
        'complaint': {
            sections: ['jurisdiction', 'parties', 'facts', 'claims', 'damages', 'prayer'],
            required_fields: ['plaintiff', 'defendant', 'jurisdiction', 'claims'],
            jurisdiction_specific: true
        },
        'motion_to_dismiss': {
            sections: ['introduction', 'legal_argument', 'conclusion'],
            required_fields: ['grounds', 'legal_basis', 'supporting_authorities'],
            jurisdiction_specific: true
        },
        'discovery_requests': {
            sections: ['interrogatories', 'document_requests', 'admissions'],
            required_fields: ['case_caption', 'discovery_type', 'requests'],
            jurisdiction_specific: true
        }
    },
    'estate_planning': {
        'will': {
            sections: ['declaration', 'beneficiaries', 'executor', 'guardian', 'distributions'],
            required_fields: ['testator', 'beneficiaries', 'executor', 'witnesses'],
            jurisdiction_specific: true
        },
        'power_of_attorney': {
            sections: ['principal', 'agent', 'powers', 'limitations', 'termination'],
            required_fields: ['principal', 'agent', 'powers_granted'],
            jurisdiction_specific: true
        },
        'living_will': {
            sections: ['declaration', 'life_sustaining_treatment', 'organ_donation'],
            required_fields: ['declarant', 'healthcare_proxy'],
            jurisdiction_specific: true
        }
    }
};

// AI Legal Research Engine
class LegalResearchEngine {
    constructor() {
        this.classifier = new natural.BayesClassifier();
        this.setupClassification();
    }

    setupClassification() {
        // Train classifier for legal queries
        this.classifier.addDocument('what are the elements of negligence', 'tort-law');
        this.classifier.addDocument('breach of contract elements', 'contract-law');
        this.classifier.addDocument('how to form an LLC', 'business-law');
        this.classifier.addDocument('employment discrimination', 'employment-law');
        this.classifier.addDocument('personal injury statute of limitations', 'tort-law');
        this.classifier.addDocument('divorce process', 'family-law');
        this.classifier.addDocument('DUI penalties', 'criminal-law');
        this.classifier.addDocument('eviction process', 'landlord-tenant');
        this.classifier.train();
    }

    async searchCaseLaw(query, jurisdiction = 'federal') {
        try {
            // Use multiple legal databases
            const results = await Promise.all([
                this.searchFastcase(query, jurisdiction),
                this.searchCAP(query, jurisdiction),
                this.searchCourtListener(query, jurisdiction)
            ]);

            return this.consolidateResults(results, query);
        } catch (error) {
            console.error('Legal research error:', error);
            return this.fallbackSearch(query);
        }
    }

    async searchFastcase(query, jurisdiction) {
        if (!process.env.FASTCASE_API_KEY) {
            return this.mockFastcaseResults(query);
        }

        try {
            const response = await axios.get(`${legalDatabases.fastcase.apiUrl}${legalDatabases.fastcase.endpoints.search}`, {
                headers: { 'Authorization': `Bearer ${legalDatabases.fastcase.apiKey}` },
                params: { q: query, jurisdiction: jurisdiction, limit: 10 }
            });
            
            return response.data.cases || [];
        } catch (error) {
            console.error('Fastcase search error:', error);
            return [];
        }
    }

    async searchCAP(query, jurisdiction) {
        if (!process.env.CAP_API_KEY) {
            return this.mockCAPResults(query);
        }

        try {
            const response = await axios.get(`${legalDatabases.caselaw_access_project.apiUrl}${legalDatabases.caselaw_access_project.endpoints.cases}`, {
                headers: { 'Authorization': `Token ${legalDatabases.caselaw_access_project.apiKey}` },
                params: { search: query, jurisdiction: jurisdiction, full_case: true, limit: 10 }
            });
            
            return response.data.results || [];
        } catch (error) {
            console.error('CAP search error:', error);
            return [];
        }
    }

    async searchCourtListener(query, jurisdiction) {
        try {
            const response = await axios.get(`${legalDatabases.court_listener.apiUrl}${legalDatabases.court_listener.endpoints.opinions}`, {
                params: { q: query, court: jurisdiction, format: 'json', limit: 10 }
            });
            
            return response.data.results || [];
        } catch (error) {
            console.error('CourtListener search error:', error);
            return [];
        }
    }

    mockFastcaseResults(query) {
        // Mock results for development
        return [
            {
                title: `Smith v. Jones - ${query}`,
                citation: '123 F.3d 456 (11th Cir. 2023)',
                summary: 'Relevant case discussing the legal principles',
                relevance: 0.95,
                jurisdiction: 'Federal'
            },
            {
                title: `Johnson v. State - ${query}`,
                citation: '456 So. 3d 789 (Fla. 2023)',
                summary: 'Florida state court decision on similar issues',
                relevance: 0.88,
                jurisdiction: 'Florida'
            }
        ];
    }

    mockCAPResults(query) {
        return [
            {
                name: `Recent Case on ${query}`,
                citation: '2023 WL 123456',
                court: 'U.S. Supreme Court',
                decision_date: '2023-01-15',
                preview: 'This case establishes important precedent...',
                relevance: 0.92
            }
        ];
    }

    consolidateResults(results, originalQuery) {
        const allCases = results.flat();
        
        // Remove duplicates and rank by relevance
        const uniqueCases = allCases.filter((case, index, self) => 
            index === self.findIndex(c => c.citation === case.citation)
        );
        
        return uniqueCases
            .sort((a, b) => (b.relevance || 0.5) - (a.relevance || 0.5))
            .slice(0, 10)
            .map(c => ({
                title: c.name || c.title,
                citation: c.citation,
                court: c.court,
                date: c.decision_date,
                summary: c.preview || c.summary,
                relevance: c.relevance || 0.5,
                url: c.url || c.frontend_url
            }));
    }

    fallbackSearch(query) {
        return [
            {
                title: 'General Legal Information',
                citation: 'Research Required',
                court: 'Various',
                date: new Date().toISOString(),
                summary: 'For specific legal advice, please consult with a qualified attorney',
                relevance: 0.3
            }
        ];
    }
}

// Document Generation Engine
class DocumentGenerator {
    constructor() {
        this.templates = legalTemplates;
    }

    generateDocument(type, category, data, jurisdiction = 'Florida') {
        const template = this.templates[category]?.[type];
        if (!template) {
            throw new Error(`Template not found: ${category}/${type}`);
        }

        // Validate required fields
        const missingFields = template.required_fields.filter(field => !data[field]);
        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }

        // Generate document sections
        const sections = {};
        template.sections.forEach(section => {
            sections[section] = this.generateSection(section, type, data, jurisdiction);
        });

        return {
            document: this.assembleDocument(type, sections, jurisdiction),
            metadata: {
                type,
                category,
                jurisdiction,
                generated_at: new Date().toISOString(),
                confidence_score: this.calculateConfidence(data, template)
            }
        };
    }

    generateSection(section, type, data, jurisdiction) {
        const sectionGenerators = {
            'parties': () => this.generatePartiesSection(data),
            'term': () => this.generateTermSection(data),
            'duties': () => this.generateDutiesSection(data),
            'compensation': () => this.generateCompensationSection(data),
            'jurisdiction': () => this.generateJurisdictionSection(data, jurisdiction),
            'legal_argument': () => this.generateLegalArgumentSection(data)
        };

        return sectionGenerators[section]?.() || `// ${section} section - customize as needed`;
    }

    generatePartiesSection(data) {
        return `This Agreement is entered into by and between ${data.party_1 || '[PARTY 1]'} ("${data.party_1_role || 'Party 1'}") and ${data.party_2 || '[PARTY 2]'} ("${data.party_2_role || 'Party 2'}").`;
    }

    generateJurisdictionSection(data, jurisdiction) {
        return `This Agreement shall be governed by and construed in accordance with the laws of the State of ${jurisdiction}. Any disputes arising under this Agreement shall be resolved in the courts of ${jurisdiction}.`;
    }

    generateLegalArgumentSection(data) {
        return `
ARGUMENT

${data.legal_basis || '[Legal basis for motion]'}

${data.supporting_authorities || '[Supporting case law and statutes]'}

WHEREFORE, ${data.relief_sought || '[Relief sought]'}.`;
    }

    calculateConfidence(data, template) {
        const providedFields = Object.keys(data).filter(key => data[key]);
        const requiredRatio = providedFields.length / template.required_fields.length;
        
        // Additional confidence based on data quality
        let qualityBonus = 0;
        if (data.detailed_description) qualityBonus += 0.1;
        if (data.supporting_documents) qualityBonus += 0.1;
        if (data.legal_research_done) qualityBonus += 0.1;
        
        return Math.min(1.0, requiredRatio + qualityBonus);
    }

    assembleDocument(type, sections, jurisdiction) {
        let document = `GENERATED LEGAL DOCUMENT\nJurisdiction: ${jurisdiction}\nGenerated: ${new Date().toDateString()}\n\n`;
        
        Object.entries(sections).forEach(([section, content]) => {
            document += `\n${section.toUpperCase().replace('_', ' ')}\n${content}\n`;
        });
        
        document += '\n[END OF DOCUMENT]\n\n';
        document += 'DISCLAIMER: This document was generated by AI. Please review and customize before use. Consult with a qualified attorney for legal advice.';
        
        return document;
    }
}

// Initialize engines
const researchEngine = new LegalResearchEngine();
const documentGenerator = new DocumentGenerator();

// API Routes

// Legal Research API
app.post('/api/legal-research', async (req, res) => {
    try {
        const { query, jurisdiction = 'federal', case_type } = req.body;
        
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }
        
        const results = await researchEngine.searchCaseLaw(query, jurisdiction);
        const classification = researchEngine.classifier.classify(query);
        
        res.json({
            success: true,
            query,
            jurisdiction,
            case_type,
            legal_area: classification,
            results: results,
            result_count: results.length,
            search_time: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Legal research error:', error);
        res.status(500).json({ error: 'Research failed' });
    }
});

// Document Generation API
app.post('/api/generate-document', (req, res) => {
    try {
        const { type, category, data, jurisdiction = 'Florida' } = req.body;
        
        if (!type || !category || !data) {
            return res.status(400).json({ error: 'Type, category, and data are required' });
        }
        
        const result = documentGenerator.generateDocument(type, category, data, jurisdiction);
        
        res.json({
            success: true,
            document: result.document,
            metadata: result.metadata
        });
        
    } catch (error) {
        console.error('Document generation error:', error);
        res.status(400).json({ error: error.message });
    }
});

// Document Templates API
app.get('/api/templates', (req, res) => {
    res.json({
        success: true,
        templates: legalTemplates,
        categories: Object.keys(legalTemplates),
        total_templates: Object.values(legalTemplates).reduce((sum, cat) => sum + Object.keys(cat).length, 0)
    });
});

// Contract Analysis API
app.post('/api/analyze-contract', (req, res) => {
    try {
        const { contract_text, contract_type } = req.body;
        
        if (!contract_text) {
            return res.status(400).json({ error: 'Contract text is required' });
        }
        
        const analysis = analyzeContract(contract_text, contract_type);
        
        res.json({
            success: true,
            analysis: analysis
        });
        
    } catch (error) {
        console.error('Contract analysis error:', error);
        res.status(500).json({ error: 'Analysis failed' });
    }
});

function analyzeContract(text, type) {
    const risks = [];
    const missing = [];
    const suggestions = [];
    
    // Risk analysis
    if (text.includes('unlimited liability')) {
        risks.push('Unlimited liability clause detected - consider capping liability');
    }
    
    if (text.includes('perpetual')) {
        risks.push('Perpetual terms detected - consider adding termination clauses');
    }
    
    if (!text.includes('governing law')) {
        missing.push('Governing law clause');
    }
    
    if (!text.includes('dispute resolution')) {
        missing.push('Dispute resolution mechanism');
    }
    
    // Suggestions
    if (type === 'employment' && !text.includes('at-will')) {
        suggestions.push('Consider specifying at-will employment status');
    }
    
    return {
        risk_level: risks.length > 3 ? 'High' : risks.length > 1 ? 'Medium' : 'Low',
        risks_found: risks.length,
        risks: risks,
        missing_clauses: missing,
        suggestions: suggestions,
        overall_score: Math.max(0, 100 - (risks.length * 15) - (missing.length * 10))
    };
}

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        service: 'LawHelper AI Platform',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        features: ['legal_research', 'document_generation', 'contract_analysis']
    });
});

// Serve static files
app.use(express.static('public'));

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`⚖️ LawHelper AI Platform v2.0 running on port ${PORT}`);
    console.log(`🔍 Legal research engine ready`);
    console.log(`📄 Document generator loaded with ${Object.values(legalTemplates).reduce((sum, cat) => sum + Object.keys(cat).length, 0)} templates`);
});
