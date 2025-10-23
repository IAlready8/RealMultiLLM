/**
 * Advanced Export/Import System for RealMultiLLM
 * Provides comprehensive data export/import with multiple formats and validation
 */

import { Logger } from '../../../lib/logger';
import { Cache } from '../../../lib/cache';
import { LLMManager } from '../../../lib/llm-manager';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
import { Readable } from 'stream';

// Type definitions
export interface ExportJob {
  id: string;
  userId: string;
  type: 'conversation' | 'analytics' | 'configuration' | 'user_data' | 'model_data';
  format: 'json' | 'csv' | 'xml' | 'pdf' | 'zip';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  filters: Record<string, any>;
  createdAt: Date;
  completedAt?: Date;
  downloadUrl?: string;
  size?: number; // Size in bytes
  metadata: Record<string, any>;
}

export interface ImportJob {
  id: string;
  userId: string;
  type: 'conversation' | 'configuration' | 'user_data';
  format: 'json' | 'csv' | 'xml' | 'zip';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'validation_failed';
  fileName: string;
  fileUrl: string;
  progress: number; // 0-100
  errors: string[];
  warnings: string[];
  importedCount: number;
  createdAt: Date;
  completedAt?: Date;
  metadata: Record<string, any>;
}

export interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  type: ExportJob['type'];
  format: ExportJob['format'];
  fields: string[]; // Fields to include in export
  filters: Record<string, any>;
  transformations: Record<string, (value: any) => any>; // Field transformations
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
}

export interface ValidationSchema {
  type: 'conversation' | 'configuration' | 'user_data';
  requiredFields: string[];
  fieldValidators: Record<string, (value: any) => boolean | Promise<boolean>>;
  customValidator?: (data: any) => boolean | Promise<boolean>;
}

export interface DataTransformation {
  sourceFormat: string;
  targetFormat: string;
  transformFn: (data: any) => any;
  validation?: ValidationSchema;
}

export class ExportImportSystem {
  private exportJobs: Map<string, ExportJob>;
  private importJobs: Map<string, ImportJob>;
  private templates: Map<string, ExportTemplate>;
  private validationSchemas: Map<string, ValidationSchema>;
  private transformations: Map<string, DataTransformation>;
  private logger: Logger;
  private cache: Cache;
  private llmManager: LLMManager;

  constructor() {
    this.exportJobs = new Map();
    this.importJobs = new Map();
    this.templates = new Map();
    this.validationSchemas = new Map();
    this.transformations = new Map();
    this.logger = new Logger('ExportImportSystem');
    this.cache = new Cache();
    this.llmManager = new LLMManager();
    
    this.initializeDefaultSchemas();
    this.initializeDefaultTransformations();
    this.initializeDefaultTemplates();
  }

  /**
   * Initialize default validation schemas
   */
  private initializeDefaultSchemas(): void {
    // Conversation validation schema
    this.validationSchemas.set('conversation', {
      type: 'conversation',
      requiredFields: ['userId', 'messages', 'createdAt'],
      fieldValidators: {
        userId: (value) => typeof value === 'string' && value.length > 0,
        messages: (value) => Array.isArray(value) && value.length > 0,
        createdAt: (value) => value instanceof Date || typeof value === 'string'
      }
    });

    // Configuration validation schema
    this.validationSchemas.set('configuration', {
      type: 'configuration',
      requiredFields: ['userId', 'config'],
      fieldValidators: {
        userId: (value) => typeof value === 'string' && value.length > 0,
        config: (value) => typeof value === 'object' && value !== null
      }
    });

    // User data validation schema
    this.validationSchemas.set('user_data', {
      type: 'user_data',
      requiredFields: ['id', 'email'],
      fieldValidators: {
        id: (value) => typeof value === 'string' && value.length > 0,
        email: (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      }
    });
  }

  /**
   * Initialize default data transformations
   */
  private initializeDefaultTransformations(): void {
    // JSON to CSV transformation
    this.transformations.set('json-csv', {
      sourceFormat: 'json',
      targetFormat: 'csv',
      transformFn: (data: any) => this.jsonToCsv(data),
      validation: this.validationSchemas.get('conversation')!
    });

    // CSV to JSON transformation
    this.transformations.set('csv-json', {
      sourceFormat: 'csv',
      targetFormat: 'json',
      transformFn: (data: any) => this.csvToJson(data),
      validation: this.validationSchemas.get('conversation')!
    });

    // JSON to XML transformation
    this.transformations.set('json-xml', {
      sourceFormat: 'json',
      targetFormat: 'xml',
      transformFn: (data: any) => this.jsonToXml(data),
      validation: this.validationSchemas.get('conversation')!
    });
  }

  /**
   * Initialize default export templates
   */
  private initializeDefaultTemplates(): void {
    const defaultTemplates: ExportTemplate[] = [
      {
        id: 'template_conversation_json',
        name: 'Conversation JSON Export',
        description: 'Export conversations in JSON format with full details',
        type: 'conversation',
        format: 'json',
        fields: ['id', 'userId', 'sessionId', 'messages', 'createdAt', 'updatedAt', 'metadata'],
        filters: {},
        transformations: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        isPublic: true
      },
      {
        id: 'template_analytics_csv',
        name: 'Analytics CSV Export',
        description: 'Export analytics data in CSV format for spreadsheet analysis',
        type: 'analytics',
        format: 'csv',
        fields: ['timestamp', 'userId', 'eventType', 'metadata'],
        filters: {},
        transformations: {
          timestamp: (value: any) => new Date(value).toISOString()
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isPublic: true
      },
      {
        id: 'template_config_json',
        name: 'Configuration JSON Export',
        description: 'Export user configuration in JSON format',
        type: 'configuration',
        format: 'json',
        fields: ['userId', 'config', 'createdAt', 'updatedAt'],
        filters: {},
        transformations: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        isPublic: true
      }
    ];

    for (const template of defaultTemplates) {
      this.templates.set(template.id, template);
    }
  }

  /**
   * Create a new export job
   */
  async createExportJob(
    userId: string,
    type: ExportJob['type'],
    format: ExportJob['format'],
    filters?: Record<string, any>,
    templateId?: string
  ): Promise<ExportJob> {
    let exportTemplate: ExportTemplate | undefined;
    if (templateId) {
      exportTemplate = this.templates.get(templateId);
      if (!exportTemplate) {
        throw new Error(`Export template not found: ${templateId}`);
      }
      type = exportTemplate.type;
      format = exportTemplate.format;
    }

    const exportJob: ExportJob = {
      id: `export_${Date.now()}_${uuidv4().substr(0, 8)}`,
      userId,
      type,
      format,
      status: 'pending',
      filters: { ...filters, ...exportTemplate?.filters },
      createdAt: new Date(),
      metadata: {
        templateId,
        fields: exportTemplate?.fields
      }
    };

    this.exportJobs.set(exportJob.id, exportJob);
    this.logger.info(`Export job created: ${exportJob.id} for user ${userId}`);

    // Process the export job asynchronously
    this.processExportJob(exportJob.id);

    return exportJob;
  }

  /**
   * Process an export job
   */
  private async processExportJob(jobId: string): Promise<void> {
    const job = this.exportJobs.get(jobId);
    if (!job) return;

    try {
      job.status = 'processing';
      this.logger.info(`Processing export job: ${jobId}`);

      // Get the data to export based on type
      let data: any;
      switch (job.type) {
        case 'conversation':
          data = await this.getConversationData(job.userId, job.filters);
          break;
        case 'analytics':
          data = await this.getAnalyticsData(job.userId, job.filters);
          break;
        case 'configuration':
          data = await this.getConfigurationData(job.userId, job.filters);
          break;
        case 'user_data':
          data = await this.getUserData(job.userId, job.filters);
          break;
        case 'model_data':
          data = await this.getModelData(job.userId, job.filters);
          break;
        default:
          throw new Error(`Unknown export type: ${job.type}`);
      }

      // Apply template transformations if applicable
      const template = this.templates.get(job.metadata.templateId as string);
      if (template?.transformations) {
        data = this.applyTransformations(data, template.transformations);
      }

      // Format data according to requested format
      let formattedData: string;
      let mimeType: string;
      let extension: string;

      switch (job.format) {
        case 'json':
          formattedData = JSON.stringify(data, null, 2);
          mimeType = 'application/json';
          extension = 'json';
          break;
        case 'csv':
          formattedData = this.jsonToCsv(data);
          mimeType = 'text/csv';
          extension = 'csv';
          break;
        case 'xml':
          formattedData = this.jsonToXml(data);
          mimeType = 'application/xml';
          extension = 'xml';
          break;
        case 'pdf':
          formattedData = await this.generatePdf(data);
          mimeType = 'application/pdf';
          extension = 'pdf';
          break;
        case 'zip':
          formattedData = await this.generateZip(data, job.type);
          mimeType = 'application/zip';
          extension = 'zip';
          break;
        default:
          throw new Error(`Unsupported format: ${job.format}`);
      }

      // Compress data if requested and it's large
      if (job.metadata.compress && formattedData.length > 1024 * 1024) { // > 1MB
        formattedData = await this.compressData(formattedData);
      }

      // Store the formatted data
      const downloadUrl = await this.storeExportData(formattedData, job.id, extension);
      job.downloadUrl = downloadUrl;
      job.size = new Blob([formattedData]).size;
      job.status = 'completed';
      job.completedAt = new Date();

      this.logger.info(`Export job completed: ${jobId}, size: ${job.size} bytes`);
    } catch (error) {
      this.logger.error(`Export job failed: ${jobId}`, error);
      job.status = 'failed';
      job.completedAt = new Date();
    }
  }

  /**
   * Get conversation data for export
   */
  private async getConversationData(userId: string, filters: Record<string, any>): Promise<any> {
    // In a real implementation, this would fetch from the database
    // For now, we'll return mock data
    return {
      userId,
      conversations: [],
      filters,
      exportedAt: new Date()
    };
  }

  /**
   * Get analytics data for export
   */
  private async getAnalyticsData(userId: string, filters: Record<string, any>): Promise<any> {
    // In a real implementation, this would fetch from the analytics system
    // For now, we'll return mock data
    return {
      userId,
      analyticsData: [],
      filters,
      exportedAt: new Date()
    };
  }

  /**
   * Get configuration data for export
   */
  private async getConfigurationData(userId: string, filters: Record<string, any>): Promise<any> {
    // In a real implementation, this would fetch from the configuration system
    // For now, we'll return mock data
    return {
      userId,
      config: {},
      filters,
      exportedAt: new Date()
    };
  }

  /**
   * Get user data for export
   */
  private async getUserData(userId: string, filters: Record<string, any>): Promise<any> {
    // In a real implementation, this would fetch from the user system
    // For now, we'll return mock data
    return {
      userId,
      userData: {},
      filters,
      exportedAt: new Date()
    };
  }

  /**
   * Get model data for export
   */
  private async getModelData(userId: string, filters: Record<string, any>): Promise<any> {
    // In a real implementation, this would fetch from the model management system
    // For now, we'll return mock data
    return {
      userId,
      modelData: {},
      filters,
      exportedAt: new Date()
    };
  }

  /**
   * Apply transformations to data
   */
  private applyTransformations(data: any, transformations: Record<string, (value: any) => any>): any {
    if (Array.isArray(data)) {
      return data.map(item => this.applyObjectTransformations(item, transformations));
    }
    return this.applyObjectTransformations(data, transformations);
  }

  /**
   * Apply transformations to a single object
   */
  private applyObjectTransformations(obj: any, transformations: Record<string, (value: any) => any>): any {
    const result: any = { ...obj };
    
    for (const [field, transformFn] of Object.entries(transformations)) {
      if (result[field] !== undefined) {
        result[field] = transformFn(result[field]);
      }
    }
    
    return result;
  }

  /**
   * Convert JSON to CSV
   */
  private jsonToCsv(data: any): string {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return '';
    }

    // Get headers from first object
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    // Process each row
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header] === null || row[header] === undefined ? '' : row[header];
        // Escape commas and quotes
        const escapedValue = String(value).replace(/"/g, '""');
        return `"${escapedValue}"`;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Convert CSV to JSON
   */
  private csvToJson(csvString: string): any[] {
    const lines = csvString.split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const result: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = this.parseCsvLine(line);
      const obj: any = {};
      
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = values[j] || '';
      }
      
      result.push(obj);
    }

    return result;
  }

  /**
   * Parse a single CSV line, handling quoted values
   */
  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let currentValue = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Double quotes inside quoted field = one quote
          currentValue += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }

    values.push(currentValue.trim());
    return values;
  }

  /**
   * Convert JSON to XML
   */
  private jsonToXml(data: any): string {
    const toXml = (obj: any, level: number = 0): string => {
      const indent = '  '.repeat(level);
      let xml = '';

      if (typeof obj === 'object' && obj !== null) {
        if (Array.isArray(obj)) {
          for (const item of obj) {
            xml += `${indent}<item>\n${toXml(item, level + 1)}${indent}</item>\n`;
          }
        } else {
          for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'object' && value !== null) {
              xml += `${indent}<${key}>\n${toXml(value, level + 1)}${indent}</${key}>\n`;
            } else {
              xml += `${indent}<${key}>${this.escapeXml(String(value))}</${key}>\n`;
            }
          }
        }
      } else {
        xml += `${indent}${this.escapeXml(String(obj))}\n`;
      }

      return xml;
    };

    return `<?xml version="1.0" encoding="UTF-8"?>\n<root>\n${toXml(data, 1)}</root>`;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Generate PDF from data (mock implementation)
   */
  private async generatePdf(data: any): Promise<string> {
    // In a real implementation, this would use a PDF generation library
    // For now, return a mock response
    return JSON.stringify({
      pdfGenerated: true,
      contentPreview: JSON.stringify(data, null, 2).substring(0, 200) + '...'
    });
  }

  /**
   * Generate ZIP archive from data
   */
  private async generateZip(data: any, dataType: string): Promise<string> {
    const zip = new JSZip();
    
    // Add the main data file
    zip.file(`${dataType}_export.json`, JSON.stringify(data, null, 2));
    
    // Add metadata file
    zip.file('metadata.json', JSON.stringify({
      dataType,
      exportedAt: new Date().toISOString(),
      format: 'zip'
    }, null, 2));
    
    // Add README file
    zip.file('README.txt', 'This is an export from RealMultiLLM\n\nFor more information, visit our documentation.');
    
    // Generate the zip as a base64 string
    const content = await zip.generateAsync({ type: 'base64' });
    return content;
  }

  /**
   * Compress data using a compression algorithm
   */
  private async compressData(data: string): Promise<string> {
    // In a real implementation, this would use compression
    // For now, return the original data with a mock compression indicator
    return data; // Placeholder
  }

  /**
   * Store export data and return download URL
   */
  private async storeExportData(data: string, jobId: string, format: string): Promise<string> {
    // In a real implementation, this would store data in a file system or cloud storage
    // For now, we'll store in cache with a TTL
    const key = `export:${jobId}`;
    await this.cache.set(key, data, 60 * 60 * 24 * 7); // 1 week
    
    // Return a mock download URL
    return `/api/downloads/${jobId}.${format}`;
  }

  /**
   * Create a new import job
   */
  async createImportJob(
    userId: string,
    type: ImportJob['type'],
    format: ImportJob['format'],
    fileUrl: string,
    fileName: string
  ): Promise<ImportJob> {
    const importJob: ImportJob = {
      id: `import_${Date.now()}_${uuidv4().substr(0, 8)}`,
      userId,
      type,
      format,
      status: 'pending',
      fileName,
      fileUrl,
      progress: 0,
      errors: [],
      warnings: [],
      importedCount: 0,
      createdAt: new Date(),
      metadata: {}
    };

    this.importJobs.set(importJob.id, importJob);
    this.logger.info(`Import job created: ${importJob.id} for user ${userId}`);

    // Process the import job asynchronously
    this.processImportJob(importJob.id);

    return importJob;
  }

  /**
   * Process an import job
   */
  private async processImportJob(jobId: string): Promise<void> {
    const job = this.importJobs.get(jobId);
    if (!job) return;

    try {
      job.status = 'processing';
      this.logger.info(`Processing import job: ${jobId}`);

      // Download and read the file
      const fileContent = await this.downloadFile(job.fileUrl);
      job.progress = 10;

      // Parse the file based on format
      let parsedData: any;
      switch (job.format) {
        case 'json':
          parsedData = JSON.parse(fileContent);
          break;
        case 'csv':
          parsedData = this.csvToJson(fileContent);
          break;
        case 'xml':
          parsedData = this.xmlToJson(fileContent);
          break;
        case 'zip':
          parsedData = await this.parseZip(fileContent);
          break;
        default:
          throw new Error(`Unsupported import format: ${job.format}`);
      }
      job.progress = 30;

      // Validate the data
      const schema = this.validationSchemas.get(job.type);
      if (schema) {
        const validationResult = await this.validateData(parsedData, schema, job);
        if (!validationResult.valid) {
          job.status = 'validation_failed';
          job.errors = validationResult.errors;
          job.completedAt = new Date();
          return;
        }
      }
      job.progress = 60;

      // Transform the data if needed
      const transformationKey = `${job.format}-${job.type}`;
      const transformation = this.transformations.get(transformationKey);
      if (transformation) {
        parsedData = transformation.transformFn(parsedData);
      }
      job.progress = 80;

      // Import the data
      const importResult = await this.importData(parsedData, job.type, job.userId);
      job.importedCount = importResult.count;
      job.warnings = importResult.warnings;
      job.progress = 100;

      job.status = 'completed';
      job.completedAt = new Date();

      this.logger.info(`Import job completed: ${jobId}, imported ${job.importedCount} items`);
    } catch (error) {
      this.logger.error(`Import job failed: ${jobId}`, error);
      job.status = 'failed';
      job.errors = [...job.errors, error.message];
      job.completedAt = new Date();
    }
  }

  /**
   * Download file from URL
   */
  private async downloadFile(url: string): Promise<string> {
    // In a real implementation, this would download the file from the URL
    // For now, return mock data
    return JSON.stringify({ mock: 'data' });
  }

  /**
   * Convert XML to JSON
   */
  private xmlToJson(xmlString: string): any {
    // In a real implementation, this would use an XML parser
    // For now, return a mock conversion
    return { xmlConverted: true, original: xmlString.substring(0, 100) + '...' };
  }

  /**
   * Parse ZIP file content
   */
  private async parseZip(zipContent: string): Promise<any> {
    // In a real implementation, this would parse the ZIP content
    // For now, return mock data
    return { zipParsed: true, contentPreview: zipContent.substring(0, 100) + '...' };
  }

  /**
   * Validate data against schema
   */
  private async validateData(data: any, schema: ValidationSchema, job: ImportJob): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check required fields if data is an object
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      for (const field of schema.requiredFields) {
        if (data[field] === undefined || data[field] === null) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    } 
    // If data is an array, validate each item
    else if (Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        for (const field of schema.requiredFields) {
          if (data[i][field] === undefined || data[i][field] === null) {
            errors.push(`Missing required field in item ${i}: ${field}`);
          }
        }
      }
    }

    // Run field validators
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      for (const [field, validator] of Object.entries(schema.fieldValidators)) {
        if (data[field] !== undefined) {
          try {
            const isValid = await Promise.resolve(validator(data[field]));
            if (!isValid) {
              errors.push(`Invalid value for field ${field}`);
            }
          } catch (err) {
            errors.push(`Validation error for field ${field}: ${err.message}`);
          }
        }
      }
    } else if (Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        for (const [field, validator] of Object.entries(schema.fieldValidators)) {
          if (data[i][field] !== undefined) {
            try {
              const isValid = await Promise.resolve(validator(data[i][field]));
              if (!isValid) {
                errors.push(`Invalid value for field ${field} in item ${i}`);
              }
            } catch (err) {
              errors.push(`Validation error for field ${field} in item ${i}: ${err.message}`);
            }
          }
        }
      }
    }

    // Run custom validator if provided
    if (schema.customValidator) {
      try {
        const isValid = await Promise.resolve(schema.customValidator(data));
        if (!isValid) {
          errors.push('Custom validation failed');
        }
      } catch (err) {
        errors.push(`Custom validation error: ${err.message}`);
      }
    }

    job.warnings = [...job.warnings, ...errors.filter(e => e.startsWith('Warning: '))];
    const filteredErrors = errors.filter(e => !e.startsWith('Warning: '));

    return {
      valid: filteredErrors.length === 0,
      errors: filteredErrors
    };
  }

  /**
   * Import data into the system
   */
  private async importData(data: any, type: ImportJob['type'], userId: string): Promise<{ count: number; warnings: string[] }> {
    let count = 0;
    const warnings: string[] = [];

    switch (type) {
      case 'conversation':
        // Import conversations
        if (Array.isArray(data)) {
          for (const conv of data) {
            // In a real implementation, this would save to database
            count++;
          }
        } else {
          // Import single conversation
          // In a real implementation, this would save to database
          count = 1;
        }
        break;

      case 'configuration':
        // Import configurations
        if (Array.isArray(data)) {
          for (const config of data) {
            // In a real implementation, this would save to database
            count++;
          }
        } else {
          // Import single configuration
          // In a real implementation, this would save to database
          count = 1;
        }
        break;

      case 'user_data':
        // Import user data
        if (Array.isArray(data)) {
          for (const user of data) {
            // In a real implementation, this would save to database
            count++;
          }
        } else {
          // Import single user
          // In a real implementation, this would save to database
          count = 1;
        }
        break;

      default:
        warnings.push(`Unknown import type: ${type}`);
        return { count: 0, warnings };
    }

    return { count, warnings };
  }

  /**
   * Get export job by ID
   */
  getExportJob(jobId: string): ExportJob | undefined {
    return this.exportJobs.get(jobId);
  }

  /**
   * Get import job by ID
   */
  getImportJob(jobId: string): ImportJob | undefined {
    return this.importJobs.get(jobId);
  }

  /**
   * Get all export jobs for a user
   */
  getUserExportJobs(userId: string): ExportJob[] {
    return Array.from(this.exportJobs.values()).filter(job => job.userId === userId);
  }

  /**
   * Get all import jobs for a user
   */
  getUserImportJobs(userId: string): ImportJob[] {
    return Array.from(this.importJobs.values()).filter(job => job.userId === userId);
  }

  /**
   * Create a new export template
   */
  createExportTemplate(template: Omit<ExportTemplate, 'id' | 'createdAt' | 'updatedAt'>): ExportTemplate {
    const newTemplate: ExportTemplate = {
      ...template,
      id: `template_${Date.now()}_${uuidv4().substr(0, 8)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.templates.set(newTemplate.id, newTemplate);
    this.logger.info(`Export template created: ${newTemplate.name}`);
    return newTemplate;
  }

  /**
   * Get export template by ID
   */
  getExportTemplate(templateId: string): ExportTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Get all export templates
   */
  getExportTemplates(isPublic?: boolean): ExportTemplate[] {
    let templates = Array.from(this.templates.values());
    
    if (isPublic !== undefined) {
      templates = templates.filter(t => t.isPublic === isPublic);
    }
    
    return templates;
  }

  /**
   * Delete an export job
   */
  deleteExportJob(jobId: string): boolean {
    return this.exportJobs.delete(jobId);
  }

  /**
   * Delete an import job
   */
  deleteImportJob(jobId: string): boolean {
    return this.importJobs.delete(jobId);
  }

  /**
   * Get system statistics
   */
  getStats(): {
    totalExportJobs: number;
    totalImportJobs: number;
    exportJobsByType: Record<string, number>;
    importJobsByType: Record<string, number>;
    totalTemplates: number;
    totalDataProcessed: number; // Approximate
  } {
    const exportJobs = Array.from(this.exportJobs.values());
    const importJobs = Array.from(this.importJobs.values());
    
    // Count by type
    const exportJobsByType: Record<string, number> = {};
    const importJobsByType: Record<string, number> = {};
    
    for (const job of exportJobs) {
      exportJobsByType[job.type] = (exportJobsByType[job.type] || 0) + 1;
    }
    
    for (const job of importJobs) {
      importJobsByType[job.type] = (importJobsByType[job.type] || 0) + 1;
    }

    return {
      totalExportJobs: exportJobs.length,
      totalImportJobs: importJobs.length,
      exportJobsByType,
      importJobsByType,
      totalTemplates: this.templates.size,
      totalDataProcessed: exportJobs.filter(j => j.size).reduce((sum, j) => sum + (j.size || 0), 0)
    };
  }

  /**
   * Register a custom validation schema
   */
  registerValidationSchema(schema: ValidationSchema): void {
    this.validationSchemas.set(schema.type, schema);
    this.logger.info(`Validation schema registered: ${schema.type}`);
  }

  /**
   * Register a custom data transformation
   */
  registerDataTransformation(transformation: DataTransformation): void {
    const key = `${transformation.sourceFormat}-${transformation.targetFormat}`;
    this.transformations.set(key, transformation);
    this.logger.info(`Data transformation registered: ${key}`);
  }

  /**
   * Export system data for backup
   */
  async exportSystemBackup(): Promise<string> {
    const backupData = {
      exportJobs: Array.from(this.exportJobs.values()),
      importJobs: Array.from(this.importJobs.values()),
      templates: Array.from(this.templates.values()),
      schemas: Object.fromEntries(this.validationSchemas),
      transformations: Object.fromEntries(this.transformations),
      exportedAt: new Date().toISOString()
    };

    const zip = new JSZip();
    zip.file('backup.json', JSON.stringify(backupData, null, 2));
    
    const content = await zip.generateAsync({ type: 'base64' });
    return content;
  }

  /**
   * Import system data from backup
   */
  async importSystemBackup(backupData: string): Promise<boolean> {
    try {
      // In a real implementation, this would validate and import backup data
      // For now, return true as a placeholder
      this.logger.info('System backup import completed');
      return true;
    } catch (error) {
      this.logger.error('System backup import failed:', error);
      return false;
    }
  }
}

// Export/Import utilities
export class ExportImportUtils {
  /**
   * Format bytes to human-readable format
   */
  static formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Validate file type based on extension
   */
  static validateFileType(fileName: string, allowedTypes: string[]): { valid: boolean; type: string | null } {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (!extension) return { valid: false, type: null };

    const matchedType = allowedTypes.find(t => t === extension);
    return { valid: !!matchedType, type: matchedType || null };
  }

  /**
   * Estimate import time based on file size
   */
  static estimateImportTime(fileSize: number, type: 'conversation' | 'configuration' | 'user_data'): number {
    // Rough estimates in seconds
    const baseTime = 5; // 5 seconds base time
    
    if (type === 'conversation') {
      // Conversations are typically larger and more complex
      return baseTime + Math.ceil(fileSize / (1024 * 1024)); // Additional second per MB
    } else if (type === 'configuration') {
      // Configurations are typically smaller
      return baseTime + Math.ceil(fileSize / (1024 * 1024 * 10)); // Additional second per 10MB
    } else {
      // User data is moderate
      return baseTime + Math.ceil(fileSize / (1024 * 1024 * 5)); // Additional second per 5MB
    }
  }
}