/**
 * Comprehensive Logging Utility for Workspace Tools Worker
 * Provides structured logging with different levels and context
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  email?: string;
  threadId?: string;
  endpoint?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  operation?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: LogContext;
  data?: any;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
  performance?: {
    duration?: number;
    startTime?: number;
    endTime?: number;
  };
}

export class Logger {
  protected context: LogContext = {};
  protected startTime: number = 0;

  constructor(initialContext: LogContext = {}) {
    this.context = initialContext;
  }

  /**
   * Set additional context for all subsequent logs
   */
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Start timing for performance logging
   */
  startTimer(): void {
    this.startTime = Date.now();
  }

  /**
   * Get elapsed time since startTimer was called
   */
  getElapsedTime(): number {
    return this.startTime > 0 ? Date.now() - this.startTime : 0;
  }

  /**
   * Create a new logger instance with additional context
   */
  child(context: LogContext): Logger {
    const childLogger = new Logger({ ...this.context, ...context });
    childLogger.startTime = this.startTime;
    return childLogger;
  }

  /**
   * Debug level logging
   */
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Info level logging
   */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Warning level logging
   */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Error level logging
   */
  error(message: string, error?: Error | any, data?: any): void {
    const errorData = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : error;

    this.log(LogLevel.ERROR, message, data, errorData);
  }

  /**
   * Log Google API interaction
   */
  googleApiCall(service: string, method: string, endpoint: string): void {
    this.info(`🌐 Google API: ${service}/${method}`, {
      service,
      method,
      endpoint,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log Google API completion
   */
  googleApiComplete(service: string, method: string, success: boolean, duration: number): void {
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    const emoji = success ? '✅' : '❌';
    
    this.log(level, `${emoji} Google API completed: ${service}/${method}`, {
      service,
      method,
      success,
      duration: `${duration}ms`
    });
  }

  /**
   * Log Gmail operation
   */
  gmailOperation(operation: string, messageCount?: number, threadId?: string): void {
    this.info(`📧 Gmail ${operation}`, {
      operation,
      messageCount,
      threadId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log Google Drive operation
   */
  driveOperation(operation: string, fileId?: string, fileName?: string): void {
    this.info(`📁 Drive ${operation}`, {
      operation,
      fileId,
      fileName,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log Apps Script execution
   */
  appsScriptExecution(scriptName: string, functionName: string, params?: any): void {
    this.info(`⚡ Apps Script: ${scriptName}/${functionName}`, {
      script: scriptName,
      function: functionName,
      paramCount: params ? Object.keys(params).length : 0
    });
  }

  /**
   * Log database operation
   */
  dbOperation(operation: string, table?: string, recordCount?: number): void {
    this.debug(`🗄️ Database ${operation}`, {
      operation,
      table,
      recordCount,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log authentication event
   */
  authEvent(event: string, userId?: string, success?: boolean): void {
    const level = success === false ? LogLevel.WARN : LogLevel.INFO;
    const emoji = success === false ? '🚫' : '🔐';
    
    this.log(level, `${emoji} Auth ${event}`, {
      event,
      userId,
      success,
      ip: this.context.ip,
      userAgent: this.context.userAgent
    });
  }

  /**
   * Log spam detection event
   */
  spamDetection(result: string, confidence?: number, threadId?: string): void {
    const emoji = result === 'spam' ? '🚨' : result === 'suspicious' ? '⚠️' : '✅';
    
    this.info(`${emoji} Spam detection: ${result}`, {
      result,
      confidence,
      threadId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log thread processing
   */
  threadProcessing(operation: string, threadId: string, messageCount?: number): void {
    this.info(`🧵 Thread processing: ${operation}`, {
      operation,
      threadId,
      messageCount,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log request start
   */
  requestStart(method: string, path: string, headers?: Record<string, string>): void {
    this.startTimer();
    this.setContext({
      method,
      endpoint: path,
      userAgent: headers?.['user-agent'],
      requestId: this.generateRequestId()
    });
    
    this.info(`🚀 Workspace request started: ${method} ${path}`, {
      headers: this.sanitizeHeaders(headers),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log request completion
   */
  requestEnd(statusCode: number, responseData?: any): void {
    const duration = this.getElapsedTime();
    const level = statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    const emoji = statusCode >= 500 ? '💥' : statusCode >= 400 ? '⚠️' : '✅';
    
    this.log(level, `${emoji} Workspace request completed: ${statusCode}`, {
      statusCode,
      duration: `${duration}ms`,
      response: this.sanitizeResponseData(responseData)
    }, undefined, { duration, startTime: this.startTime, endTime: Date.now() });
  }

  /**
   * Core logging method
   */
  protected log(
    level: LogLevel, 
    message: string, 
    data?: any, 
    error?: any, 
    performance?: any
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      context: Object.keys(this.context).length > 0 ? this.context : undefined,
      data: data ? this.sanitizeData(data) : undefined,
      error,
      performance
    };

    // Use different console methods based on level
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(this.formatLogEntry(entry));
        break;
      case LogLevel.INFO:
        console.info(this.formatLogEntry(entry));
        break;
      case LogLevel.WARN:
        console.warn(this.formatLogEntry(entry));
        break;
      case LogLevel.ERROR:
        console.error(this.formatLogEntry(entry));
        break;
    }
  }

  /**
   * Format log entry for console output
   */
  private formatLogEntry(entry: LogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.level}]`,
      `[WORKSPACE]`,
      entry.context?.requestId ? `[${entry.context.requestId}]` : '',
      entry.context?.userId ? `[${entry.context.userId}]` : '',
      entry.message
    ].filter(Boolean);

    let logLine = parts.join(' ');

    // Add structured data
    if (entry.data || entry.context || entry.error || entry.performance) {
      const additionalData: any = {};
      
      if (entry.context) additionalData.context = entry.context;
      if (entry.data) additionalData.data = entry.data;
      if (entry.error) additionalData.error = entry.error;
      if (entry.performance) additionalData.performance = entry.performance;

      logLine += ` ${JSON.stringify(additionalData)}`;
    }

    return logLine;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  /**
   * Sanitize headers to remove sensitive information
   */
  private sanitizeHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
    if (!headers) return undefined;

    const sanitized: Record<string, string> = {};
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-google-token'];

    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize response data
   */
  private sanitizeResponseData(data?: any): any {
    if (!data) return undefined;
    if (typeof data !== 'object') return data;

    const sanitized: any = {};
    
    if (data.success !== undefined) sanitized.success = data.success;
    if (data.error) sanitized.error = typeof data.error === 'string' ? data.error : '[ERROR_OBJECT]';
    if (data.count !== undefined) sanitized.count = data.count;
    if (data.messageCount) sanitized.messageCount = data.messageCount;
    if (Array.isArray(data)) sanitized.arrayLength = data.length;

    return Object.keys(sanitized).length > 0 ? sanitized : '[RESPONSE_DATA]';
  }

  /**
   * Sanitize general data
   */
  private sanitizeData(data: any): any {
    if (typeof data !== 'object' || data === null) return data;

    const sanitized: any = Array.isArray(data) ? [] : {};
    
    for (const [key, value] of Object.entries(data)) {
      if (typeof key === 'string' && 
          (key.toLowerCase().includes('password') || 
           key.toLowerCase().includes('secret') || 
           key.toLowerCase().includes('key') ||
           key.toLowerCase().includes('token') ||
           key.toLowerCase().includes('auth'))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string' && value.length > 500) {
        sanitized[key] = `${value.substring(0, 200)}...`;
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

/**
 * Create a logger instance with context
 */
export function createLogger(context: LogContext = {}): Logger {
  return new Logger(context);
}

/**
 * Create a logger from Hono context
 */
export function createLoggerFromContext(c: any): Logger {
  const headers = Object.fromEntries(c.req.raw.headers.entries());
  
  return createLogger({
    method: c.req.method,
    endpoint: c.req.path,
    userAgent: headers['user-agent'],
    ip: headers['cf-connecting-ip'] || headers['x-forwarded-for'],
    requestId: `ws_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`
  });
}
