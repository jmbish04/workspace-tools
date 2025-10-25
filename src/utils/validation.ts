/**
 * @module validation
 * @description Input validation utilities for API endpoints.
 * This module provides functions for validating request parameters, sanitizing inputs,
 * and ensuring data integrity across the workspace tools API.
 */

/**
 * Validation error interface
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedData?: any;
}

/**
 * Validates email address format
 * @param email The email address to validate
 * @returns boolean indicating if the email is valid
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates Google document ID format
 * @param documentId The document ID to validate
 * @returns boolean indicating if the document ID is valid
 */
export function isValidDocumentId(documentId: string): boolean {
  // Google document IDs are typically 44 characters long and contain alphanumeric characters and hyphens
  const documentIdRegex = /^[a-zA-Z0-9_-]{20,50}$/;
  return documentIdRegex.test(documentId);
}

/**
 * Validates Gmail message ID format
 * @param messageId The message ID to validate
 * @returns boolean indicating if the message ID is valid
 */
export function isValidMessageId(messageId: string): boolean {
  // Gmail message IDs are typically 16-20 characters long and contain alphanumeric characters
  const messageIdRegex = /^[a-zA-Z0-9]{16,20}$/;
  return messageIdRegex.test(messageId);
}

/**
 * Validates thread ID format
 * @param threadId The thread ID to validate
 * @returns boolean indicating if the thread ID is valid
 */
export function isValidThreadId(threadId: string): boolean {
  // Thread IDs are similar to message IDs
  const threadIdRegex = /^[a-zA-Z0-9]{16,20}$/;
  return threadIdRegex.test(threadId);
}

/**
 * Validates presentation ID format
 * @param presentationId The presentation ID to validate
 * @returns boolean indicating if the presentation ID is valid
 */
export function isValidPresentationId(presentationId: string): boolean {
  // Presentation IDs are similar to document IDs
  const presentationIdRegex = /^[a-zA-Z0-9_-]{20,50}$/;
  return presentationIdRegex.test(presentationId);
}

/**
 * Validates spreadsheet ID format
 * @param spreadsheetId The spreadsheet ID to validate
 * @returns boolean indicating if the spreadsheet ID is valid
 */
export function isValidSpreadsheetId(spreadsheetId: string): boolean {
  // Spreadsheet IDs are similar to document IDs
  const spreadsheetIdRegex = /^[a-zA-Z0-9_-]{20,50}$/;
  return spreadsheetIdRegex.test(spreadsheetId);
}

/**
 * Validates slide index
 * @param slideIndex The slide index to validate
 * @returns boolean indicating if the slide index is valid
 */
export function isValidSlideIndex(slideIndex: number): boolean {
  return Number.isInteger(slideIndex) && slideIndex >= 0;
}

/**
 * Validates max results parameter
 * @param maxResults The max results value to validate
 * @returns boolean indicating if the max results is valid
 */
export function isValidMaxResults(maxResults: number): boolean {
  return Number.isInteger(maxResults) && maxResults > 0 && maxResults <= 100;
}

/**
 * Validates page size parameter
 * @param pageSize The page size value to validate
 * @returns boolean indicating if the page size is valid
 */
export function isValidPageSize(pageSize: number): boolean {
  return Number.isInteger(pageSize) && pageSize > 0 && pageSize <= 1000;
}

/**
 * Validates tone parameter
 * @param tone The tone value to validate
 * @returns boolean indicating if the tone is valid
 */
export function isValidTone(tone: string): boolean {
  const validTones = ['professional', 'casual', 'formal', 'diplomatic', 'direct', 'polite', 'assertive'];
  return validTones.includes(tone.toLowerCase());
}

/**
 * Validates provider name
 * @param provider The provider name to validate
 * @returns boolean indicating if the provider is valid
 */
export function isValidProvider(provider: string): boolean {
  const validProviders = ['gemini', 'anthropic', 'openai', 'workersAI'];
  return validProviders.includes(provider.toLowerCase());
}

/**
 * Validates array of provider names
 * @param providers The array of provider names to validate
 * @returns boolean indicating if all providers are valid
 */
export function isValidProviderArray(providers: string[]): boolean {
  return Array.isArray(providers) && providers.length > 0 && providers.every(provider => isValidProvider(provider));
}

/**
 * Sanitizes text input by removing potentially harmful characters
 * @param text The text to sanitize
 * @returns The sanitized text
 */
export function sanitizeText(text: string): string {
  if (typeof text !== 'string') return '';
  
  return text
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim()
    .substring(0, 10000); // Limit length
}

/**
 * Sanitizes HTML content
 * @param html The HTML content to sanitize
 * @returns The sanitized HTML
 */
export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string') return '';
  
  // Basic HTML sanitization - remove script tags and dangerous attributes
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/on\w+="[^"]*"/gi, '') // Remove event handlers
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .substring(0, 50000); // Limit length
}

/**
 * Validates Gmail search query
 * @param query The search query to validate
 * @returns ValidationResult with validation status and errors
 */
export function validateGmailSearchQuery(query: string): ValidationResult {
  const errors: ValidationError[] = [];
  
  if (!query || typeof query !== 'string') {
    errors.push({
      field: 'query',
      message: 'Search query is required and must be a string',
      code: 'MISSING_QUERY'
    });
    return { isValid: false, errors };
  }
  
  const sanitizedQuery = sanitizeText(query);
  
  if (sanitizedQuery.length === 0) {
    errors.push({
      field: 'query',
      message: 'Search query cannot be empty after sanitization',
      code: 'EMPTY_QUERY'
    });
  }
  
  if (sanitizedQuery.length > 1000) {
    errors.push({
      field: 'query',
      message: 'Search query is too long (max 1000 characters)',
      code: 'QUERY_TOO_LONG'
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: { query: sanitizedQuery }
  };
}

/**
 * Validates document read request
 * @param data The request data to validate
 * @returns ValidationResult with validation status and errors
 */
export function validateDocumentReadRequest(data: any): ValidationResult {
  const errors: ValidationError[] = [];
  
  if (!data.documentId || typeof data.documentId !== 'string') {
    errors.push({
      field: 'documentId',
      message: 'Document ID is required and must be a string',
      code: 'MISSING_DOCUMENT_ID'
    });
  } else if (!isValidDocumentId(data.documentId)) {
    errors.push({
      field: 'documentId',
      message: 'Invalid document ID format',
      code: 'INVALID_DOCUMENT_ID'
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: {
      documentId: data.documentId,
      user: data.user ? sanitizeText(data.user) : undefined
    }
  };
}

/**
 * Validates Gmail message request
 * @param data The request data to validate
 * @returns ValidationResult with validation status and errors
 */
export function validateGmailMessageRequest(data: any): ValidationResult {
  const errors: ValidationError[] = [];
  
  if (!data.messageId || typeof data.messageId !== 'string') {
    errors.push({
      field: 'messageId',
      message: 'Message ID is required and must be a string',
      code: 'MISSING_MESSAGE_ID'
    });
  } else if (!isValidMessageId(data.messageId)) {
    errors.push({
      field: 'messageId',
      message: 'Invalid message ID format',
      code: 'INVALID_MESSAGE_ID'
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: {
      messageId: data.messageId,
      user: data.user ? sanitizeText(data.user) : undefined
    }
  };
}

/**
 * Validates email draft request
 * @param data The request data to validate
 * @returns ValidationResult with validation status and errors
 */
export function validateEmailDraftRequest(data: any): ValidationResult {
  const errors: ValidationError[] = [];
  
  if (!data.to || typeof data.to !== 'string') {
    errors.push({
      field: 'to',
      message: 'Recipient email is required and must be a string',
      code: 'MISSING_RECIPIENT'
    });
  } else if (!isValidEmail(data.to)) {
    errors.push({
      field: 'to',
      message: 'Invalid recipient email format',
      code: 'INVALID_RECIPIENT_EMAIL'
    });
  }
  
  if (!data.subject || typeof data.subject !== 'string') {
    errors.push({
      field: 'subject',
      message: 'Subject is required and must be a string',
      code: 'MISSING_SUBJECT'
    });
  } else {
    const sanitizedSubject = sanitizeText(data.subject);
    if (sanitizedSubject.length === 0) {
      errors.push({
        field: 'subject',
        message: 'Subject cannot be empty after sanitization',
        code: 'EMPTY_SUBJECT'
      });
    } else if (sanitizedSubject.length > 200) {
      errors.push({
        field: 'subject',
        message: 'Subject is too long (max 200 characters)',
        code: 'SUBJECT_TOO_LONG'
      });
    }
  }
  
  // Validate CC and BCC if provided
  if (data.cc && typeof data.cc === 'string') {
    if (!isValidEmail(data.cc)) {
      errors.push({
        field: 'cc',
        message: 'Invalid CC email format',
        code: 'INVALID_CC_EMAIL'
      });
    }
  }
  
  if (data.bcc && typeof data.bcc === 'string') {
    if (!isValidEmail(data.bcc)) {
      errors.push({
        field: 'bcc',
        message: 'Invalid BCC email format',
        code: 'INVALID_BCC_EMAIL'
      });
    }
  }
  
  // Validate AI options if provided
  if (data.aiOptions) {
    if (data.aiOptions.providers && !isValidProviderArray(data.aiOptions.providers)) {
      errors.push({
        field: 'aiOptions.providers',
        message: 'Invalid AI providers specified',
        code: 'INVALID_AI_PROVIDERS'
      });
    }
    
    if (data.aiOptions.tone && !isValidTone(data.aiOptions.tone)) {
      errors.push({
        field: 'aiOptions.tone',
        message: 'Invalid tone specified',
        code: 'INVALID_TONE'
      });
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: {
      to: data.to,
      subject: sanitizeText(data.subject),
      text: data.text ? sanitizeText(data.text) : undefined,
      cc: data.cc ? sanitizeText(data.cc) : undefined,
      bcc: data.bcc ? sanitizeText(data.bcc) : undefined,
      user: data.user ? sanitizeText(data.user) : undefined,
      useAI: Boolean(data.useAI),
      aiOptions: data.aiOptions ? {
        ...data.aiOptions,
        context: data.aiOptions.context ? sanitizeText(data.aiOptions.context) : undefined,
        additionalInstructions: data.aiOptions.additionalInstructions ? sanitizeText(data.aiOptions.additionalInstructions) : undefined
      } : undefined
    }
  };
}

/**
 * Validates comment creation request
 * @param data The request data to validate
 * @returns ValidationResult with validation status and errors
 */
export function validateCommentRequest(data: any): ValidationResult {
  const errors: ValidationError[] = [];
  
  if (!data.comment || typeof data.comment !== 'string') {
    errors.push({
      field: 'comment',
      message: 'Comment content is required and must be a string',
      code: 'MISSING_COMMENT'
    });
  } else {
    const sanitizedComment = sanitizeText(data.comment);
    if (sanitizedComment.length === 0) {
      errors.push({
        field: 'comment',
        message: 'Comment cannot be empty after sanitization',
        code: 'EMPTY_COMMENT'
      });
    } else if (sanitizedComment.length > 2000) {
      errors.push({
        field: 'comment',
        message: 'Comment is too long (max 2000 characters)',
        code: 'COMMENT_TOO_LONG'
      });
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: {
      comment: sanitizeText(data.comment),
      textToComment: data.textToComment ? sanitizeText(data.textToComment) : undefined,
      user: data.user ? sanitizeText(data.user) : undefined
    }
  };
}

/**
 * Validates presentation request
 * @param data The request data to validate
 * @returns ValidationResult with validation status and errors
 */
export function validatePresentationRequest(data: any): ValidationResult {
  const errors: ValidationError[] = [];
  
  if (!data.presentationId || typeof data.presentationId !== 'string') {
    errors.push({
      field: 'presentationId',
      message: 'Presentation ID is required and must be a string',
      code: 'MISSING_PRESENTATION_ID'
    });
  } else if (!isValidPresentationId(data.presentationId)) {
    errors.push({
      field: 'presentationId',
      message: 'Invalid presentation ID format',
      code: 'INVALID_PRESENTATION_ID'
    });
  }
  
  if (data.slideIndex !== undefined && !isValidSlideIndex(data.slideIndex)) {
    errors.push({
      field: 'slideIndex',
      message: 'Invalid slide index (must be a non-negative integer)',
      code: 'INVALID_SLIDE_INDEX'
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: {
      presentationId: data.presentationId,
      slideIndex: data.slideIndex,
      user: data.user ? sanitizeText(data.user) : undefined
    }
  };
}

/**
 * Validates spreadsheet request
 * @param data The request data to validate
 * @returns ValidationResult with validation status and errors
 */
export function validateSpreadsheetRequest(data: any): ValidationResult {
  const errors: ValidationError[] = [];
  
  if (!data.spreadsheetId || typeof data.spreadsheetId !== 'string') {
    errors.push({
      field: 'spreadsheetId',
      message: 'Spreadsheet ID is required and must be a string',
      code: 'MISSING_SPREADSHEET_ID'
    });
  } else if (!isValidSpreadsheetId(data.spreadsheetId)) {
    errors.push({
      field: 'spreadsheetId',
      message: 'Invalid spreadsheet ID format',
      code: 'INVALID_SPREADSHEET_ID'
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: {
      spreadsheetId: data.spreadsheetId,
      user: data.user ? sanitizeText(data.user) : undefined
    }
  };
}
