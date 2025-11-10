import { Hono } from 'hono';
import { DriveClient, runDriveHealthChecks } from '../drive';
import { HealthCheckService } from '../services/health-check';
import type { Env } from '../types';
import type { LoggerAdapter } from '../utils/logger-adapter';
import { getTestDashboardSnapshot, runHealthTestSuite } from '../testing/runner';
import { analyzeHealthReport } from './agent';

const app = new Hono<{ 
    Bindings: Env & Record<string, unknown>;
    Variables: {
        logger: LoggerAdapter;
    };
}>();

/**
 * GET /health - Basic readiness probe for database access and AI availability
 */
app.get('/', async (c) => {
    let dbOk = false;
    try {
        await c.env.DB.prepare('SELECT 1').run();
        dbOk = true;
    } catch (error) {
        dbOk = false;
    }

    const agentOk = Boolean(c.env.AI);

    return c.json({
        dbOk,
        agentOk,
        timestamp: new Date().toISOString()
    }, dbOk && agentOk ? 200 : 500);
});

/**
 * GET /health/tests - Retrieve active test definitions with their latest status
 */
app.get('/tests', async (c) => {
    try {
        const snapshot = await getTestDashboardSnapshot(c.env);
        return c.json({
            success: true,
            data: snapshot,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }, 500);
    }
});

/**
 * POST /health/tests/run - Execute all registered health tests on demand
 */
app.post('/tests/run', async (c) => {
    try {
        const logger = c.get('logger') as LoggerAdapter | undefined;
        const summary = await runHealthTestSuite(c.env, { logger });
        return c.json({
            success: true,
            data: summary,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        const logger = c.get('logger') as LoggerAdapter | undefined;
        logger?.error('Health test suite failed', error);
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }, 500);
    }
});

/** 
 * POST /health/run - Execute Drive health diagnostics and AI analysis
 */
app.post('/run', async (c) => {
    const logger = c.get('logger') as LoggerAdapter | undefined;
    const db = c.env.DB;
    const reportId = crypto.randomUUID();

    try {
        await db.prepare('INSERT INTO health_reports (id, status) VALUES (?, ?)')
            .bind(reportId, 'RUNNING')
            .run();

        const client = new DriveClient(c.env);
        const { results, logs } = await runDriveHealthChecks(client);

        const runId = crypto.randomUUID();
        const runStatus = results.every((result) => result.success) ? 'SUCCESS' : 'FAILURE';

        await db.prepare('INSERT INTO health_runs (id, report_id, service_name, status) VALUES (?, ?, ?, ?)')
            .bind(runId, reportId, 'drive', runStatus)
            .run();

        await db.prepare('INSERT INTO health_logs (id, run_id, logs_json) VALUES (?, ?, ?)')
            .bind(crypto.randomUUID(), runId, JSON.stringify({ logs, results }))
            .run();

        await db.prepare('UPDATE health_reports SET status = ? WHERE id = ?')
            .bind('ANALYZING', reportId)
            .run();

        const analysis = await analyzeHealthReport(reportId, c.env, logger);

        await db.prepare('INSERT INTO ai_analysis (id, report_id, human_summary, dev_agent_prompt, overall_fix_prompt) VALUES (?, ?, ?, ?, ?)')
            .bind(crypto.randomUUID(), reportId, analysis.human_summary, analysis.dev_agent_prompt, analysis.overall_fix_prompt)
            .run();

        await db.prepare('UPDATE health_reports SET status = ? WHERE id = ?')
            .bind('COMPLETE', reportId)
            .run();

        return c.json({
            success: true,
            reportId,
            runId,
            runStatus,
            analysis,
            timestamp: new Date().toISOString()
        }, 200);
    } catch (error: any) {
        await db.prepare('UPDATE health_reports SET status = ? WHERE id = ?')
            .bind('ERROR', reportId)
            .run();

        logger?.error('Health run failed', { error, reportId });

        return c.json({
            success: false,
            reportId,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
        }, 500);
    }
});

/**
 * GET /health-check/run - Trigger a health check
 */
app.get('/run', async (c) => {
    try {
        const url = new URL(c.req.url);
        const healthService = new HealthCheckService(c.env, url.origin);
        const report = await healthService.runHealthChecks();
        
        return c.json({
            success: true,
            data: report,
            message: 'Health check completed'
        });
    } catch (error) {
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }, 500);
    }
});

/**
 * GET /health-check/latest - Get the latest health check report
 */
app.get('/latest', async (c) => {
    try {
        const healthService = new HealthCheckService(c.env);
        const report = await healthService.getLatestReport();
        
        if (!report) {
            return c.json({
                success: false,
                error: 'No health check report found'
            }, 404);
        }
        
        return c.json({
            success: true,
            data: report
        });
    } catch (error) {
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }, 500);
    }
});

/**
 * GET /health-check/history - Get health check history
 */
app.get('/history', async (c) => {
    try {
        const endpoint = c.req.query('endpoint');
        const limit = parseInt(c.req.query('limit') || '100');
        
        const healthService = new HealthCheckService(c.env);
        const history = await healthService.getHealthCheckHistory(endpoint, limit);
        
        return c.json({
            success: true,
            data: history,
            count: history.length
        });
    } catch (error) {
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }, 500);
    }
});

/**
 * GET /health-check/reports - Get all health check reports
 */
app.get('/reports', async (c) => {
    try {
        const limit = parseInt(c.req.query('limit') || '10');
        
        const reports = await c.env.DB.prepare(
            `SELECT * FROM health_check_reports ORDER BY timestamp DESC LIMIT ?`
        ).bind(limit).all();
        
        return c.json({
            success: true,
            data: reports.results || [],
            count: reports.results?.length || 0
        });
    } catch (error) {
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }, 500);
    }
});

/**
 * GET /health-check/dashboard - Serve the health dashboard UI
 */
app.get('/dashboard', async (c) => {
    try {
        const url = new URL('/health-dashboard.html', c.req.url);
        const request = new Request(url.toString(), {
            method: 'GET',
            headers: c.req.raw.headers
        });

        const response = await c.env.ASSETS.fetch(request);
        if (response.status === 404) {
            return c.json({ success: false, error: 'Dashboard asset not found' }, 404);
        }

        return response;
    } catch (error) {
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }, 500);
    }
});

/** 
 * GET /health-check/results/:endpoint - Get results for a specific endpoint
 */
app.get('/results/:endpoint', async (c) => {
    try {
        const endpoint = c.req.param('endpoint');
        const limit = parseInt(c.req.query('limit') || '50');
        
        const healthService = new HealthCheckService(c.env);
        const results = await healthService.getHealthCheckHistory(`/${endpoint}`, limit);
        
        return c.json({
            success: true,
            data: results,
            endpoint: endpoint,
            count: results.length
        });
    } catch (error) {
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }, 500);
    }
});

export default app;
