/**
 * @module database-logger
 * @description Enhanced logger with verbosity levels and D1 database storage.
 * Provides structured logging with different verbosity levels and persistent storage.
 */

export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5
}

export enum VerbosityLevel {
  QUIET = 0,      // Only FATAL and ERROR
  NORMAL = 1,     // WARN, ERROR, FATAL
  VERBOSE = 2,    // INFO, WARN, ERROR, FATAL
  DEBUG = 3,      // DEBUG, INFO, WARN, ERROR, FATAL
  TRACE = 4       // All levels including TRACE
}

export interface LogContext {
  service?: string;
  requestId?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  duration?: number;
  errorCode?: string;
  errorDetails?: string;
  [key: string]: any;
}

export interface LogEntry {
  id?: number;
  timestamp: string;
  level: string;
  message: string;
  context?: string;
  service?: string;
  requestId?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  duration?: number;
  errorCode?: string;
  errorDetails?: string;
  created_at?: string;
}

export interface DatabaseLoggerConfig {
  verbosity: VerbosityLevel;
  enableConsole: boolean;
  enableDatabase: boolean;
  maxLogAge: number; // in days
  batchSize: number;
  flushInterval: number; // in milliseconds
}

export class DatabaseLogger {
  private config: DatabaseLoggerConfig;
  private db: D1Database;
  private logBuffer: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(db: D1Database, config: Partial<DatabaseLoggerConfig> = {}) {
    this.db = db;
    this.config = {
      verbosity: VerbosityLevel.NORMAL,
      enableConsole: true,
      enableDatabase: true,
      maxLogAge: 30, // 30 days
      batchSize: 100,
      flushInterval: 5000, // 5 seconds
      ...config
    };

    // Start periodic flush
    if (this.config.enableDatabase) {
      this.startFlushTimer();
    }
  }

  /**
   * Log a message with the specified level
   */
  log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      context: context ? JSON.stringify(this.sanitizeContext(context)) : undefined,
      service: context?.service,
      requestId: context?.requestId,
      userId: context?.userId,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      duration: context?.duration,
      errorCode: context?.errorCode,
      errorDetails: context?.errorDetails
    };

    // Console output
    if (this.config.enableConsole) {
      this.logToConsole(level, message, context);
    }

    // Database storage
    if (this.config.enableDatabase) {
      this.logBuffer.push(logEntry);
      
      // Flush if buffer is full
      if (this.logBuffer.length >= this.config.batchSize) {
        this.flush();
      }
    }
  }

  /**
   * Log trace level message
   */
  trace(message: string, context?: LogContext): void {
    this.log(LogLevel.TRACE, message, context);
  }

  /**
   * Log debug level message
   */
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log info level message
   */
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log warning level message
   */
  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log error level message
   */
  error(message: string, error?: Error | any, context?: LogContext): void {
    const errorContext = {
      ...context,
      errorCode: error?.code || error?.name || 'UNKNOWN_ERROR',
      errorDetails: error?.message || String(error)
    };
    this.log(LogLevel.ERROR, message, errorContext);
  }

  /**
   * Log fatal level message
   */
  fatal(message: string, error?: Error | any, context?: LogContext): void {
    const errorContext = {
      ...context,
      errorCode: error?.code || error?.name || 'FATAL_ERROR',
      errorDetails: error?.message || String(error)
    };
    this.log(LogLevel.FATAL, message, errorContext);
  }

  /**
   * Log request start
   */
  requestStart(method: string, path: string, headers: Record<string, string>, context?: LogContext): void {
    this.info(`🚀 ${method} ${path}`, {
      ...context,
      service: 'http',
      message: 'Request started',
      method,
      path,
      headers: this.sanitizeHeaders(headers)
    });
  }

  /**
   * Log request end
   */
  requestEnd(statusCode: number, duration?: number, context?: LogContext): void {
    const level = statusCode >= 400 ? LogLevel.ERROR : LogLevel.INFO;
    const emoji = statusCode >= 400 ? '❌' : '✅';
    
    this.log(level, `${emoji} Request completed with status ${statusCode}`, {
      ...context,
      service: 'http',
      duration,
      statusCode
    });
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
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    const emoji = success ? '✅' : '❌';
    
    this.log(level, `${emoji} Google API ${service}/${method} ${success ? 'completed' : 'failed'}`, {
      ...context,
      service: 'google-api',
      method,
      apiService: service,
      duration,
      success
    });
  }

  /**
   * Flush buffered logs to database
   */
  async flush(): Promise<void> {
    if (this.logBuffer.length === 0) {
      return;
    }

    const logsToFlush = [...this.logBuffer];
    this.logBuffer = [];

    try {
      const stmt = this.db.prepare(`
        INSERT INTO logs (
          timestamp, level, message, context, service, request_id, 
          user_id, ip_address, user_agent, duration, error_code, error_details
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const batch = this.db.batch(
        logsToFlush.map(log => 
          stmt.bind(
            log.timestamp,
            log.level,
            log.message,
            log.context,
            log.service,
            log.requestId,
            log.userId,
            log.ipAddress,
            log.userAgent,
            log.duration,
            log.errorCode,
            log.errorDetails
          )
        )
      );

      await batch;
      console.log(`[DatabaseLogger] Flushed ${logsToFlush.length} logs to database`);
    } catch (error) {
      console.error('[DatabaseLogger] Failed to flush logs to database:', error);
      // Re-add logs to buffer for retry
      this.logBuffer.unshift(...logsToFlush);
    }
  }

  /**
   * Query logs from database
   */
  async queryLogs(options: {
    level?: string;
    service?: string;
    requestId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<LogEntry[]> {
    try {
      let query = 'SELECT * FROM logs WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (options.level) {
        query += ` AND level = ?`;
        params.push(options.level);
        paramIndex++;
      }

      if (options.service) {
        query += ` AND service = ?`;
        params.push(options.service);
        paramIndex++;
      }

      if (options.requestId) {
        query += ` AND request_id = ?`;
        params.push(options.requestId);
        paramIndex++;
      }

      if (options.userId) {
        query += ` AND user_id = ?`;
        params.push(options.userId);
        paramIndex++;
      }

      if (options.startDate) {
        query += ` AND created_at >= ?`;
        params.push(options.startDate);
        paramIndex++;
      }

      if (options.endDate) {
        query += ` AND created_at <= ?`;
        params.push(options.endDate);
        paramIndex++;
      }

      query += ' ORDER BY created_at DESC';

      if (options.limit) {
        query += ` LIMIT ?`;
        params.push(options.limit);
        paramIndex++;
      }

      if (options.offset) {
        query += ` OFFSET ?`;
        params.push(options.offset);
        paramIndex++;
      }

      const result = await this.db.prepare(query).bind(...params).all();
      return result.results as unknown as LogEntry[];
    } catch (error) {
      console.error('[DatabaseLogger] Failed to query logs:', error);
      return [];
    }
  }

  /**
   * Get log statistics
   */
  async getLogStats(): Promise<{
    totalLogs: number;
    logsByLevel: Record<string, number>;
    logsByService: Record<string, number>;
    recentErrors: number;
    averageResponseTime: number;
  }> {
    try {
      const totalResult = await this.db.prepare('SELECT COUNT(*) as count FROM logs').first();
      const levelResult = await this.db.prepare(`
        SELECT level, COUNT(*) as count 
        FROM logs 
        GROUP BY level
      `).all();
      const serviceResult = await this.db.prepare(`
        SELECT service, COUNT(*) as count 
        FROM logs 
        WHERE service IS NOT NULL
        GROUP BY service
      `).all();
      const errorResult = await this.db.prepare(`
        SELECT COUNT(*) as count 
        FROM logs 
        WHERE level IN ('ERROR', 'FATAL') 
        AND created_at >= datetime('now', '-1 day')
      `).first();
      const durationResult = await this.db.prepare(`
        SELECT AVG(duration) as avg_duration 
        FROM logs 
        WHERE duration IS NOT NULL 
        AND created_at >= datetime('now', '-1 day')
      `).first();

      return {
        totalLogs: (totalResult?.count as number) || 0,
        logsByLevel: levelResult.results.reduce((acc: any, row: any) => {
          acc[row.level] = row.count;
          return acc;
        }, {}),
        logsByService: serviceResult.results.reduce((acc: any, row: any) => {
          acc[row.service] = row.count;
          return acc;
        }, {}),
        recentErrors: (errorResult?.count as number) || 0,
        averageResponseTime: (durationResult?.avg_duration as number) || 0
      };
    } catch (error) {
      console.error('[DatabaseLogger] Failed to get log stats:', error);
      return {
        totalLogs: 0,
        logsByLevel: {},
        logsByService: {},
        recentErrors: 0,
        averageResponseTime: 0
      };
    }
  }

  /**
   * Clean up old logs
   */
  async cleanupOldLogs(): Promise<number> {
    try {
      const result = await this.db.prepare(`
        DELETE FROM logs 
        WHERE created_at < datetime('now', '-${this.config.maxLogAge} days')
      `).run();
      
      const changes = (result as any).changes || 0;
      console.log(`[DatabaseLogger] Cleaned up ${changes} old logs`);
      return changes;
    } catch (error) {
      console.error('[DatabaseLogger] Failed to cleanup old logs:', error);
      return 0;
    }
  }

  /**
   * Set verbosity level
   */
  setVerbosity(level: VerbosityLevel): void {
    this.config.verbosity = level;
  }

  /**
   * Enable/disable console logging
   */
  setConsoleLogging(enabled: boolean): void {
    this.config.enableConsole = enabled;
  }

  /**
   * Enable/disable database logging
   */
  setDatabaseLogging(enabled: boolean): void {
    this.config.enableDatabase = enabled;
    if (enabled && !this.flushTimer) {
      this.startFlushTimer();
    } else if (!enabled && this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  /**
   * Destroy logger and cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    
    // Flush remaining logs
    await this.flush();
  }

  /**
   * Check if message should be logged based on verbosity level
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.verbosity;
  }

  /**
   * Log to console with appropriate formatting
   */
  private logToConsole(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const levelStr = LogLevel[level].padEnd(5);
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    
    console.log(`[${timestamp}] ${levelStr} ${message}${contextStr}`);
  }

  /**
   * Sanitize context data
   */
  private sanitizeContext(context: LogContext): LogContext {
    const sanitized = { ...context };
    
    // Remove sensitive information
    const sensitiveKeys = ['password', 'secret', 'key', 'token', 'auth', 'authorization'];
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  /**
   * Sanitize headers
   */
  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    
    for (const header of sensitiveHeaders) {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }
}

/**
 * Create a database logger instance
 */
export function createDatabaseLogger(db: D1Database, config?: Partial<DatabaseLoggerConfig>): DatabaseLogger {
  return new DatabaseLogger(db, config);
}
