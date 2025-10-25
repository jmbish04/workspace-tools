/**
 * @module logger-adapter
 * @description Adapter to make EnhancedLogger compatible with the existing Logger interface.
 */

import { Logger, LogContext } from './logger';
import { EnhancedLogger } from './enhanced-logger';
import { DatabaseLogger, VerbosityLevel } from './database-logger';

export class LoggerAdapter extends Logger {
  private enhancedLogger: EnhancedLogger;

  constructor(
    initialContext: LogContext = {},
    databaseLogger?: DatabaseLogger,
    config?: any
  ) {
    super(initialContext);
    this.enhancedLogger = new EnhancedLogger(initialContext, databaseLogger, config);
  }

  // Override all methods to delegate to enhanced logger
  setContext(context: LogContext): void {
    super.setContext(context);
    this.enhancedLogger.setContext(context);
  }

  startTimer(): void {
    super.startTimer();
    this.enhancedLogger.startTimer();
  }

  getElapsedTime(): number {
    return super.getElapsedTime();
  }

  child(context: LogContext): LoggerAdapter {
    const childLogger = new LoggerAdapter();
    childLogger.enhancedLogger = this.enhancedLogger.child(context);
    childLogger.startTime = this.startTime;
    return childLogger;
  }

  debug(message: string, data?: any): void {
    super.debug(message, data);
    this.enhancedLogger.debug(message, data);
  }

  info(message: string, data?: any): void {
    super.info(message, data);
    this.enhancedLogger.info(message, data);
  }

  warn(message: string, data?: any): void {
    super.warn(message, data);
    this.enhancedLogger.warn(message, data);
  }

  error(message: string, error?: Error | any, data?: any): void {
    super.error(message, error, data);
    this.enhancedLogger.error(message, error, data);
  }

  googleApiCall(service: string, method: string, endpoint: string): void {
    super.googleApiCall(service, method, endpoint);
    this.enhancedLogger.googleApiCall(service, method, endpoint);
  }

  googleApiComplete(service: string, method: string, success: boolean, duration: number): void {
    super.googleApiComplete(service, method, success, duration);
    this.enhancedLogger.googleApiComplete(service, method, success, duration);
  }

  gmailOperation(operation: string, messageCount?: number, threadId?: string): void {
    super.gmailOperation(operation, messageCount, threadId);
    // Enhanced logger inherits this method from base logger
  }

  driveOperation(operation: string, fileId?: string, fileName?: string): void {
    super.driveOperation(operation, fileId, fileName);
    // Enhanced logger inherits this method from base logger
  }

  appsScriptExecution(scriptName: string, functionName: string, params?: any): void {
    super.appsScriptExecution(scriptName, functionName, params);
    // Enhanced logger inherits this method from base logger
  }

  aiOperation(provider: string, operation: string, context?: LogContext): void {
    this.info(`🤖 AI ${operation}`, { provider, operation, ...context });
    // Enhanced logger inherits this method from base logger
  }

  emailProcessing(operation: string, messageId: string, context?: LogContext): void {
    this.info(`📧 Email processing: ${operation}`, { messageId, operation, ...context });
    // Enhanced logger inherits this method from base logger
  }

  threadProcessing(operation: string, threadId: string, messageCount?: number): void {
    super.threadProcessing(operation, threadId, messageCount);
    // Enhanced logger inherits this method from base logger
  }

  a2aOperation(skill: string, operation: string, context?: LogContext): void {
    this.info(`🤝 A2A ${skill}: ${operation}`, { skill, operation, ...context });
    // Enhanced logger inherits this method from base logger
  }

  rateLimit(identifier: string, limit: number, context?: LogContext): void {
    this.warn(`🚦 Rate limit: ${identifier}`, { identifier, limit, ...context });
    // Enhanced logger inherits this method from base logger
  }

  cacheOperation(operation: string, key: string, context?: LogContext): void {
    this.debug(`💾 Cache ${operation}`, { operation, key, ...context });
    // Enhanced logger inherits this method from base logger
  }

  performanceMetric(metric: string, value: number, unit: string = 'ms', context?: LogContext): void {
    this.info(`📊 ${metric}: ${value}${unit}`, { metric, value, unit, ...context });
    // Enhanced logger inherits this method from base logger
  }

  requestStart(method: string, path: string, headers: Record<string, string>, context?: LogContext): void {
    super.requestStart(method, path, headers);
    // Enhanced logger inherits this method from base logger
  }

  requestEnd(statusCode: number, duration?: number, context?: LogContext): void {
    super.requestEnd(statusCode);
    // Enhanced logger inherits this method from base logger
  }

  // Enhanced logger specific methods
  setVerbosity(level: VerbosityLevel): void {
    this.enhancedLogger.setVerbosity(level);
  }

  setConsoleLogging(enabled: boolean): void {
    this.enhancedLogger.setConsoleLogging(enabled);
  }

  setDatabaseLogging(enabled: boolean): void {
    this.enhancedLogger.setDatabaseLogging(enabled);
  }

  async flush(): Promise<void> {
    await this.enhancedLogger.flush();
  }

  async getLogStats(): Promise<any> {
    return await this.enhancedLogger.getLogStats();
  }

  async queryLogs(options: any = {}): Promise<any[]> {
    return await this.enhancedLogger.queryLogs(options);
  }

  async cleanupOldLogs(): Promise<number> {
    return await this.enhancedLogger.cleanupOldLogs();
  }

  async destroy(): Promise<void> {
    await this.enhancedLogger.destroy();
  }
}

/**
 * Create a logger adapter instance
 */
export function createLoggerAdapter(
  initialContext: LogContext = {},
  databaseLogger?: DatabaseLogger,
  config?: any
): LoggerAdapter {
  return new LoggerAdapter(initialContext, databaseLogger, config);
}

/**
 * Create a logger from Hono context
 */
export function createLoggerFromContext(c: any): LoggerAdapter {
  const context: LogContext = {
    requestId: c.req.header('x-request-id') || `req_${Date.now()}`,
    ip: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
    userAgent: c.req.header('user-agent'),
    method: c.req.method,
    endpoint: c.req.path
  };

  return new LoggerAdapter(context);
}
