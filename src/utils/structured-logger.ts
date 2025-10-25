/**
 * @module structured-logger
 * @description Enhanced structured logging solution for production use.
 * This module provides a more robust logging system with structured data,
 * log levels, and better monitoring capabilities.
 */

/**
 * Log levels enum
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

/**
 * Log entry interface
 */
export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: Record<string, any>;
  requestId?: string;
  userId?: string;
  service: string;
  version: string;
}

/**
 * Enhanced logger class with structured logging
 */
export class StructuredLogger {
  private service: string;
  private version: string;
  private minLevel: LogLevel;
  private requestId?: string;
  private userId?: string;

  constructor(
    service: string = 'workspace-tools',
    version: string = '1.0.0',
    minLevel: LogLevel = LogLevel.INFO
  ) {
    this.service = service;
    this.version = version;
    this.minLevel = minLevel;
  }

  /**
   * Set request context for logging
   */
  setRequestContext(requestId: string, userId?: string): void {
    this.requestId = requestId;
    this.userId = userId;
  }

  /**
   * Clear request context
   */
  clearRequestContext(): void {
    this.requestId = undefined;
    this.userId = undefined;
  }

  /**
   * Create a log entry
   */
  private createLogEntry(level: LogLevel, message: string, context?: Record<string, any>): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      context,
      requestId: this.requestId,
      userId: this.userId,
      service: this.service,
      version: this.version
    };
  }

  /**
   * Log a message at the specified level
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (level < this.minLevel) return;

    const logEntry = this.createLogEntry(level, message, context);
    
    // Format for console output
    const formattedMessage = this.formatLogEntry(logEntry);
    
    // Use appropriate console method based on level
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formattedMessage);
        break;
    }
  }

  /**
   * Format log entry for console output
   */
  private formatLogEntry(entry: LogEntry): string {
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    const requestStr = entry.requestId ? ` [${entry.requestId}]` : '';
    const userStr = entry.userId ? ` [user:${entry.userId}]` : '';
    
    return `[${entry.timestamp}] ${entry.level}${requestStr}${userStr}: ${entry.message}${contextStr}`;
  }

  /**
   * Debug level logging
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Info level logging
   */
  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Error level logging
   */
  error(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Fatal level logging
   */
  fatal(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.FATAL, message, context);
  }

  /**
   * Log request start
   */
  requestStart(method: string, path: string, headers: Record<string, string>): void {
    this.info('Request started', {
      method,
      path,
      userAgent: headers['user-agent'],
      ip: headers['cf-connecting-ip'] || headers['x-forwarded-for'] || 'unknown'
    });
  }

  /**
   * Log request end
   */
  requestEnd(status: number, duration?: number): void {
    this.info('Request completed', {
      status,
      duration: duration ? `${duration}ms` : undefined
    });
  }

  /**
   * Log API call
   */
  apiCall(service: string, endpoint: string, method: string, status?: number, duration?: number): void {
    this.info('API call', {
      service,
      endpoint,
      method,
      status,
      duration: duration ? `${duration}ms` : undefined
    });
  }

  /**
   * Log authentication event
   */
  authEvent(event: 'success' | 'failure' | 'token_refresh', details?: Record<string, any>): void {
    this.info(`Authentication ${event}`, details);
  }

  /**
   * Log rate limiting event
   */
  rateLimit(identifier: string, limit: number, remaining: number, resetTime: number): void {
    this.warn('Rate limit applied', {
      identifier,
      limit,
      remaining,
      resetTime: new Date(resetTime).toISOString()
    });
  }

  /**
   * Log validation error
   */
  validationError(field: string, message: string, value?: any): void {
    this.warn('Validation error', {
      field,
      message,
      value: value ? String(value).substring(0, 100) : undefined
    });
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, details?: Record<string, any>): void {
    this.info('Performance metric', {
      operation,
      duration: `${duration}ms`,
      ...details
    });
  }

  /**
   * Log security event
   */
  security(event: string, details?: Record<string, any>): void {
    this.warn('Security event', {
      event,
      ...details
    });
  }

  /**
   * Log business event
   */
  business(event: string, details?: Record<string, any>): void {
    this.info('Business event', {
      event,
      ...details
    });
  }
}

/**
 * Create a structured logger instance
 */
export function createStructuredLogger(
  service?: string,
  version?: string,
  minLevel?: LogLevel
): StructuredLogger {
  return new StructuredLogger(service, version, minLevel);
}

/**
 * Create a logger from Hono context with request information
 */
export function createLoggerFromHonoContext(c: any): StructuredLogger {
  const logger = createStructuredLogger();
  
  // Extract request information
  const requestId = c.req.header('x-request-id') || 
                   c.req.header('cf-ray') || 
                   `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const userId = c.req.header('x-user-id') || 
                c.req.query('user') || 
                undefined;
  
  logger.setRequestContext(requestId, userId);
  
  return logger;
}

/**
 * Performance monitoring decorator
 */
export function withPerformanceLogging<T extends any[], R>(
  operation: string,
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    const start = Date.now();
    try {
      const result = await fn(...args);
      const duration = Date.now() - start;
      
      // Log performance if operation took longer than 1 second
      if (duration > 1000) {
        console.info(`Performance: ${operation} took ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`Performance: ${operation} failed after ${duration}ms`, error);
      throw error;
    }
  };
}
