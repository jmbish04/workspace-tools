import { Env } from '../types';

export interface HealthCheckResult {
    check_name: string;
    endpoint: string;
    status: 'pass' | 'fail' | 'warning' | 'skip';
    response_time_ms: number;
    status_code?: number;
    response_body?: string;
    error_message?: string;
    metadata?: string;
}

export interface HealthCheckReport {
    overall_status: 'pass' | 'fail' | 'warning';
    total_tests: number;
    passed_tests: number;
    failed_tests: number;
    warning_tests: number;
    skipped_tests: number;
    workers_ai_evaluation?: string;
    ai_fix_prompt?: string;
    logs_summary?: string;
    timestamp: string;
}

export class HealthCheckService {
    private env: Env;
    private baseUrl: string;

    constructor(env: Env, baseUrl: string = '') {
        this.env = env;
        this.baseUrl = baseUrl;
    }

    /**
     * Run comprehensive health checks on all endpoints
     */
    async runHealthChecks(): Promise<HealthCheckReport> {
        const results: HealthCheckResult[] = [];
        
        // Define all health check endpoints
        const checks = [
            { name: 'Gmail Health', endpoint: '/gmail/providers', method: 'GET' },
            { name: 'Google Docs Health', endpoint: '/docs/health', method: 'GET' },
            { name: 'Google Drive Health', endpoint: '/drive/health', method: 'GET' },
            { name: 'Google Sheets Health', endpoint: '/sheets/health', method: 'GET' },
            { name: 'Google Slides Health', endpoint: '/slides/health', method: 'GET' },
            { name: 'Apps Script Health', endpoint: '/appscript/health', method: 'GET' },
            { name: 'Email Processing Health', endpoint: '/email-processing/status', method: 'GET' },
            { name: 'Thread Processor Health', endpoint: '/thread-processor/health', method: 'GET' },
            { name: 'A2A Health', endpoint: '/a2a/health', method: 'GET' },
            { name: 'System Health', endpoint: '/health', method: 'GET' },
        ];

        // Run each check
        for (const check of checks) {
            const result = await this.runSingleCheck(check.name, check.endpoint, check.method);
            results.push(result);
            
            // Save individual result to D1
            await this.saveHealthCheckResult(result);
        }

        // Generate summary report
        const report = this.generateReport(results);
        
        // Run Workers AI evaluation
        const aiEvaluation = await this.evaluateHealthChecksWithAI(results);
        report.workers_ai_evaluation = aiEvaluation.human_response;
        report.ai_fix_prompt = aiEvaluation.fix_prompt;
        
        // Save report to D1
        await this.saveHealthCheckReport(report);
        
        return report;
    }

    /**
     * Run a single health check
     */
    private async runSingleCheck(
        checkName: string,
        endpoint: string,
        method: string = 'GET'
    ): Promise<HealthCheckResult> {
        const startTime = Date.now();
        
        try {
            const url = `${this.baseUrl}${endpoint}`;
            const response = await fetch(url, { method });
            const responseTime = Date.now() - startTime;
            
            let responseBody: string | undefined;
            try {
                responseBody = await response.text();
            } catch (e) {
                responseBody = undefined;
            }

            const result: HealthCheckResult = {
                check_name: checkName,
                endpoint,
                status: response.ok ? 'pass' : response.status === 404 ? 'skip' : 'fail',
                response_time_ms: responseTime,
                status_code: response.status,
                response_body: responseBody?.substring(0, 500), // Limit size
                error_message: response.ok ? undefined : `HTTP ${response.status}`,
                metadata: JSON.stringify({ method })
            };

            return result;
        } catch (error) {
            const responseTime = Date.now() - startTime;
            
            return {
                check_name: checkName,
                endpoint,
                status: 'fail',
                response_time_ms: responseTime,
                error_message: error instanceof Error ? error.message : String(error),
                metadata: JSON.stringify({ method })
            };
        }
    }

    /**
     * Generate health check report from results
     */
    private generateReport(results: HealthCheckResult[]): HealthCheckReport {
        const passed = results.filter(r => r.status === 'pass').length;
        const failed = results.filter(r => r.status === 'fail').length;
        const warnings = results.filter(r => r.status === 'warning').length;
        const skipped = results.filter(r => r.status === 'skip').length;
        
        let overall_status: 'pass' | 'fail' | 'warning' = 'pass';
        if (failed > 0) {
            overall_status = 'fail';
        } else if (warnings > 0) {
            overall_status = 'warning';
        }

        // Generate logs summary
        const logsSummary = results
            .map(r => `[${r.status.toUpperCase()}] ${r.check_name}: ${r.error_message || 'OK'} (${r.response_time_ms}ms)`)
            .join('\n');

        return {
            overall_status,
            total_tests: results.length,
            passed_tests: passed,
            failed_tests: failed,
            warning_tests: warnings,
            skipped_tests: skipped,
            logs_summary: logsSummary,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Evaluate health checks using Workers AI
     */
    private async evaluateHealthChecksWithAI(results: HealthCheckResult[]): Promise<{
        human_response: string;
        fix_prompt: string;
    }> {
        try {
            // Prepare context for AI
            const failedChecks = results.filter(r => r.status === 'fail');
            const context = `
Google Workspace Tools Cloudflare Worker Health Check Report

Failed Checks:
${failedChecks.map(r => `- ${r.check_name} (${r.endpoint}): ${r.error_message}`).join('\n')}

Architecture: Cloudflare Workers with Hono framework
APIs: Google Workspace APIs (Gmail, Drive, Docs, Sheets, Slides, Apps Script)
Authentication: Service Account with domain-wide delegation
`;

            // Use Workers AI to analyze the health checks
            const response = await this.env.AI.run('@cf/openai/gpt-oss-120b' as any, {
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert at diagnosing Google Workspace API integrations and Cloudflare Workers architecture. 
You specialize in understanding authentication issues, API errors, and system connectivity problems.`
                    },
                    {
                        role: 'user',
                        content: `Analyze the following health check failures and provide:

1. A human-readable explanation of what's wrong
2. A detailed prompt for an AI development agent to fix the issues

Context: ${context}

Please format your response as JSON with two fields: "human_response" and "fix_prompt".`
                    }
                ]
            });

            // Workers AI returns different shapes depending on the model
            let text = '';
            if (response && typeof response === 'object') {
                if ('response' in response && typeof (response as any).response === 'object') {
                    text = (response as any).response.text || '';
                } else if ('content' in response && Array.isArray((response as any).content)) {
                    text = (response as any).content.map((c: any) => c.text || '').join('');
                } else {
                    text = JSON.stringify(response);
                }
            } else {
                text = String(response);
            }
            let aiResponse: { human_response: string; fix_prompt: string };

            try {
                // Try to parse as JSON first
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    aiResponse = JSON.parse(jsonMatch[0]);
                } else {
                    // Fallback if not JSON
                    aiResponse = {
                        human_response: text,
                        fix_prompt: `Fix the following health check issues:\n\n${failedChecks.map(r => `- ${r.check_name}: ${r.error_message}`).join('\n')}`
                    };
                }
            } catch (e) {
                aiResponse = {
                    human_response: text,
                    fix_prompt: `Fix the following health check issues:\n\n${failedChecks.map(r => `- ${r.check_name}: ${r.error_message}`).join('\n')}`
                };
            }

            return aiResponse;
        } catch (error) {
            return {
                human_response: `Unable to get AI evaluation: ${error instanceof Error ? error.message : String(error)}`,
                fix_prompt: `Fix the following health check issues:\n\n${results.filter(r => r.status === 'fail').map(r => `- ${r.check_name}: ${r.error_message}`).join('\n')}`
            };
        }
    }

    /**
     * Save individual health check result to D1
     */
    private async saveHealthCheckResult(result: HealthCheckResult): Promise<void> {
        try {
            await this.env.DB.prepare(
                `INSERT INTO health_checks 
                (check_name, endpoint, status, response_time_ms, status_code, response_body, error_message, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
                result.check_name,
                result.endpoint,
                result.status,
                result.response_time_ms,
                result.status_code || null,
                result.response_body || null,
                result.error_message || null,
                result.metadata || null
            ).run();
        } catch (error) {
            console.error('Failed to save health check result:', error);
        }
    }

    /**
     * Save health check report to D1
     */
    private async saveHealthCheckReport(report: HealthCheckReport): Promise<void> {
        try {
            await this.env.DB.prepare(
                `INSERT INTO health_check_reports 
                (overall_status, total_tests, passed_tests, failed_tests, warning_tests, skipped_tests, workers_ai_evaluation, ai_fix_prompt, logs_summary)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
                report.overall_status,
                report.total_tests,
                report.passed_tests,
                report.failed_tests,
                report.warning_tests,
                report.skipped_tests,
                report.workers_ai_evaluation || null,
                report.ai_fix_prompt || null,
                report.logs_summary || null
            ).run();
        } catch (error) {
            console.error('Failed to save health check report:', error);
        }
    }

    /**
     * Get the latest health check report
     */
    async getLatestReport(): Promise<HealthCheckReport | null> {
        try {
            const result = await this.env.DB.prepare(
                `SELECT * FROM health_check_reports ORDER BY timestamp DESC LIMIT 1`
            ).first<HealthCheckReport>();

            return result || null;
        } catch (error) {
            console.error('Failed to get latest report:', error);
            return null;
        }
    }

    /**
     * Get all health check results for a specific endpoint
     */
    async getHealthCheckHistory(endpoint?: string, limit: number = 100): Promise<HealthCheckResult[]> {
        try {
            let query = 'SELECT * FROM health_checks';
            const params: any[] = [];

            if (endpoint) {
                query += ' WHERE endpoint = ?';
                params.push(endpoint);
            }

            query += ' ORDER BY timestamp DESC LIMIT ?';
            params.push(limit);

            const result = await this.env.DB.prepare(query).bind(...params).all<HealthCheckResult>();
            return result.results || [];
        } catch (error) {
            console.error('Failed to get health check history:', error);
            return [];
        }
    }
}

