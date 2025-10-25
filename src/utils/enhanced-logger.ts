/**
 * @module enhanced-logger
 * @description Enhanced logger that integrates console and database logging with verbosity levels.
 * Provides backward compatibility with existing logger while adding database persistence.
 */

import { DatabaseLogger, VerbosityLevel, LogContext as DBLogContext } from './database-logger';
import { Logger as BaseLogger, LogLevel as BaseLogLevel, LogContext as BaseLogContext } from './logger';

export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5
}

export interface LogContext {
  service?: string;
  requestId?: string;
  userId?: string;
  email?: string;
  threadId?: string;
  endpoint?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  ipAddress?: string;
  operation?: string;
  duration?: number;
  errorCode?: string;
  errorDetails?: string;
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

export interface EnhancedLoggerConfig {
  verbosity: VerbosityLevel;
  enableConsole: boolean;
  enableDatabase: boolean;
  service: string;
}

export class EnhancedLogger extends BaseLogger {
  private databaseLogger?: DatabaseLogger;
  private config: EnhancedLoggerConfig;

  constructor(
    initialContext: LogContext = {},
    databaseLogger?: DatabaseLogger,
    config: Partial<EnhancedLoggerConfig> = {}
  ) {
    super(initialContext);
    this.databaseLogger = databaseLogger;
    this.config = {
      verbosity: VerbosityLevel.NORMAL,
      enableConsole: true,
      enableDatabase: !!databaseLogger,
      service: 'workspace-tools',
      ...config
    };
  }

  /**
   * Set the database logger
   */
  setDatabaseLogger(databaseLogger: DatabaseLogger): void {
    this.databaseLogger = databaseLogger;
    this.config.enableDatabase = true;
  }

  /**
   * Set verbosity level
   */
  setVerbosity(level: VerbosityLevel): void {
    this.config.verbosity = level;
    if (this.databaseLogger) {
      this.databaseLogger.setVerbosity(level);
    }
  }

  /**
   * Enable/disable console logging
   */
  setConsoleLogging(enabled: boolean): void {
    this.config.enableConsole = enabled;
    if (this.databaseLogger) {
      this.databaseLogger.setConsoleLogging(enabled);
    }
  }

  /**
   * Enable/disable database logging
   */
  setDatabaseLogging(enabled: boolean): void {
    this.config.enableDatabase = enabled;
    if (this.databaseLogger) {
      this.databaseLogger.setDatabaseLogging(enabled);
    }
  }

  // Context and timing methods are inherited from BaseLogger

  /**
   * Override the base log method to add database logging
   */
  protected log(level: BaseLogLevel, message: string, data?: any, error?: any): void {
    // Call parent logging for console output
    super.log(level, message, data, error);

    // Add database logging
    if (this.config.enableDatabase && this.databaseLogger) {
      const fullContext = { ...this.context, ...data };
      const dbContext: DBLogContext = {
        ...fullContext,
        service: fullContext.service || this.config.service,
        ipAddress: fullContext.ipAddress || fullContext.ip,
        duration: fullContext.duration || this.getElapsedTime()
      };

      if (error) {
        this.databaseLogger.error(message, error, dbContext);
      } else {
        this.databaseLogger.log(level as any, message, dbContext);
      }
    }
  }

  // Logging methods are inherited from BaseLogger

  /**
   * Override child method to return EnhancedLogger
   */
  child(context: BaseLogContext): EnhancedLogger {
    const childLogger = new EnhancedLogger(
      { ...this.context, ...context },
      this.databaseLogger,
      this.config
    );
    childLogger.startTime = this.startTime;
    return childLogger;
  }

  /**
   * Log request start
   */
  requestStart(method: string, path: string, headers: Record<string, string>, context?: LogContext): void {
    const fullContext = {
      ...context,
      method,
      endpoint: path,
      userAgent: headers['user-agent'],
      ip: headers['cf-connecting-ip'] || headers['x-forwarded-for'] || headers['x-real-ip']
    };

    this.info(`🚀 ${method} ${path}`, fullContext);
  }

  /**
   * Log request end
   */
  requestEnd(statusCode: number, duration?: number, context?: LogContext): void {
    const fullContext = {
      ...context,
      duration: duration || this.getElapsedTime(),
      statusCode
    };

    if (statusCode >= 400) {
      this.error(`❌ Request completed with status ${statusCode}`, undefined, fullContext);
    } else {
      this.info(`✅ Request completed with status ${statusCode}`, fullContext);
    }
  }

  /**
   * Log Google API call
   */
  googleApiCall(service: string, method: string, endpoint: string, context?: LogContext): void {
    this.info(`🌐 Google API: ${service}/${method}`, {
      ...context,
      service: 'google-api',
      method,
      endpoint,
      apiService: service
    });
  }

  /**
   * Log Google API completion
   */
  googleApiComplete(service: string, method: string, success: boolean, duration: number, context?: LogContext): void {
    const fullContext = {
      ...context,
      service: 'google-api',
      method,
      apiService: service,
      duration,
      success
    };

    if (success) {
      this.info(`✅ Google API ${service}/${method} completed`, fullContext);
    } else {
      this.error(`❌ Google API ${service}/${method} failed`, undefined, fullContext);
    }
  }

  /**
   * Log authentication events
   */
  authSuccess(userId: string, method: string, context?: LogContext): void {
    this.info(`🔐 Authentication successful`, {
      ...context,
      userId,
      authMethod: method,
      service: 'auth'
    });
  }

  /**
   * Log authentication failures
   */
  authFailure(userId: string, method: string, reason: string, context?: LogContext): void {
    this.warn(`🔐 Authentication failed`, {
      ...context,
      userId,
      authMethod: method,
      reason,
      service: 'auth'
    });
  }

  /**
   * Log rate limiting events
   */
  rateLimitExceeded(identifier: string, limit: number, context?: LogContext): void {
    this.warn(`⏰ Rate limit exceeded`, {
      ...context,
      identifier,
      limit,
      service: 'rate-limit'
    });
  }

  /**
   * Log cache events
   */
  cacheHit(key: string, context?: LogContext): void {
    this.debug(`💾 Cache hit`, {
      ...context,
      cacheKey: key,
      service: 'cache'
    });
  }

  /**
   * Log cache misses
   */
  cacheMiss(key: string, context?: LogContext): void {
    this.debug(`💾 Cache miss`, {
      ...context,
      cacheKey: key,
      service: 'cache'
    });
  }

  /**
   * Log database operations
   */
  dbOperation(operation: string, table: string, duration: number, context?: LogContext): void {
    this.debug(`🗄️ Database ${operation}`, {
      ...context,
      operation,
      table,
      duration,
      service: 'database'
    });
  }

  /**
   * Log performance metrics
   */
  performance(metric: string, value: number, unit: string = 'ms', context?: LogContext): void {
    this.info(`📊 Performance: ${metric} = ${value}${unit}`, {
      ...context,
      metric,
      value,
      unit,
      service: 'performance'
    });
  }

  // Console logging and sanitization methods are inherited from BaseLogger

  /**
   * Flush database logs
   */
  async flush(): Promise<void> {
    if (this.databaseLogger) {
      await this.databaseLogger.flush();
    }
  }

  /**
   * Get log statistics
   */
  async getLogStats(): Promise<any> {
    if (this.databaseLogger) {
      return await this.databaseLogger.getLogStats();
    }
    return null;
  }

  /**
   * Query logs
   */
  async queryLogs(options: any = {}): Promise<any[]> {
    if (this.databaseLogger) {
      return await this.databaseLogger.queryLogs(options);
    }
    return [];
  }

  /**
   * Cleanup old logs
   */
  async cleanupOldLogs(): Promise<number> {
    if (this.databaseLogger) {
      return await this.databaseLogger.cleanupOldLogs();
    }
    return 0;
  }

  /**
   * Destroy logger and cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.databaseLogger) {
      await this.databaseLogger.destroy();
    }
  }

  // Compatibility methods are inherited from BaseLogger
}

/**
 * Create an enhanced logger instance
 */
export function createEnhancedLogger(
  initialContext: LogContext = {},
  databaseLogger?: DatabaseLogger,
  config?: Partial<EnhancedLoggerConfig>
): EnhancedLogger {
  return new EnhancedLogger(initialContext, databaseLogger, config);
}

/**
 * Create a logger from Hono context
 */
export function createLoggerFromContext(c: any): EnhancedLogger {
  const context: LogContext = {
    requestId: c.req.header('x-request-id') || `req_${Date.now()}`,
    ip: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
    userAgent: c.req.header('user-agent'),
    method: c.req.method,
    endpoint: c.req.path
  };

  return new EnhancedLogger(context);
}
