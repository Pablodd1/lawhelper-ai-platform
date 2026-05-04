
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
        const uniqueCases = allCases.filter((caseItem, index, self) => 
            index === self.findIndex(c => c.citation === caseItem.citation)
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
        features: ['legal_research', 'document_generation', 'contract_analysis', 'immigration_law', 'asylum_briefs', 'rag_knowledge']
    });
});

// ═══════════════════════════════════════════════
// IMMIGRATION LAW MODULE — Attorney RAG System
// ═══════════════════════════════════════════════

// --- Ollama Local LLM Client (tried first, cloud fallback) ---
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';

async function ollamaChat(messages, options = {}) {
    try {
        const response = await axios.post(`${OLLAMA_HOST}/api/chat`, {
            model: OLLAMA_MODEL,
            messages: messages,
            stream: false,
            options: { temperature: 0.3, ...options }
        }, { timeout: 60000 });
        return { success: true, content: response.data.message.content, provider: 'ollama', model: OLLAMA_MODEL };
    } catch (e) {
        return { success: false, error: e.message, provider: 'ollama' };
    }
}

async function cloudChat(messages, provider = 'deepseek') {
    const apiKeys = {
        deepseek: { key: process.env.DEEPSEEK_API_KEY, url: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat' },
        openai: { key: process.env.OPENAI_API_KEY, url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' }
    };
    const cfg = apiKeys[provider];
    if (!cfg || !cfg.key) return { success: false, error: 'No API key', provider };
    try {
        const response = await axios.post(cfg.url, {
            model: cfg.model,
            messages: messages,
            temperature: 0.3
        }, { headers: { 'Authorization': `Bearer ${cfg.key}`, 'Content-Type': 'application/json' }, timeout: 30000 });
        return { success: true, content: response.data.choices[0].message.content, provider, model: cfg.model };
    } catch (e) {
        return { success: false, error: e.message, provider };
    }
}

// Smart LLM call: local first, cloud fallback
async function smartChat(messages, task = 'general') {
    console.log(`🤖 [${task}] Trying local Ollama (${OLLAMA_MODEL})...`);
    const local = await ollamaChat(messages);
    if (local.success) {
        console.log(`✅ [${task}] Local Ollama succeeded`);
        return local;
    }
    console.log(`⚠️ [${task}] Local failed: ${local.error}. Falling back to DeepSeek...`);
    const cloud = await cloudChat(messages, 'deepseek');
    if (cloud.success) {
        console.log(`✅ [${task}] DeepSeek cloud succeeded`);
        return cloud;
    }
    console.log(`⚠️ [${task}] DeepSeek failed: ${cloud.error}. Trying OpenAI...`);
    return await cloudChat(messages, 'openai');
}

// --- Immigration RAG Knowledge Base ---
const immigrationKnowledge = {
    statutes: {
        asylum: { cite: 'INA § 208', summary: 'Any alien physically present in the US may apply for asylum within 1 year of arrival. Must demonstrate persecution or well-founded fear based on race, religion, nationality, political opinion, or membership in a particular social group.' },
        withholding: { cite: 'INA § 241(b)(3)', summary: 'Withholding of removal if life or freedom would be threatened. Higher standard than asylum — "more likely than not." No 1-year deadline. Bars: particularly serious crime, serious non-political crime, security risk.' },
        cat: { cite: 'CAT Article 3', summary: 'Convention Against Torture protection. Must show "more likely than not" to be tortured by or with acquiescence of government. No bars apply. No derivative beneficiaries.' },
        cancellation: { cite: 'INA § 240A', summary: 'Cancellation of removal for LPRs (7 years continuous residence, no aggravated felony) and non-LPRs (10 years continuous physical presence, good moral character, exceptional hardship to USC/LPR relative).' },
        adjustment: { cite: 'INA § 245', summary: 'Adjustment of status to LPR. Must be admissible, have immediately available visa. Bars: unauthorized employment, status violations (with exceptions for immediate relatives).' },
        naturalization: { cite: 'INA § 316', summary: 'Naturalization after 5 years LPR (3 years if married to USC). Requirements: continuous residence, physical presence, good moral character, English/civics knowledge.' }
    },
    keyCases: [
        { name: 'Matter of M-E-V-G-', cite: '26 I&N Dec. 227 (BIA 2014)', holding: 'Particular social group must be socially distinct within the society in question.' },
        { name: 'Matter of A-B-', cite: '27 I&N Dec. 316 (A.G. 2018)', holding: 'Generally, victims of private criminal activity do not qualify as a particular social group.' },
        { name: 'Matter of L-E-A-', cite: '27 I&N Dec. 581 (A.G. 2019)', holding: 'Family-based particular social group requires showing the family is socially distinct.' }
    ],
    deadlines: [
        { event: 'File I-589 (Asylum)', deadline: 'Within 1 year of last arrival', exceptions: 'Changed circumstances, extraordinary circumstances' },
        { event: 'BIA Appeal', deadline: '30 days from IJ decision', exceptions: 'None — jurisdictional' },
        { event: 'Circuit Court Petition for Review', deadline: '30 days from BIA decision', exceptions: 'None — jurisdictional' },
        { event: 'Motion to Reopen', deadline: '90 days from final order (generally)', exceptions: 'Changed country conditions, ineffective assistance, sua sponte' },
        { event: 'FOIA Response', deadline: '20 business days (statutory)', exceptions: 'Expedited processing for removal proceedings' }
    ],
    credibility: {
        demeanorFactors: ['Responsiveness', 'Consistency', 'Detail level', 'Plausibility', 'Corroboration'],
        traumaConsiderations: 'PTSD, depression, memory fragmentation, and dissociation are common in genuine asylum seekers and should NOT be interpreted as deception.',
        culturalNotes: 'Eye contact norms, emotional expression, narrative structure, and time perception vary significantly across cultures.'
    }
};

// --- Immigration Document Templates ---
const immigrationTemplates = {
    asylum: {
        brief_asylum_support: {
            type: 'Brief in Support of Asylum (I-589)',
            sections: ['caption', 'statement_of_facts', 'legal_framework', 'particular_social_group', 'past_persecution', 'future_fear', 'government_protection', 'internal_relocation', 'humanitarian_asylum', 'conclusion'],
            required_fields: ['client_name', 'a_number', 'country', 'protected_ground', 'persecution_basis']
        },
        declaration_client: {
            type: 'Client Declaration (Asylum)',
            sections: ['personal_background', 'persecution_account', 'threats_harm', 'fear_of_return', 'family_context'],
            required_fields: ['client_name', 'country', 'persecution_details']
        }
    },
    removal_defense: {
        motion_to_reopen: {
            type: 'Motion to Reopen (I-589)',
            sections: ['caption', 'procedural_history', 'changed_circumstances', 'legal_argument', 'supporting_evidence', 'conclusion'],
            required_fields: ['client_name', 'a_number', 'country', 'new_evidence', 'reopen_grounds']
        },
        motion_terminate: {
            type: 'Motion to Terminate Proceedings',
            sections: ['caption', 'jurisdictional_basis', 'legal_argument', 'relief_already_granted', 'conclusion'],
            required_fields: ['client_name', 'a_number', 'terminate_reason']
        }
    },
    appeals: {
        notice_appeal_bia: {
            type: 'Notice of Appeal (BIA/EOIR-26)',
            sections: ['caption', 'ij_decision_details', 'grounds_for_appeal', 'relief_sought', 'certificate_of_service'],
            required_fields: ['client_name', 'a_number', 'ij_name', 'decision_date', 'appeal_grounds']
        },
        brief_bia: {
            type: 'Brief in Support of Appeal (BIA)',
            sections: ['caption', 'statement_of_case', 'statement_of_facts', 'summary_of_argument', 'argument', 'conclusion'],
            required_fields: ['client_name', 'a_number', 'ij_errors', 'supporting_authorities']
        }
    },
    other: {
        foia_request: {
            type: 'FOIA Request (DHS/USCIS/ICE)',
            sections: ['requester_info', 'records_requested', 'fee_waiver', 'expedited_processing', 'certification'],
            required_fields: ['client_name', 'a_number', 'agency', 'records_description']
        },
        bond_redetermination: {
            type: 'Motion for Bond Redetermination',
            sections: ['caption', 'eligibility', 'favorable_factors', 'bond_amount_requested', 'supporting_evidence'],
            required_fields: ['client_name', 'a_number', 'current_bond', 'requested_bond']
        }
    }
};

// --- 3-Agent Conditional Pipeline for Immigration Cases ---
async function runImmigrationPipeline(caseData) {
    const pipelineLog = [];
    const startTime = Date.now();
    
    // Agent 1: Primary Analyst
    console.log('🔍 Agent 1: Primary Immigration Analyst running...');
    const a1Prompt = [
        { role: 'system', content: `You are an experienced immigration attorney AI (Agent 1 - Primary Analyst). Analyze the immigration case and provide:
1. Relief eligibility assessment with citations
2. Recommended case strategy (ranked options)
3. Document checklist with deadlines
4. Risk factors and red flags
5. Confidence score (0-100%)

Immigration Law Knowledge:
${JSON.stringify(immigrationKnowledge.statutes, null, 2)}

Key Deadlines:
${JSON.stringify(immigrationKnowledge.deadlines, null, 2)}` },
        { role: 'user', content: `Analyze this immigration case:\nClient: ${caseData.client_name}\nCountry: ${caseData.country}\nCase Type: ${caseData.case_type}\nFacts: ${caseData.facts}\n\nProvide a complete analysis with confidence score.` }
    ];
    const a1 = await smartChat(a1Prompt, 'agent1-primary');
    pipelineLog.push({ agent: 'A1_Primary', timestamp: new Date().toISOString(), success: a1.success, provider: a1.provider });
    
    // If AI failed, generate rule-based analysis from RAG knowledge
    if (!a1.success || !a1.content) {
        const statute = Object.values(immigrationKnowledge.statutes).find(s => 
            caseData.case_type.toLowerCase().includes('asylum') ? s.cite.includes('208') : 
            caseData.case_type.toLowerCase().includes('removal') ? s.cite.includes('240') : null
        ) || immigrationKnowledge.statutes.asylum;
        
        a1.content = `IMMIGRATION CASE ANALYSIS (Rule-Based Fallback)\n\n` +
            `Client: ${caseData.client_name}\nCountry: ${caseData.country}\nCase Type: ${caseData.case_type}\n\n` +
            `PRIMARY RELIEF: ${statute.cite}\n${statute.summary}\n\n` +
            `ELIGIBILITY FACTORS:\n- Physical presence in US: Required\n- Filing deadline: ${caseData.case_type === 'asylum' ? 'Within 1 year of arrival' : 'Case-specific'}\n` +
            `- Burden of proof: Preponderance of evidence\n\n` +
            `RECOMMENDED STRATEGY:\n1. Gather supporting documentation\n2. Prepare client declaration\n3. File primary application\n4. Prepare for interview/hearing\n\n` +
            `DOCUMENT CHECKLIST:\n- Form I-589 (if asylum)\n- Personal declaration\n- Country conditions evidence\n- Identity documents\n- Corroborating witness statements\n\n` +
            `RISK FACTORS:\n- One-year filing deadline (asylum)\n- Credibility determination\n- Corroboration requirements\n\n` +
            `CONFIDENCE: 40% (Rule-based, no AI available)\n` +
            `⚠️ This is an automated template analysis. Attorney review required.`;
        a1.provider = 'rule-based';
    }
    
    // Extract confidence from A1
    const confMatch = (a1.content || '').match(/confidence[:\s]*(\d+)/i);
    const a1Confidence = confMatch ? parseInt(confMatch[1]) : 50;
    
    // Agent 2: Critical Reviewer
    console.log('🔎 Agent 2: Critical Reviewer running...');
    const a2Prompt = [
        { role: 'system', content: `You are a senior immigration quality auditor (Agent 2 - Critical Reviewer). Review Agent 1's analysis for:
1. Legal accuracy - are the statutes correctly applied?
2. Missing relief options - what did A1 miss?
3. Deadline errors - any miscalculated deadlines?
4. Evidentiary gaps - what evidence is insufficient?
5. Validation status: APPROVED, NEEDS_REVISION, or REJECTED

Be thorough and critical. Immigration errors can lead to deportation.` },
        { role: 'user', content: `Review this immigration case analysis:\n\nCase: ${caseData.client_name} - ${caseData.case_type} - ${caseData.country}\n\nAgent 1 Analysis:\n${a1.content}\n\nProvide your critical review and validation status.` }
    ];
    const a2 = await smartChat(a2Prompt, 'agent2-reviewer');
    pipelineLog.push({ agent: 'A2_Reviewer', timestamp: new Date().toISOString(), success: a2.success, provider: a2.provider });
    
    // Fallback review if AI failed
    if (!a2.success || !a2.content) {
        a2.content = `CRITICAL REVIEW (Rule-Based Fallback)\n\n` +
            `Validation Status: NEEDS_REVISION\n\n` +
            `REVIEW FINDINGS:\n` +
            `1. LEGAL ACCURACY: Basic framework appears correct. Verify all citations against current law.\n` +
            `2. MISSING RELIEF: Consider alternative relief options (Withholding, CAT protection).\n` +
            `3. DEADLINES: Confirm all filing deadlines are calendared with 14-day advance reminders.\n` +
            `4. EVIDENTIARY GAPS: Corroborating evidence is critical. Identify and address gaps.\n` +
            `5. CREDIBILITY: Prepare client for detailed, consistent testimony.\n\n` +
            `RECOMMENDATION: Proceed with caution. Address identified gaps before filing.\n\n` +
            `⚠️ Automated review. Attorney verification required.`;
        a2.provider = 'rule-based';
    }
    
    // Determine if Agent 3 is needed
    const a2Rejected = (a2.content || '').toLowerCase().includes('rejected');
    const a2Revision = (a2.content || '').toLowerCase().includes('needs_revision');
    const needsAgent3 = a2Rejected || a2Revision || a1Confidence < 80 || caseData.complex === true;
    
    let a3 = null;
    if (needsAgent3) {
        console.log('🧠 Agent 3: Senior Immigration Counsel invoked (conditional)...');
        const a3Prompt = [
            { role: 'system', content: `You are a Senior Immigration Counsel with 25+ years experience (Agent 3 - Conditional Specialist). Agent 1 and Agent 2 disagree or confidence is low. Your role:
1. Resolve disagreements between A1 and A2
2. Identify what both agents missed
3. Provide final authoritative analysis
4. Assign final confidence and risk level (LOW/MEDIUM/HIGH/CRITICAL)
5. Final recommendation with specific next steps` },
            { role: 'user', content: `Resolve this immigration case:\n\nCase: ${caseData.client_name} - ${caseData.case_type} - ${caseData.country}\n\nAgent 1 (Confidence: ${a1Confidence}%):\n${a1.content}\n\nAgent 2 Review:\n${a2.content}\n\nProvide final analysis and resolution.` }
        ];
        a3 = await smartChat(a3Prompt, 'agent3-specialist');
        pipelineLog.push({ agent: 'A3_Specialist', timestamp: new Date().toISOString(), success: a3?.success, provider: a3?.provider });
    }
    
    const elapsed = Date.now() - startTime;
    
    return {
        success: true,
        case_id: `IMM-${Date.now()}`,
        pipeline_version: '3.0-conditional',
        agents_used: needsAgent3 ? 3 : 2,
        elapsed_ms: elapsed,
        a1_analysis: a1.content,
        a1_confidence: a1Confidence,
        a1_provider: a1.provider,
        a2_review: a2.content,
        a2_status: a2Rejected ? 'REJECTED' : a2Revision ? 'NEEDS_REVISION' : 'APPROVED',
        a2_provider: a2.provider,
        a3_resolution: a3?.content || null,
        a3_provider: a3?.provider || null,
        local_models_used: [a1, a2, a3].filter(a => a?.provider === 'ollama').length,
        pipeline_log: pipelineLog,
        disclaimer: '⚠️ AI-GENERATED ANALYSIS — REQUIRES ATTORNEY REVIEW BEFORE USE. Not legal advice.',
        human_signature_required: true
    };
}

// --- Immigration API Endpoints ---

// Immigration RAG Knowledge Endpoint
app.get('/api/immigration/knowledge', (req, res) => {
    const { category } = req.query;
    if (category && immigrationKnowledge[category]) {
        return res.json({ success: true, category, data: immigrationKnowledge[category] });
    }
    res.json({ success: true, knowledge: immigrationKnowledge });
});

// Immigration Templates
app.get('/api/immigration/templates', (req, res) => {
    const allTemplates = {};
    let count = 0;
    for (const [cat, templates] of Object.entries(immigrationTemplates)) {
        allTemplates[cat] = {};
        for (const [key, tmpl] of Object.entries(templates)) {
            allTemplates[cat][key] = { type: tmpl.type, required_fields: tmpl.required_fields, sections: tmpl.sections };
            count++;
        }
    }
    res.json({ success: true, categories: Object.keys(immigrationTemplates), total: count, templates: allTemplates });
});

// Generate Immigration Document
app.post('/api/immigration/generate-document', (req, res) => {
    try {
        const { category, template, data } = req.body;
        if (!category || !template || !data) {
            return res.status(400).json({ error: 'category, template, and data required' });
        }
        const tmpl = immigrationTemplates[category]?.[template];
        if (!tmpl) return res.status(404).json({ error: 'Template not found' });
        
        const missing = tmpl.required_fields.filter(f => !data[f]);
        if (missing.length) return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
        
        const doc = `IMMIGRATION LEGAL DOCUMENT
Type: ${tmpl.type}
Generated: ${new Date().toISOString()}
Client: ${data.client_name || '[CLIENT]'}
A-Number: ${data.a_number || '[A#]'}

${tmpl.sections.map(s => `\n=== ${s.toUpperCase().replace(/_/g, ' ')} ===\n[${s} content — AI-generated draft]\n`).join('\n')}

DISCLAIMER: AI-generated draft. Attorney review required. Not legal advice.`;
        
        res.json({ success: true, document: doc, metadata: { type: tmpl.type, category, sections: tmpl.sections.length, generated_at: new Date().toISOString() } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3-Agent Immigration Pipeline
app.post('/api/immigration/analyze', async (req, res) => {
    try {
        const { client_name, country, case_type, facts, complex } = req.body;
        if (!client_name || !country || !case_type || !facts) {
            return res.status(400).json({ error: 'client_name, country, case_type, and facts are required' });
        }
        const result = await runImmigrationPipeline({ client_name, country, case_type, facts, complex });
        res.json(result);
    } catch (e) {
        console.error('Pipeline error:', e);
        res.status(500).json({ error: 'Analysis failed: ' + e.message });
    }
});

// Case Management (in-memory for demo, replaces DB when unavailable)
const caseStore = [];
app.post('/api/immigration/cases', (req, res) => {
    const c = { id: `CASE-${Date.now()}`, ...req.body, created_at: new Date().toISOString(), status: 'open' };
    caseStore.push(c);
    res.json({ success: true, case: c });
});
app.get('/api/immigration/cases', (req, res) => {
    res.json({ success: true, count: caseStore.length, cases: caseStore });
});
app.get('/api/immigration/cases/:id', (req, res) => {
    const c = caseStore.find(c => c.id === req.params.id);
    if (!c) return res.status(404).json({ error: 'Case not found' });
    res.json({ success: true, case: c });
});

// Serve static files
app.use(express.static('public'));

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// Export for Vercel serverless
module.exports = app;

// Start server only when not in Vercel
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`⚖️ LawHelper AI Platform v2.0 running on port ${PORT}`);
    console.log(`🔍 Legal research engine ready`);
    console.log(`📄 Document generator loaded with ${Object.values(legalTemplates).reduce((sum, cat) => sum + Object.keys(cat).length, 0)} templates`);
    initRAGSystem().catch(e => console.log('RAG init deferred:', e.message));
  });
}

// ═══════════════════════════════════════════════
// RAG VECTOR SYSTEM — Supabase pgvector
// ═══════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIM = 1536;

// In-memory vector store (fallback when Supabase unavailable)
const memVectorStore = [];
let supabaseClient = null;

// Initialize Supabase if credentials available
if (SUPABASE_URL && SUPABASE_KEY) {
    try {
        const { createClient } = require('@supabase/supabase-js');
        supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('✅ Supabase client initialized');
    } catch (e) {
        console.log('⚠️ Supabase client not available (npm install @supabase/supabase-js)');
    }
}

// Generate embeddings via OpenAI (with simple fallback)
async function generateEmbedding(text) {
    if (!text || text.length < 10) return null;
    
    // Try OpenAI embeddings
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 20) {
        try {
            const resp = await axios.post('https://api.openai.com/v1/embeddings', {
                model: EMBEDDING_MODEL, input: text.slice(0, 8000)
            }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 15000 });
            return resp.data.data[0].embedding;
        } catch (e) {
            console.log(`Embedding API error: ${e.message}`);
        }
    }
    
    // Simple TF-IDF-like fallback embedding (not as good but works offline)
    const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const embedding = new Array(EMBEDDING_DIM).fill(0);
    for (let i = 0; i < Math.min(words.length, EMBEDDING_DIM); i++) {
        const hash = words[i].split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        embedding[hash % EMBEDDING_DIM] += 1;
    }
    // Normalize
    const mag = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0)) || 1;
    return embedding.map(v => v / mag);
}

// Cosine similarity
function cosineSim(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i]; }
    return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
}

// Ingest document into RAG
async function ingestDocument(title, content, category, source) {
    const embedding = await generateEmbedding(content);
    if (!embedding) return null;
    
    const doc = { id: `rag-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, title, content, category, source, embedding, created_at: new Date().toISOString() };
    
    // Store in Supabase if available
    if (supabaseClient) {
        try {
            await supabaseClient.from('legal_knowledge').insert({
                title, content, category, source, embedding
            });
        } catch (e) { console.log('Supabase insert deferred'); }
    }
    
    // Always store in memory
    memVectorStore.push(doc);
    return doc;
}

// Semantic search
async function searchRAG(query, topK = 5, categoryFilter = null) {
    const queryEmbedding = await generateEmbedding(query);
    if (!queryEmbedding) return [];
    
    let results = memVectorStore;
    
    // Search Supabase if available
    if (supabaseClient) {
        try {
            const { data } = await supabaseClient.rpc('search_legal_knowledge', {
                query_embedding: queryEmbedding,
                match_threshold: 0.5,
                match_count: topK,
                filter_category: categoryFilter || null
            });
            if (data?.length) results = data;
        } catch (e) { /* fallback to memory */ }
    }
    
    // Score and rank
    const scored = results
        .filter(d => !categoryFilter || d.category === categoryFilter)
        .map(d => ({ ...d, score: cosineSim(queryEmbedding, d.embedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
    
    return scored;
}

// Initialize RAG with immigration knowledge
async function initRAGSystem() {
    console.log('🔧 Initializing RAG vector system...');
    const docs = [];
    
    // Statutes
    for (const [name, info] of Object.entries(immigrationKnowledge.statutes)) {
        docs.push({ title: `Statute: ${name}`, content: `${info.cite}: ${info.summary}`, category: 'statutes', source: 'INA' });
    }
    
    // Key cases
    for (const c of immigrationKnowledge.keyCases) {
        docs.push({ title: c.name, content: `${c.cite} — ${c.holding}`, category: 'case_law', source: 'BIA/AG' });
    }
    
    // Deadlines
    for (const d of immigrationKnowledge.deadlines) {
        docs.push({ title: `Deadline: ${d.event}`, content: `${d.event}: ${d.deadline}. Exceptions: ${d.exceptions}`, category: 'deadlines', source: 'USCIS/EOIR' });
    }
    
    // Credibility framework
    if (immigrationKnowledge.credibility) {
        docs.push({ title: 'Credibility Assessment Framework', 
            content: `Demeanor factors: ${immigrationKnowledge.credibility.demeanorFactors.join(', ')}. Trauma: ${immigrationKnowledge.credibility.traumaConsiderations}. Cultural: ${immigrationKnowledge.credibility.culturalNotes}`, 
            category: 'procedure', source: 'Best Practices' });
    }
    
    for (const doc of docs) {
        await ingestDocument(doc.title, doc.content, doc.category, doc.source);
    }
    
    console.log(`✅ RAG system initialized with ${docs.length} documents in vector store`);
}

// --- RAG API Endpoints ---

// Initialize RAG on first use (lazy, works in Vercel serverless)
let ragInitialized = false;
async function ensureRAG() {
    if (!ragInitialized) {
        ragInitialized = true;
        await initRAGSystem();
    }
}

// Search RAG knowledge
app.post('/api/rag/search', async (req, res) => {
    try {
        await ensureRAG();
        const { query, topK = 5, category } = req.body;
        if (!query) return res.status(400).json({ error: 'Query required' });
        
        const results = await searchRAG(query, topK, category);
        res.json({ success: true, query, count: results.length, results: results.map(r => ({ title: r.title, content: r.content, category: r.category, score: r.score, source: r.source })) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Ingest document
app.post('/api/rag/ingest', async (req, res) => {
    try {
        const { title, content, category, source } = req.body;
        if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
        
        const doc = await ingestDocument(title, content, category || 'general', source || 'user');
        res.json({ success: true, document: { id: doc.id, title: doc.title, category: doc.category } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// RAG stats
app.get('/api/rag/stats', async (req, res) => {
    await ensureRAG();
    const cats = {};
    memVectorStore.forEach(d => { cats[d.category] = (cats[d.category] || 0) + 1; });
    res.json({ success: true, total: memVectorStore.length, categories: cats, storage: supabaseClient ? 'supabase+memory' : 'memory' });
});
