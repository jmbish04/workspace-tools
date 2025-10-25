/**
 * @module rate-limiter
 * @description Rate limiting utilities for API endpoints.
 * This module provides functions for implementing rate limiting using Cloudflare KV storage
 * to prevent abuse and ensure fair usage of the workspace tools API.
 */

/**
 * Rate limit configuration interface
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyPrefix: string; // Prefix for KV keys
}

/**
 * Rate limit result interface
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * Default rate limit configurations
 */
export const RATE_LIMIT_CONFIGS = {
  // General API rate limit
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
    keyPrefix: 'rate_limit_general'
  },
  
  // Gmail API rate limit (more restrictive)
  gmail: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    keyPrefix: 'rate_limit_gmail'
  },
  
  // AI provider rate limit
  ai: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
    keyPrefix: 'rate_limit_ai'
  },
  
  // Document operations rate limit
  documents: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 50,
    keyPrefix: 'rate_limit_docs'
  },
  
  // Search operations rate limit
  search: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    keyPrefix: 'rate_limit_search'
  }
};

/**
 * Rate limiter class
 */
export class RateLimiter {
  private kv: KVNamespace;
  private config: RateLimitConfig;

  constructor(kv: KVNamespace, config: RateLimitConfig) {
    this.kv = kv;
    this.config = config;
  }

  getConfig(): RateLimitConfig {
    return this.config;
  }

  /**
   * Checks if a request should be allowed based on rate limiting rules
   * @param identifier Unique identifier for the client (IP, user ID, etc.)
   * @returns Promise<RateLimitResult> Rate limit check result
   */
  async checkRateLimit(identifier: string): Promise<RateLimitResult> {
    const key = `${this.config.keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    try {
      // Get current request count from KV
      const currentData = await this.kv.get(key, 'json') as { count: number; windowStart: number } | null;
      
      let count = 0;
      let windowStartTime = now;

      if (currentData && currentData.windowStart > windowStart) {
        // Still within the current window
        count = currentData.count;
        windowStartTime = currentData.windowStart;
      } else {
        // New window or no previous data
        count = 0;
        windowStartTime = now;
      }

      // Check if limit exceeded
      if (count >= this.config.maxRequests) {
        const resetTime = windowStartTime + this.config.windowMs;
        const retryAfter = Math.ceil((resetTime - now) / 1000);
        
        return {
          allowed: false,
          remaining: 0,
          resetTime,
          retryAfter
        };
      }

      // Increment counter
      const newCount = count + 1;
      const newData = {
        count: newCount,
        windowStart: windowStartTime
      };

      // Store updated data with TTL
      await this.kv.put(key, JSON.stringify(newData), {
        expirationTtl: Math.ceil(this.config.windowMs / 1000)
      });

      return {
        allowed: true,
        remaining: this.config.maxRequests - newCount,
        resetTime: windowStartTime + this.config.windowMs
      };

    } catch (error) {
      // If KV operation fails, allow the request but log the error
      console.error('Rate limiting error:', error);
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetTime: now + this.config.windowMs
      };
    }
  }

  /**
   * Gets current rate limit status without incrementing the counter
   * @param identifier Unique identifier for the client
   * @returns Promise<RateLimitResult> Current rate limit status
   */
  async getRateLimitStatus(identifier: string): Promise<RateLimitResult> {
    const key = `${this.config.keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    try {
      const currentData = await this.kv.get(key, 'json') as { count: number; windowStart: number } | null;
      
      if (!currentData || currentData.windowStart <= windowStart) {
        // No data or expired window
        return {
          allowed: true,
          remaining: this.config.maxRequests,
          resetTime: now + this.config.windowMs
        };
      }

      const remaining = Math.max(0, this.config.maxRequests - currentData.count);
      const resetTime = currentData.windowStart + this.config.windowMs;

      return {
        allowed: remaining > 0,
        remaining,
        resetTime,
        retryAfter: remaining === 0 ? Math.ceil((resetTime - now) / 1000) : undefined
      };

    } catch (error) {
      console.error('Rate limit status check error:', error);
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetTime: now + this.config.windowMs
      };
    }
  }
}

/**
 * Creates a rate limiter instance for a specific configuration
 * @param kv Cloudflare KV namespace
 * @param configName Name of the rate limit configuration
 * @returns RateLimiter instance
 */
export function createRateLimiter(kv: KVNamespace, configName: keyof typeof RATE_LIMIT_CONFIGS): RateLimiter {
  const config = RATE_LIMIT_CONFIGS[configName];
  return new RateLimiter(kv, config);
}

/**
 * Rate limiting middleware factory
 * @param configName Name of the rate limit configuration
 * @returns Middleware function for Hono
 */
export function createRateLimitMiddleware(configName: keyof typeof RATE_LIMIT_CONFIGS) {
  return async (c: any, next: () => Promise<void>) => {
    // Skip rate limiting if no KV binding available
    if (!c.env.RATE_LIMIT_KV) {
      await next();
      return;
    }

    const rateLimiter = createRateLimiter(c.env.RATE_LIMIT_KV, configName);
    
    // Get client identifier (IP address or user ID)
    const identifier = c.req.header('CF-Connecting-IP') || 
                      c.req.header('X-Forwarded-For') || 
                      c.req.header('X-Real-IP') || 
                      'unknown';

    const result = await rateLimiter.checkRateLimit(identifier);

    if (!result.allowed) {
      // Set rate limit headers
      c.header('X-RateLimit-Limit', rateLimiter.getConfig().maxRequests.toString());
      c.header('X-RateLimit-Remaining', result.remaining.toString());
      c.header('X-RateLimit-Reset', result.resetTime.toString());
      
      if (result.retryAfter) {
        c.header('Retry-After', result.retryAfter.toString());
      }

      return c.json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: result.retryAfter,
          resetTime: new Date(result.resetTime).toISOString()
        }
      }, 429);
    }

    // Set rate limit headers for successful requests
      c.header('X-RateLimit-Limit', rateLimiter.getConfig().maxRequests.toString());
    c.header('X-RateLimit-Remaining', result.remaining.toString());
    c.header('X-RateLimit-Reset', result.resetTime.toString());

    await next();
  };
}

/**
 * Gets rate limit status for a client
 * @param kv Cloudflare KV namespace
 * @param configName Name of the rate limit configuration
 * @param identifier Client identifier
 * @returns Promise<RateLimitResult> Rate limit status
 */
export async function getRateLimitStatus(
  kv: KVNamespace, 
  configName: keyof typeof RATE_LIMIT_CONFIGS, 
  identifier: string
): Promise<RateLimitResult> {
  const rateLimiter = createRateLimiter(kv, configName);
  return await rateLimiter.getRateLimitStatus(identifier);
}
