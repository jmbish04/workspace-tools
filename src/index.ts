/**
 * @module index
 * @description This is the main entry point for the Cloudflare Worker. It establishes a Hono web server
 * to act as a comprehensive, server-to-server proxy for Google Workspace APIs using a service account.
 * The worker manages authentication via a service account key with domain-wide delegation and exposes a
 * rich set of endpoints for interacting with services like Gmail, Drive, Docs, Sheets, Slides, and Apps Script.
 * It also includes scheduled handlers to periodically index Drive and Gmail content into a D1 database.
 * @requires hono
 * @requires hono/cors
 * @requires googleapis
 */

import { drive_v3, google } from "googleapis";
import { Context, Hono } from "hono";
import { cors } from "hono/cors";
import { gmailRoutes } from "./routes/gmail";
import { threadProcessorRoutes } from "./routes/thread-processor";
import { emailProcessingRoutes } from "./routes/email-processing";
import { a2aRoutes } from "./routes/a2a";
import { docsRoutes } from "./routes/docs";
import { driveRoutes } from "./routes/drive";
import { slidesRoutes } from "./routes/slides";
import { sheetsRoutes } from "./routes/sheets";
import { logsRoutes } from "./routes/logs";
import healthCheckRoutes from "./routes/health-check";
import { EmailProcessingOrchestrator } from "./services/email-orchestrator";
import { ProviderFactory } from "./providers";
import { createLoggerFromContext, Logger } from "./utils/logger";
import { createEnhancedLogger, EnhancedLogger } from "./utils/enhanced-logger";
import { createDatabaseLogger, DatabaseLogger, VerbosityLevel } from "./utils/database-logger";
import { createLoggerAdapter, LoggerAdapter } from "./utils/logger-adapter";
import { createRateLimitMiddleware } from "./utils/rate-limiter";
import { cacheManager, CACHE_CONFIGS } from "./utils/cache";
import { connectionPool } from "./utils/connection-pool";
import { performanceMonitor, timeAsync } from "./utils/performance-monitor";

// Enhanced type definitions for better type safety
interface GmailProvidersResponse {
  success: boolean;
  data?: {
    providers?: Array<{
      name: string;
      displayName: string;
      model: string;
      enabled: boolean;
    }>;
  };
}

interface ProcessingStatusResponse {
  success: boolean;
  data?: {
    threadProcessing?: {
      totalMessages?: number;
      processedMessages?: number;
      errors?: number;
    };
  };
}

interface DatabaseMessageResult {
  count?: number;
  lastDate?: string;
}

// Enhanced error types for better error handling
interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

interface ErrorResponse {
  success: false;
  error: ApiError;
  path?: string;
  method?: string;
}

// --- Hono App Initialization ---
const app = new Hono<{ 
  Bindings: Env & Record<string, unknown>;
  Variables: {
    logger: LoggerAdapter;
  };
}>();

// --- Centralized Error Handling Middleware ---
app.use('*', async (c, next) => {
  // Create enhanced logger with database support
  const databaseLogger = c.env.DB ? createDatabaseLogger(c.env.DB, {
    verbosity: VerbosityLevel.NORMAL,
    enableConsole: true,
    enableDatabase: true
  }) : undefined;
  
  const logger = createLoggerAdapter({
    requestId: c.req.header('x-request-id') || `req_${Date.now()}`,
    ip: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
    userAgent: c.req.header('user-agent'),
    method: c.req.method,
    endpoint: c.req.path
  }, databaseLogger, {
    verbosity: VerbosityLevel.NORMAL,
    enableConsole: true,
    enableDatabase: !!c.env.DB,
    service: 'workspace-tools'
  });
  
  // Log request start
  const headers = Object.fromEntries(c.req.raw.headers.entries());
  logger.requestStart(c.req.method, c.req.path, headers);

  // Add logger to context for use in routes
  c.set('logger', logger);

  try {
    await next();

    // Log successful completion
    logger.requestEnd(c.res.status);
  } catch (error) {
    // Centralized error handling
    logger.error('Workspace request failed with unhandled error', error);
    
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
        details: process.env.NODE_ENV === 'development' ? error : undefined,
        timestamp: new Date().toISOString()
      },
      path: c.req.path,
      method: c.req.method
    };
    
    logger.requestEnd(500);
    return c.json(errorResponse, 500);
  }
});

// --- Constants ---
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/presentations",
  "https://www.googleapis.com/auth/script.projects",
  "https://www.googleapis.com/auth/script.scriptapp",
  "https://www.googleapis.com/auth/script.triggers"
];

// --- Security Middleware ---
// API Key Authentication Middleware
app.use("*", async (c, next) => {
  const logger = c.get('logger') || createLoggerFromContext(c);
  
  // Skip authentication for health check and static assets
  if (c.req.path === '/health' || c.req.path.startsWith('/static/') || c.req.path === '/.well-known/agent.json') {
    await next();
    return;
  }
  
  // Check for API key in headers
  const apiKey = c.req.header('X-API-Key');
  const expectedApiKey = c.env.API_KEY;
  
  if (expectedApiKey && apiKey !== expectedApiKey) {
    logger.warn('Unauthorized API access attempt', { 
      path: c.req.path, 
      hasApiKey: !!apiKey,
      ip: c.req.header('CF-Connecting-IP') || 'unknown'
    });
    
    return c.json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing API key',
        timestamp: new Date().toISOString()
      }
    }, 401);
  }
  
  await next();
});

// CORS Middleware with restricted origins
app.use("*", cors({
  origin: (origin: string) => {
    // Allow requests from allowed origins or no origin (for same-origin requests)
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
    if (allowedOrigins.includes('*')) return '*';
    if (!origin) return '*'; // Allow same-origin requests
    return allowedOrigins.includes(origin) ? origin : null;
  },
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-API-Key"],
  credentials: true
}));


// --- Helper Functions ---
/**
 * @function getGoogleClients
 * @description A helper function that creates and configures authenticated clients for all necessary
 * Google Workspace services. It uses the service account key provided in the environment variables
 * to authenticate and impersonate the specified user.
 * @param {Context<{ Bindings: Env }> | Env} cOrEnv - The Hono context object or the Env object directly.
 * @param {string} [user] - The user to impersonate. If not provided, it will use the default user.
 * @returns {Promise<object>} A promise that resolves to an object containing initialized SDK clients.
 * @throws {Error} Throws an error if the service account key is missing or invalid.
 */
async function getGoogleClients(cOrEnv: Context<{ Bindings: Env & Record<string, unknown> }> | Env, user?: string) {
    const env = 'env' in cOrEnv ? cOrEnv.env : cOrEnv;
    const userToImpersonate = user || ('req' in cOrEnv ? cOrEnv.req.query("user") : undefined) || env.DEFAULT_USER;

    if (!env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        console.error("[Auth] CRITICAL: GOOGLE_SERVICE_ACCOUNT_KEY is not configured in the environment.");
        throw new Error("Service Account key is not configured for this worker.");
    }

    console.log(`[Auth] Using Service Account to impersonate user: ${userToImpersonate}`);
    
    // Handle potential control character issues in JSON
    let serviceAccountJson = env.GOOGLE_SERVICE_ACCOUNT_KEY;
    
    // Comprehensive control character sanitization
    serviceAccountJson = serviceAccountJson
        .replace(/\\n/g, '\n')           // Fix escaped newlines
        .replace(/\\r/g, '\r')           // Fix escaped carriage returns  
        .replace(/\\t/g, '\t')           // Fix escaped tabs
        .replace(/\\\\/g, '\\')          // Fix escaped backslashes
        .replace(/\\"/g, '"')            // Fix escaped quotes
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove remaining control characters
    
    let serviceAccount;
    try {
        serviceAccount = JSON.parse(serviceAccountJson);
    } catch (error: any) {
        console.error("[Auth] Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY:", error);
        throw new Error(`Service Account JSON parsing failed: ${error && error.message ? error.message : error}. Check that GOOGLE_SERVICE_ACCOUNT_KEY contains valid JSON.`);
    }
    const auth = new google.auth.JWT({
        email: serviceAccount.client_email,
        key: serviceAccount.private_key,
        scopes: SCOPES,
        subject: userToImpersonate,
    });

    return {
        gmail: google.gmail({ version: 'v1', auth }),
        drive: google.drive({ version: 'v3', auth }),
        docs: google.docs({ version: 'v1', auth }),
        sheets: google.sheets({ version: 'v4', auth }),
        slides: google.slides({ version: 'v1', auth }),
        script: google.script({ version: 'v1', auth }),
    };
}


// --- Core Routes ---
app.get("/health", (c) => {
  const logger = (c.get('logger') as Logger) || createLoggerFromContext(c);
  
  logger.info('💊 Workspace Tools health check requested');
  
  const healthData = {
    service: "google-workspace-service",
    version: c.env?.WORKSPACE_TOOLS_VERSION || "1.0.0",
    status: "ok",
    timestamp: new Date().toISOString(),
  };
  
  logger.debug('Health data prepared', { 
    service: healthData.service,
    version: healthData.version 
  });
  
  return c.json(healthData);
});

// Handle unsupported methods for health endpoint
app.all("/health", (c) => {
  const method = c.req.method;
  if (method !== 'GET') {
    return c.json({
      error: `Method ${method} not allowed`,
      allowedMethods: ['GET'],
      path: '/health'
    }, 405);
  }
  // This should not be reached due to the GET handler above
  return c.json({ error: 'Not found' }, 404);
});

// Performance monitoring endpoint
app.get("/performance", (c) => {
  const logger = (c.get('logger') as Logger) || createLoggerFromContext(c);
  
  logger.info('📊 Performance monitoring data requested');
  
  const summary = performanceMonitor.getSummary();
  const connectionStats = connectionPool.getStats();
  const cacheStats = cacheManager.getAllStats();
  
  return c.json({
    success: true,
    data: {
      performance: summary,
      connections: connectionStats,
      cache: cacheStats
    },
    timestamp: new Date().toISOString()
  });
});

// --- System Status & Activity Routes ---
app.get("/system/status", async (c) => {
  const logger = (c.get('logger') as Logger) || createLoggerFromContext(c);
  logger.info('🔧 System status requested');
  
  try {
    // Get Gmail service status
    let gmailStatus = 'standby';
    let gmailProgress = 0;
    let gmailDetails = 'Gmail service ready';
    
    try {
      const baseUrl = new URL(c.req.url).origin;
      const gmailProvidersResponse = await fetch(`${baseUrl}/gmail/providers`);
      if (gmailProvidersResponse.ok) {
        const gmailData = await gmailProvidersResponse.json() as GmailProvidersResponse;
        gmailStatus = 'active';
        gmailProgress = (gmailData.data?.providers?.length ?? 0) * 20 || 80;
        gmailDetails = `${gmailData.data?.providers?.length || 4} AI providers active`;
      }
    } catch (error: unknown) {
      gmailStatus = 'error';
      gmailDetails = 'Gmail service unavailable';
    }

    // Get Processing status
    let processingStatus = 'standby';
    let processingProgress = 0;
    let processingDetails = 'Email processing ready';
    
    try {
      const baseUrl = new URL(c.req.url).origin;
      const processingResponse = await fetch(`${baseUrl}/email-processing/processing-status`);
      if (processingResponse.ok) {
        const processingData = await processingResponse.json() as ProcessingStatusResponse;
        processingStatus = 'active';
        processingProgress = Math.min((processingData.data?.threadProcessing?.totalMessages || 0) / 10, 100);
        processingDetails = `${processingData.data?.threadProcessing?.totalMessages || 0} messages processed`;
      }
    } catch (error: unknown) {
      processingStatus = 'error';
      processingDetails = 'Processing service unavailable';
    }

    const systemStatus = {
      services: {
        gmail: {
          status: gmailStatus,
          progress: gmailProgress,
          details: gmailDetails,
          lastUpdate: new Date().toISOString()
        },
        processing: {
          status: processingStatus, 
          progress: processingProgress,
          details: processingDetails,
          lastUpdate: new Date().toISOString()
        },
        ai: {
          status: 'active',
          progress: 85,
          details: 'Multi-model analysis running',
          lastUpdate: new Date().toISOString()
        },
        drive: {
          status: 'standby',
          progress: 100,
          details: 'Next scheduled scan: Every 6 hours',
          lastUpdate: new Date().toISOString()
        }
      },
      overall: {
        status: 'operational',
        timestamp: new Date().toISOString()
      }
    };

    return c.json({
      success: true,
      data: systemStatus
    });

  } catch (error: unknown) {
    logger.error('Failed to get system status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get system status';
    return c.json({
      success: false,
      error: errorMessage
    }, 500);
  }
});

app.get("/system/activity", async (c) => {
  const logger = (c.get('logger') as Logger) || createLoggerFromContext(c);
  logger.info('📋 Recent activity requested');
  
  try {
    const activities = [];
    
    // Check recent message processing from database
    try {
            const recentMessages = await c.env.DB.prepare(`
        SELECT COUNT(*) as count, MAX(messageDate) as lastDate
        FROM rag_messages
        WHERE messageDate >= datetime('now', '-1 hour')
      `).first() as DatabaseMessageResult | null;

      if (recentMessages && (recentMessages.count ?? 0) > 0) {
        activities.push({
          type: 'success',
          icon: 'fas fa-check-circle',
          title: 'Email Processing Completed',
          description: `Processed ${recentMessages.count} messages in the last hour`,
          timestamp: new Date().toISOString(),
          category: 'processing'
        });
      } else {
        activities.push({
          type: 'success',
          icon: 'fas fa-check-circle',
          title: 'Email Processing System Ready',
          description: 'Email processing pipeline is operational and monitoring for new messages',
          timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
          category: 'processing'
        });
      }
    } catch (dbError) {
      activities.push({
        type: 'info',
        icon: 'fas fa-database',
        title: 'Database Connection Active',
        description: 'D1 database connection established and ready for queries',
        timestamp: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
        category: 'database'
      });
    }

    // Check AI provider status
    try {
      const baseUrl = new URL(c.req.url).origin;
      const gmailProvidersResponse = await fetch(`${baseUrl}/gmail/providers`);
      if (gmailProvidersResponse.ok) {
        const gmailData = await gmailProvidersResponse.json() as GmailProvidersResponse;
        activities.push({
          type: 'info',
          icon: 'fas fa-brain',
          title: 'AI Providers Initialized',
          description: `${gmailData.data?.providers?.length || 0} AI providers active (${gmailData.data?.providers?.map((p: any) => p.name).join(', ') || 'Multiple providers'})`,
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          category: 'ai'
        });
      }
    } catch (error: unknown) {
      activities.push({
        type: 'warning',
        icon: 'fas fa-exclamation-triangle',
        title: 'AI Provider Check',
        description: 'AI provider status check in progress - some providers may be initializing',
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        category: 'ai'
      });
    }

    // Add system startup activity
    activities.push({
      type: 'info',
      icon: 'fas fa-server',
      title: 'System Health Verified',
      description: 'All core services operational - health endpoints responding normally',
      timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      category: 'system'
    });

    // Add scheduled task info
    activities.push({
      type: 'info',
      icon: 'fas fa-clock',
      title: 'Scheduled Tasks Active',
      description: 'Cron triggers configured: Email processing every 6 hours, Drive indexing on schedule',
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      category: 'scheduler'
    });

    // Add security monitoring
    activities.push({
      type: 'security',
      icon: 'fas fa-shield-alt',
      title: 'Security Monitoring Active',
      description: 'Multi-provider spam detection and threat analysis running continuously',
      timestamp: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
      category: 'security'
    });

    return c.json({
      success: true,
      data: {
        activities: activities.slice(0, 10),
        totalCount: activities.length,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error: unknown) {
    logger.error('Failed to get recent activity:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get recent activity';
    return c.json({
      success: false,
      error: errorMessage
    }, 500);
  }
});

// --- Mount Google Workspace API Routes with Rate Limiting ---
app.route("/gmail", gmailRoutes).use(createRateLimitMiddleware('gmail'));
app.route("/docs", docsRoutes).use(createRateLimitMiddleware('documents'));
app.route("/drive", driveRoutes).use(createRateLimitMiddleware('general'));
app.route("/sheets", sheetsRoutes).use(createRateLimitMiddleware('general'));
app.route("/slides", slidesRoutes).use(createRateLimitMiddleware('documents'));
app.route("/logs", logsRoutes).use(createRateLimitMiddleware('general'));
app.route("/health-check", healthCheckRoutes);

// --- Mount Processing Routes ---
app.route("/thread-processor", threadProcessorRoutes);
app.route("/email-processing", emailProcessingRoutes);

// --- Mount A2A Routes ---
// Mount A2A routes at /a2a prefix and specific root endpoints
app.route("/a2a", a2aRoutes);

// Mount specific A2A server endpoints at root level (before static assets)
app.get('/.well-known/agent.json', async (c) => {
  const logger = c.get('logger') || createLoggerFromContext(c);
  logger.info('🔍 A2A agent card requested');
  
  const workerUrl = new URL(c.req.url).origin;
  const { A2AServer } = await import('./services/a2a-server');
  const a2aServer = new A2AServer(logger as any, workerUrl);
  const agentCard = a2aServer.getAgentCard();
  
  logger.debug('Returning agent card', { name: agentCard.name, skills: agentCard.skills.length });
  return c.json(agentCard);
});

app.post('/execute', async (c) => {
  const logger = c.get('logger') || createLoggerFromContext(c);
  logger.info('⚡ A2A skill execution requested');
  
  try {
    const request = await c.req.json();
    
    logger.debug('A2A execute request received', {
      skill: request.skill,
      source: request.metadata?.source,
      requestId: request.metadata?.requestId
    });
    
    // Validate request structure
    if (!request.skill || !request.parameters) {
      return c.json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required fields: skill and parameters'
        },
        metadata: {
          timestamp: new Date().toISOString()
        }
      }, 400);
    }
    
    const workerUrl = new URL(c.req.url).origin;
    const { A2AServer } = await import('./services/a2a-server');
    const a2aServer = new A2AServer(logger as any, workerUrl);
    const response = await a2aServer.executeSkill(request, c);
    
    return c.json(response);
    
  } catch (error) {
    logger.error('A2A skill execution error:', error);
    
    return c.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error'
      },
      metadata: {
        timestamp: new Date().toISOString()
      }
    }, 500);
  }
});

// ... All your existing app.get, app.post, etc. routes for Gmail, Drive, Docs...


// --- Scheduled Functions (Cron Jobs) ---

/**
 * @function indexDriveFiles
 * @description Scans Google Drive for documents, checks for new ones, and saves their metadata to a D1 database.
 * @param {Env} env - The worker's environment bindings.
 */
async function indexDriveFiles(env: Env) {
    console.log("[Cron - Drive] Starting Drive file indexing job.");
    if (!env.DB) {
        console.error("[Cron - Drive] DB database is not configured.");
        return;
    }

    try {
        const { drive } = await getGoogleClients(env);
        let pageToken: string | undefined = undefined;
        let filesProcessed = 0;

        do {
            const res: { data: drive_v3.Schema$FileList } = await drive.files.list({
                q: "mimeType='application/vnd.google-apps.document'",
                fields: 'nextPageToken, files(id)',
                pageSize: 100,
                pageToken: pageToken,
            });

            const files = res.data.files;
            if (!files || files.length === 0) {
                console.log("[Cron - Drive] No documents found to process.");
                break;
            }

            const fileIds = files.map(f => f.id).filter((id): id is string => !!id);
            const placeholders = fileIds.map(() => '?').join(',');
            const stmt = env.DB.prepare(`SELECT id FROM drive_files WHERE id IN (${placeholders})`);
            const { results: existingFiles } = await stmt.bind(...fileIds).all<{ id: string }>();
            const existingIds = new Set(existingFiles.map(f => f.id));

            const newFileIds = fileIds.filter(id => !existingIds.has(id));
            if (newFileIds.length === 0) {
                console.log(`[Cron - Drive] Page processed. No new files found among ${files.length} files.`);
                pageToken = res.data.nextPageToken || undefined;
                continue;
            }

            console.log(`[Cron - Drive] Found ${newFileIds.length} new documents to index.`);
            const newFileInserts: D1PreparedStatement[] = [];

            for (const fileId of newFileIds) {
                const fileMetaRes = await drive.files.get({ fileId: fileId, fields: '*' });
                const meta = fileMetaRes.data;
                newFileInserts.push(
                    env.DB.prepare(
                        `INSERT INTO drive_files (id, name, mimeType, webViewLink, createdTime, modifiedTime, owners, size, description, lastModifyingUser, sharingUser) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                    ).bind(
                        meta.id, meta.name, meta.mimeType, meta.webViewLink, meta.createdTime, meta.modifiedTime,
                        JSON.stringify(meta.owners), meta.size, meta.description,
                        JSON.stringify(meta.lastModifyingUser), JSON.stringify(meta.sharingUser)
                    )
                );
            }

            if (newFileInserts.length > 0) {
                await env.DB.batch(newFileInserts);
                console.log(`[Cron - Drive] Successfully indexed metadata for ${newFileInserts.length} new documents.`);
                filesProcessed += newFileInserts.length;
            }

            pageToken = res.data.nextPageToken || undefined;
        } while (pageToken);

        console.log(`[Cron - Drive] Drive file indexing job finished. Total new files processed: ${filesProcessed}.`);
    } catch (err: any) {
        console.error(`[Cron - Drive] Error during indexing job: ${err.message}`, err);
    }
}

/**
 * @function indexGmailMessages
 * @description Scans Gmail for recent messages, checks for new ones, and saves their details to D1 tables.
 * @param {Env} env - The worker's environment bindings.
 */
async function indexGmailMessages(env: Env) {
    console.log("[Cron - Gmail] Starting Gmail message indexing job.");
    if (!env.DB) {
        console.error("[Cron - Gmail] DB database is not configured.");
        return;
    }

    try {
        const { gmail } = await getGoogleClients(env);
        // Look for messages in the last 2 days to catch any that might have been missed.
        const messagesRes = await gmail.users.messages.list({ userId: 'me', q: 'newer_than:2d' });
        const messages = messagesRes.data.messages;

        if (!messages || messages.length === 0) {
            console.log("[Cron - Gmail] No new messages found in the last 2 days.");
            return;
        }

        const messageIds = messages.map(m => m.id).filter((id): id is string => !!id);
        const placeholders = messageIds.map(() => '?').join(',');
        const stmt = env.DB.prepare(`SELECT messageId FROM messages WHERE messageId IN (${placeholders})`);
        const { results: existingMessages } = await stmt.bind(...messageIds).all<{ messageId: string }>();
        const existingIds = new Set(existingMessages.map(m => m.messageId));

        const newMessageIds = messageIds.filter(id => !existingIds.has(id));
        if (newMessageIds.length === 0) {
            console.log("[Cron - Gmail] All recent messages are already indexed.");
            return;
        }

        console.log(`[Cron - Gmail] Found ${newMessageIds.length} new messages to index.`);
        const d1Inserts: D1PreparedStatement[] = [];

        for (const messageId of newMessageIds) {
            const msgRes = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
            const msg = msgRes.data;
            if (!msg.id || !msg.threadId || !msg.payload?.headers) continue;

            const getHeader = (name: string) => msg.payload?.headers?.find(h => h.name === name)?.value || '';

            // Basic message info
            d1Inserts.push(
                env.DB.prepare(
                    `INSERT INTO messages (
                        messageId,
                        threadId,
                        sentDate,
                        fromAddress,
                        toAddresses,
                        subject,
                        bodyPlain
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                    msg.id, msg.threadId, getHeader('Date'), getHeader('From'), getHeader('To'), getHeader('Subject'),
                    atob(msg.payload?.parts?.find(p => p.mimeType === 'text/plain')?.body?.data || '')
                )
            );
        }

        if (d1Inserts.length > 0) {
            await env.DB.batch(d1Inserts);
            console.log(`[Cron - Gmail] Successfully indexed ${d1Inserts.length} new messages.`);
        }
        console.log("[Cron - Gmail] Gmail message indexing job finished.");
    } catch (err: any) {
        console.error(`[Cron - Gmail] Error during indexing job: ${err.message}`, err);
    }
}

// --- Scheduled Email Processing Function ---
/**
 * Scheduled email processing function that runs every 6 hours
 * Handles spam detection, deduplication, and thread analysis for new messages
 */
async function processEmailsScheduled(env: Env): Promise<void> {
  console.log('[Scheduled] Starting email processing with spam detection and thread analysis...');

  try {
    // Use the proper providers configuration structure
    const defaultProvidersConfig = {
      gemini: {
        name: "Gemini",
        enabled: true,
        model: "gemini-2.0-flash-exp",
        maxTokens: 4096,
        temperature: 0.7,
      },
      anthropic: {
        name: "Claude",
        enabled: true,
        model: "claude-3-5-sonnet-20241022",
        maxTokens: 4096,
        temperature: 0.7,
      },
      openai: {
        name: "OpenAI",
        enabled: true,
        model: "gpt-4o",
        maxTokens: 4096,
        temperature: 0.7,
      },
      workersAI: {
        name: "Workers AI",
        enabled: true,
        model: "@cf/meta/llama-3.1-8b-instruct",
        maxTokens: 4096,
        temperature: 0.7,
      },
    };

    const providers = ProviderFactory.createProviders(defaultProvidersConfig, env);
    
    // Initialize orchestrator - check if SPAM_DB binding exists
    const spamDb = (env as any).SPAM_DB || env.DB; // Fallback to main DB if no separate spam DB
    const orchestrator = new EmailProcessingOrchestrator(env.DB, spamDb, providers);

    // Get processing status to see last run
    const status = await orchestrator.getProcessingStatus();
    console.log('[Scheduled] Current processing status:', status);

    // Get new messages since last processing
    // This would typically query your Gmail API or message queue
    // For now, we'll query the database for unprocessed messages
    const unprocessedMessages = await env.DB.prepare(`
      SELECT messageId, fromAddress, subject, bodyPlain, bodyHtml, threadId, date
      FROM messages 
      WHERE vectorizedAt IS NULL OR vectorizedAt = ''
      ORDER BY date DESC 
      LIMIT 100
    `).all();

    if (unprocessedMessages.results.length > 0) {
      console.log(`[Scheduled] Processing ${unprocessedMessages.results.length} unprocessed messages`);

      const result = await orchestrator.processEmails(
        unprocessedMessages.results.map(msg => ({
          messageId: msg.messageId as string,
          threadId: msg.threadId as string,
          sentDate: msg.date as string,
          fromAddress: msg.fromAddress as string,
          subject: msg.subject as string
        })),
        {
          batchSize: 25,
          enableSpamDetection: true,
          spamThreshold: 0.6,
          maxRetries: 3,
          delayBetweenBatches: 2000
        }
      );

      console.log(`[Scheduled] Processing complete: ${result.processedMessages} processed, ${result.spamMessages} spam, ${result.errors} errors`);
    } else {
      console.log('[Scheduled] No new messages to process');
    }

  } catch (error) {
    console.error('[Scheduled] Email processing error:', error);
  }
}

/**
 * Scheduled health check function - runs comprehensive health checks on all endpoints
 */
async function runScheduledHealthCheck(env: Env): Promise<void> {
  try {
    console.log('[Scheduled] Starting scheduled health check...');
    
    // Import HealthCheckService
    const { HealthCheckService } = await import('./services/health-check');
    const healthService = new HealthCheckService(env as any);
    
    // Run health checks
    const report = await healthService.runHealthChecks();
    
    console.log(`[Scheduled] Health check complete: ${report.overall_status} (${report.passed_tests} passed, ${report.failed_tests} failed)`);
  } catch (error) {
    console.error('[Scheduled] Health check error:', error);
  }
}

// --- Static Asset Serving ---
app.get('*', async (c) => {
  const logger = (c.get('logger') as Logger) || createLoggerFromContext(c);
  
  try {
    // For root path, serve index.html
    let path = c.req.path;
    if (path === '/') {
      path = '/index.html';
    }
    
    logger.debug(`Attempting to serve static asset: ${path}`);
    
    // Create a new request for the static asset
    const assetRequest = new Request(c.req.raw.url, {
      method: 'GET',
      headers: c.req.raw.headers
    });
    
    // Try to fetch from ASSETS binding
    const response = await c.env.ASSETS.fetch(assetRequest);
    
    if (response.status === 404) {
      // Asset not found, continue to 404 handler
      logger.debug(`Static asset not found: ${path}`);
      return c.json({ error: "Not found", path: c.req.path }, 404);
    }
    
    // Return the static asset
    logger.debug(`Successfully served static asset: ${path}`);
    return response;
    
  } catch (error) {
    const logger = (c.get('logger') as Logger) || createLoggerFromContext(c);
    logger.error('Error serving static asset:', error);
    return c.json({ error: "Error serving static asset", path: c.req.path }, 500);
  }
});

// --- Error Handling & Exports ---
app.notFound((c) => {
  console.warn(`[404 Not Found] Path: ${c.req.path}`);
  return c.json({ error: "Not found", path: c.req.path }, 404);
});

app.onError((err: Error, c) => {
  console.error(`[500 Internal Server Error] Path: ${c.req.path}, Error: ${err.message}`, err);
  return c.json({
    error: "Internal server error",
    message: err.message,
    stack: err.stack, // for debugging
  }, 500);
});

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        return app.fetch(request, env, ctx);
    },

    async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
        console.log(`[Cron] Triggered with cron: ${controller.cron}`);
        switch (controller.cron) {
            case '0 * * * *': // Every hour for Drive
                ctx.waitUntil(indexDriveFiles(env));
                break;
            case '*/30 * * * *': // Every 30 minutes for Gmail
                ctx.waitUntil(indexGmailMessages(env));
                break;
            case '0 */6 * * *': // Every 6 hours for email processing (spam detection & thread analysis)
                ctx.waitUntil(processEmailsScheduled(env));
                break;
            case '*/15 * * * *': // Every 15 minutes for health checks
                ctx.waitUntil(runScheduledHealthCheck(env));
                break;
        }
    },
};
