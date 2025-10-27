import { Hono } from 'hono';
import { HealthCheckService } from '../services/health-check';
import { Env } from '../types';

const app = new Hono<{ Bindings: Env & Record<string, unknown> }>();

/**
 * GET /health-check/run - Trigger a health check
 */
app.get('/run', async (c) => {
    try {
        const healthService = new HealthCheckService(c.env, c.req.url.replace('/health-check/run', ''));
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

