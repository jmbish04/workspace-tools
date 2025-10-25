/**
 * @module logsRoutes
 * @description Provides Hono routes for log management and querying.
 * Includes endpoints for viewing logs, statistics, and log management.
 */

import { Hono } from "hono";
import { Env } from "../types";
import { DatabaseLogger, VerbosityLevel } from "../utils/database-logger";
import { createEnhancedLogger } from "../utils/enhanced-logger";
import { LoggerAdapter } from "../utils/logger-adapter";

/**
 * Hono router for log management endpoints.
 * @type {Hono<{ Bindings: Env }>}
 */
export const logsRoutes = new Hono<{ 
  Bindings: Env;
  Variables: {
    logger: LoggerAdapter;
  };
}>();

/**
 * @route GET /logs
 * @description Query logs with optional filters
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response containing filtered logs.
 */
logsRoutes.get("/", async (c) => {
  const logger = c.get('logger') || createEnhancedLogger();
  
  try {
    const databaseLogger = new DatabaseLogger(c.env.DB);
    
    const {
      level,
      service,
      requestId,
      userId,
      startDate,
      endDate,
      limit = "100",
      offset = "0"
    } = c.req.query();

    const logs = await databaseLogger.queryLogs({
      level,
      service,
      requestId,
      userId,
      startDate,
      endDate,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    logger.info('📋 Logs queried successfully', {
      service: 'logs',
      filters: { level, service, requestId, userId, startDate, endDate },
      resultCount: logs.length
    });

    return c.json({
      success: true,
      data: {
        logs,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          count: logs.length
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to query logs', error, { service: 'logs' });
    
    return c.json({
      success: false,
      error: {
        code: 'LOG_QUERY_ERROR',
        message: 'Failed to query logs',
        details: error instanceof Error ? error.message : String(error)
      },
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * @route GET /logs/stats
 * @description Get log statistics
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response containing log statistics.
 */
logsRoutes.get("/stats", async (c) => {
  const logger = c.get('logger') || createEnhancedLogger();
  
  try {
    const databaseLogger = new DatabaseLogger(c.env.DB);
    const stats = await databaseLogger.getLogStats();

    logger.info('📊 Log statistics retrieved', {
      service: 'logs',
      stats
    });

    return c.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get log statistics', error, { service: 'logs' });
    
    return c.json({
      success: false,
      error: {
        code: 'LOG_STATS_ERROR',
        message: 'Failed to get log statistics',
        details: error instanceof Error ? error.message : String(error)
      },
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * @route GET /logs/recent
 * @description Get recent logs (last 24 hours)
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response containing recent logs.
 */
logsRoutes.get("/recent", async (c) => {
  const logger = c.get('logger') || createEnhancedLogger();
  
  try {
    const databaseLogger = new DatabaseLogger(c.env.DB);
    
    const { limit = "50" } = c.req.query();
    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const logs = await databaseLogger.queryLogs({
      startDate,
      limit: parseInt(limit)
    });

    logger.info('📋 Recent logs retrieved', {
      service: 'logs',
      count: logs.length,
      timeRange: '24h'
    });

    return c.json({
      success: true,
      data: {
        logs,
        timeRange: '24h',
        count: logs.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get recent logs', error, { service: 'logs' });
    
    return c.json({
      success: false,
      error: {
        code: 'RECENT_LOGS_ERROR',
        message: 'Failed to get recent logs',
        details: error instanceof Error ? error.message : String(error)
      },
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * @route GET /logs/errors
 * @description Get error logs only
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response containing error logs.
 */
logsRoutes.get("/errors", async (c) => {
  const logger = c.get('logger') || createEnhancedLogger();
  
  try {
    const databaseLogger = new DatabaseLogger(c.env.DB);
    
    const { limit = "50", startDate, endDate } = c.req.query();

    const logs = await databaseLogger.queryLogs({
      level: 'ERROR',
      startDate,
      endDate,
      limit: parseInt(limit)
    });

    logger.info('📋 Error logs retrieved', {
      service: 'logs',
      count: logs.length,
      level: 'ERROR'
    });

    return c.json({
      success: true,
      data: {
        logs,
        level: 'ERROR',
        count: logs.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get error logs', error, { service: 'logs' });
    
    return c.json({
      success: false,
      error: {
        code: 'ERROR_LOGS_ERROR',
        message: 'Failed to get error logs',
        details: error instanceof Error ? error.message : String(error)
      },
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * @route POST /logs/cleanup
 * @description Clean up old logs
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response with cleanup results.
 */
logsRoutes.post("/cleanup", async (c) => {
  const logger = c.get('logger') || createEnhancedLogger();
  
  try {
    const databaseLogger = new DatabaseLogger(c.env.DB);
    const deletedCount = await databaseLogger.cleanupOldLogs();

    logger.info('🧹 Log cleanup completed', {
      service: 'logs',
      deletedCount
    });

    return c.json({
      success: true,
      data: {
        deletedCount,
        message: `Cleaned up ${deletedCount} old log entries`
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to cleanup logs', error, { service: 'logs' });
    
    return c.json({
      success: false,
      error: {
        code: 'LOG_CLEANUP_ERROR',
        message: 'Failed to cleanup logs',
        details: error instanceof Error ? error.message : String(error)
      },
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * @route POST /logs/verbosity
 * @description Set log verbosity level
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response confirming verbosity change.
 */
logsRoutes.post("/verbosity", async (c) => {
  const logger = c.get('logger') || createEnhancedLogger();
  
  try {
    const { level } = await c.req.json();
    
    if (!level || !Object.values(VerbosityLevel).includes(level)) {
      return c.json({
        success: false,
        error: {
          code: 'INVALID_VERBOSITY_LEVEL',
          message: 'Invalid verbosity level. Must be one of: QUIET, NORMAL, VERBOSE, DEBUG, TRACE'
        },
        timestamp: new Date().toISOString()
      }, 400);
    }

    logger.setVerbosity(level);
    
    logger.info('🔧 Log verbosity level changed', {
      service: 'logs',
      newLevel: level
    });

    return c.json({
      success: true,
      data: {
        verbosityLevel: level,
        message: `Log verbosity set to ${level}`
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to set verbosity level', error, { service: 'logs' });
    
    return c.json({
      success: false,
      error: {
        code: 'VERBOSITY_ERROR',
        message: 'Failed to set verbosity level',
        details: error instanceof Error ? error.message : String(error)
      },
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * @route GET /logs/verbosity
 * @description Get current verbosity level
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response with current verbosity level.
 */
logsRoutes.get("/verbosity", async (c) => {
  const logger = c.get('logger') || createEnhancedLogger();
  
  try {
    return c.json({
      success: true,
      data: {
        verbosityLevel: 'NORMAL', // This would need to be stored and retrieved
        availableLevels: Object.values(VerbosityLevel)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get verbosity level', error, { service: 'logs' });
    
    return c.json({
      success: false,
      error: {
        code: 'VERBOSITY_ERROR',
        message: 'Failed to get verbosity level',
        details: error instanceof Error ? error.message : String(error)
      },
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * @route POST /logs/flush
 * @description Flush buffered logs to database
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response confirming flush operation.
 */
logsRoutes.post("/flush", async (c) => {
  const logger = c.get('logger') || createEnhancedLogger();
  
  try {
    await logger.flush();

    logger.info('💾 Logs flushed to database', {
      service: 'logs'
    });

    return c.json({
      success: true,
      data: {
        message: 'Logs flushed to database successfully'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to flush logs', error, { service: 'logs' });
    
    return c.json({
      success: false,
      error: {
        code: 'LOG_FLUSH_ERROR',
        message: 'Failed to flush logs',
        details: error instanceof Error ? error.message : String(error)
      },
      timestamp: new Date().toISOString()
    }, 500);
  }
});
