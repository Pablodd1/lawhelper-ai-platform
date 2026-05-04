/**
 * LawHelper Attorney App - File Upload Service
 * Handles secure file uploads with validation and storage
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

class FileUploadService {
  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB default
    this.allowedMimeTypes = [
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/csv',
      
      // Images
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/tiff',
      
      // Spreadsheets
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      
      // Presentations
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
    
    this.ensureUploadDirectory();
  }

  /**
   * Ensure upload directory exists
   */
  async ensureUploadDirectory() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      console.log(`✅ Upload directory ensured: ${this.uploadDir}`);
    } catch (error) {
      console.error(`❌ Failed to create upload directory: ${error.message}`);
      throw error;
    }
  }

  /**
   * Configure multer for file uploads
   */
  getUploadConfig() {
    const storage = multer.diskStorage({
      destination: async (req, file, cb) => {
        try {
          const userDir = path.join(this.uploadDir, `user_${req.user.userId}`);
          await fs.mkdir(userDir, { recursive: true });
          cb(null, userDir);
        } catch (error) {
          cb(error, null);
        }
      },
      filename: (req, file, cb) => {
        // Generate unique filename
        const uniqueSuffix = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext);
        const safeBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');
        const filename = `${safeBaseName}_${uniqueSuffix}${ext}`;
        
        cb(null, filename);
      }
    });

    const fileFilter = (req, file, cb) => {
      // Check file type
      if (!this.allowedMimeTypes.includes(file.mimetype)) {
        return cb(new Error(`File type ${file.mimetype} is not allowed`), false);
      }

      // Check file size (preliminary check)
      if (file.size > this.maxFileSize) {
        return cb(new Error(`File size exceeds maximum allowed size of ${this.maxFileSize} bytes`), false);
      }

      cb(null, true);
    };

    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: this.maxFileSize,
        files: 5, // Maximum 5 files per request
        fields: 50, // Maximum 50 fields per request
        parts: 100 // Maximum 100 parts per request
      }
    });
  }

  /**
   * Handle single file upload
   */
  async uploadSingle(req, res, fieldName = 'file') {
    return new Promise((resolve, reject) => {
      const upload = this.getUploadConfig().single(fieldName);
      
      upload(req, res, (err) => {
        if (err) {
          return reject({
            success: false,
            error: err.message,
            code: err.code || 'UPLOAD_ERROR'
          });
        }

        if (!req.file) {
          return reject({
            success: false,
            error: 'No file uploaded',
            code: 'NO_FILE'
          });
        }

        resolve({
          success: true,
          file: {
            originalName: req.file.originalname,
            fileName: req.file.filename,
            filePath: req.file.path,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            encoding: req.file.encoding,
            destination: req.file.destination
          }
        });
      });
    });
  }

  /**
   * Handle multiple file uploads
   */
  async uploadMultiple(req, res, fieldName = 'files', maxCount = 5) {
    return new Promise((resolve, reject) => {
      const upload = this.getUploadConfig().array(fieldName, maxCount);
      
      upload(req, res, (err) => {
        if (err) {
          return reject({
            success: false,
            error: err.message,
            code: err.code || 'UPLOAD_ERROR'
          });
        }

        if (!req.files || req.files.length === 0) {
          return reject({
            success: false,
            error: 'No files uploaded',
            code: 'NO_FILES'
          });
        }

        const files = req.files.map(file => ({
          originalName: file.originalname,
          fileName: file.filename,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype,
          encoding: file.encoding,
          destination: file.destination
        }));

        resolve({
          success: true,
          files,
          count: files.length
        });
      });
    });
  }

  /**
   * Get file information
   */
  async getFileInfo(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const fileName = path.basename(filePath);
      const ext = path.extname(fileName);
      
      return {
        exists: true,
        fileName,
        filePath,
        fileSize: stats.size,
        extension: ext,
        mimeType: this.getMimeType(ext),
        created: stats.birthtime,
        modified: stats.mtime
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          exists: false,
          error: 'File not found'
        };
      }
      throw error;
    }
  }

  /**
   * Delete file
   */
  async deleteFile(filePath) {
    try {
      await fs.unlink(filePath);
      return {
        success: true,
        message: 'File deleted successfully'
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          success: false,
          error: 'File not found'
        };
      }
      throw error;
    }
  }

  /**
   * Get MIME type from file extension
   */
  getMimeType(ext) {
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.tiff': 'image/tiff',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    };

    return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * Validate file upload request
   */
  validateUploadRequest(req) {
    const errors = [];

    if (!req.user || !req.user.userId) {
      errors.push('User authentication required');
    }

    if (!req.body || typeof req.body !== 'object') {
      errors.push('Invalid request body');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get upload statistics for a user
   */
  async getUserUploadStats(userId) {
    try {
      const userDir = path.join(this.uploadDir, `user_${userId}`);
      
      let totalFiles = 0;
      let totalSize = 0;
      
      try {
        const files = await fs.readdir(userDir);
        
        for (const file of files) {
          const filePath = path.join(userDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.isFile()) {
            totalFiles++;
            totalSize += stats.size;
          }
        }
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
        // Directory doesn't exist yet, which is fine
      }

      return {
        success: true,
        stats: {
          totalFiles,
          totalSize,
          totalSizeFormatted: this.formatFileSize(totalSize),
          userId
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Format file size in human readable format
   */
  formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

module.exports = new FileUploadService();