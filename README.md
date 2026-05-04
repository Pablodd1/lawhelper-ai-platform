# LawHelper Attorney App

A comprehensive legal practice management system with integrated AI features, file upload capabilities, and video consultation services.

## 🚀 Features

### Core Features
- **Client Management**: Comprehensive client database with contact information, case history, and document management
- **Case Management**: Track cases, deadlines, court information, and case progress
- **Document Management**: Secure file upload, storage, and organization with AI-powered analysis
- **Calendar & Appointments**: Schedule and manage appointments, court dates, and deadlines
- **Time Tracking & Billing**: Track billable hours, generate invoices, and manage payments
- **Search Functionality**: Full-text search across cases, clients, and documents

### New Integrated Features

#### 🧠 AI-Powered Legal Assistance
- **Document Analysis**: AI analysis of legal documents to extract key information, identify important dates, and assess risk levels
- **Template Generation**: Generate professional legal document templates with proper formatting and legal citations
- **Legal Research**: AI-assisted legal research with relevant statutes, case law, and practical considerations
- **Analysis History**: Track and review all AI analyses performed on documents

#### 📁 Advanced File Upload
- **Secure File Upload**: Multi-format file upload with validation and virus scanning
- **Multiple File Support**: Upload multiple documents simultaneously
- **File Type Support**: PDF, Word documents, images, spreadsheets, and more
- **Automatic Organization**: Files organized by user and case with metadata extraction
- **Storage Management**: Configurable storage limits and automatic cleanup

#### 📹 Video Consultation (WebRTC)
- **Secure Video Calls**: Encrypted video consultations between attorneys and clients
- **Session Management**: Create, join, and manage video consultation sessions
- **Recording Capability**: Optional recording of sessions for later review
- **Screen Sharing**: Share documents and presentations during consultations
- **Multi-Participant Support**: Host consultations with multiple participants

## 🔧 Installation & Setup

### Prerequisites
- Node.js 16+ 
- npm 8+
- SQLite (included)

### Quick Start
```bash
# Clone the repository
git clone <repository-url>
cd LawHelper

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Initialize database
npm run db:init

# Start the server
npm start
```

### Environment Configuration
Create a `.env` file with the following variables:

```env
# Required
DATABASE_URL=sqlite:./database/lawhelper.db
SESSION_SECRET=your-secret-key-here
PORT=3000

# Optional - AI Features
OPENAI_API_KEY=your-openai-api-key

# Optional - File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Optional - Video Recording
RECORDING_DIR=./recordings
MAX_VIDEO_SESSION_DURATION=3600000
```

## 📋 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Documents (Enhanced)
- `GET /api/documents` - List documents
- `GET /api/documents/:id` - Get document details
- `POST /api/documents/upload` - Upload single file with AI analysis
- `POST /api/documents/upload-multiple` - Upload multiple files
- `PUT /api/documents/:id` - Update document metadata
- `DELETE /api/documents/:id` - Delete document

### AI Features
- `GET /api/ai/status` - Check AI service status
- `POST /api/ai/analyze-document` - Analyze document with AI
- `POST /api/ai/generate-template` - Generate legal template
- `POST /api/ai/legal-research` - Research legal questions
- `GET /api/ai/analysis-history` - Get analysis history

### Video Consultation
- `GET /api/video/sessions` - List video sessions
- `POST /api/video/sessions` - Create new video session
- `POST /api/video/sessions/:id/join` - Join video session
- `POST /api/video/sessions/:id/recording/start` - Start recording
- `POST /api/video/sessions/:id/recording/stop` - Stop recording
- `POST /api/video/sessions/:id/end` - End session
- `GET /api/video/webrtc-config` - Get WebRTC configuration

## 🧪 AI Features Usage

### Document Analysis
```bash
# Upload a PDF document and get AI analysis
curl -X POST http://localhost:3000/api/documents/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@contract.pdf" \
  -F "category=contracts" \
  -F "description=Employment contract"

# Analyze existing document
curl -X POST http://localhost:3000/api/ai/analyze-document \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"documentId": 123}'
```

### Legal Research
```bash
curl -X POST http://localhost:3000/api/ai/legal-research \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the requirements for forming a valid contract?",
    "jurisdiction": "US"
  }'
```

### Template Generation
```bash
curl -X POST http://localhost:3000/api/ai/generate-template \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "Non-Disclosure Agreement",
    "jurisdiction": "US",
    "parties": [{"name": "Company A", "role": "Disclosing Party"}]
  }'
```

## 📹 Video Consultation Usage

### Create Video Session
```bash
curl -X POST http://localhost:3000/api/video/sessions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Client Consultation - Smith Case",
    "caseId": 123,
    "clientId": 456,
    "scheduledStart": "2024-01-15T14:00:00Z"
  }'
```

### Join Session
```bash
curl -X POST http://localhost:3000/api/video/sessions/SESSION_ID/join \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "role": "attorney"
  }'
```

## 🔗 Verification & Testing

### Integration Verification
Run comprehensive integration checks:
```bash
npm run verify:integration
```

### API Testing
Test all API endpoints:
```bash
npm run test:api
```

### Database Status
Check database health:
```bash
npm run db:status
```

### Smoke Testing
Run smoke tests:
```bash
npm run smoke-test
```

## 📈 Monitoring

### API Monitoring
Monitor API performance:
```bash
npm run monitor:api
```

### Database Monitoring
Monitor database health:
```bash
npm run monitor:db
```

## 🔧 Troubleshooting

### Common Issues

1. **AI Features Not Working**
   - Check if `OPENAI_API_KEY` is set in environment variables
   - Verify API key is valid and has sufficient credits
   - Check AI service status: `GET /api/ai/status`

2. **File Upload Failures**
   - Ensure upload directory exists and is writable
   - Check file size limits in environment configuration
   - Verify file types are supported

3. **Video Consultation Issues**
   - Check browser WebRTC support
   - Verify network connectivity for STUN/TURN servers
   - Ensure recording directory is writable

4. **Database Connection Errors**
   - Verify `DATABASE_URL` is correctly formatted
   - Check file permissions on SQLite database
   - Run database initialization: `npm run db:init`

### Logs
Check application logs in the `logs/` directory:
- `access.log` - HTTP request logs
- `error.log` - Error logs

## 📚 Architecture

### Technology Stack
- **Backend**: Node.js, Express.js
- **Database**: SQLite (development), PostgreSQL (production)
- **AI Integration**: OpenAI API
- **File Upload**: Multer, Sharp
- **Video**: WebRTC, Socket.io
- **Authentication**: JWT, bcrypt

### Service Architecture
- **AIService**: Handles OpenAI API integration
- **FileUploadService**: Manages file uploads and storage
- **VideoService**: WebRTC session management
- **DatabaseService**: SQLite/PostgreSQL database operations

## 🛠️ Development

### Project Structure
```
LawHelper/
├── server/                 # Backend server
│   ├── routes/            # API routes
│   ├── services/          # Business logic services
│   ├── database/          # Database connection and migrations
│   └── middleware/        # Express middleware
├── scripts/               # Utility scripts
├── uploads/               # File upload storage
├── recordings/            # Video recording storage
├── logs/                  # Application logs
└── database/              # Database files
```

### Adding New Features
1. Create service in `server/services/`
2. Add routes in `server/routes/`
3. Update database schema if needed
4. Add verification tests in `scripts/`
5. Update API documentation

## 📝 License

MIT License - see LICENSE file for details.

## 🧪 Support

For support and questions:
- Check the troubleshooting section
- Review API documentation
- Run verification scripts
- Check application logs

## 🎯 Roadmap

- [ ] Mobile app development
- [ ] Advanced AI analytics
- [ ] Integration with court systems
- [ ] Multi-language support
- [ ] Advanced reporting and analytics
- [ ] Blockchain document verification