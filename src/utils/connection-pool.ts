/**
 * @module connection-pool
 * @description Connection pooling utilities for managing HTTP connections and API calls.
 * Provides connection reuse, retry logic, and circuit breaker patterns.
 */

/**
 * @interface ConnectionConfig
 * @description Configuration for connection pooling.
 */
export interface ConnectionConfig {
  maxConnections: number;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  keepAlive: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
}

/**
 * @interface RequestOptions
 * @description Options for making requests through the connection pool.
 */
export interface RequestOptions {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
}

/**
 * @interface CircuitBreakerState
 * @description Represents the state of a circuit breaker.
 */
export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number;
  successCount: number;
}

/**
 * @class ConnectionPool
 * @description Manages HTTP connections with pooling, retry logic, and circuit breaker patterns.
 */
export class ConnectionPool {
  private config: ConnectionConfig;
  private activeConnections = 0;
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;

  constructor(config: Partial<ConnectionConfig> = {}) {
    this.config = {
      maxConnections: 10,
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      keepAlive: true,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000,
      ...config
    };
  }

  /**
   * Makes a request through the connection pool.
   * @param {RequestOptions} options The request options.
   * @returns {Promise<Response>} The response promise.
   */
  async request(options: RequestOptions): Promise<Response> {
    const circuitBreakerKey = this.getCircuitBreakerKey(options.url);
    
    // Check circuit breaker
    if (this.isCircuitBreakerOpen(circuitBreakerKey)) {
      throw new Error(`Circuit breaker is open for ${options.url}`);
    }

    // Queue request if at capacity
    if (this.activeConnections >= this.config.maxConnections) {
      return this.queueRequest(options);
    }

    return this.executeRequest(options);
  }

  /**
   * Executes a request with retry logic.
   * @private
   * @param {RequestOptions} options The request options.
   * @param {number} [attempt] The current attempt number.
   * @returns {Promise<Response>} The response promise.
   */
  private async executeRequest(options: RequestOptions, attempt = 1): Promise<Response> {
    const circuitBreakerKey = this.getCircuitBreakerKey(options.url);
    
    try {
      this.activeConnections++;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout || this.config.timeout);

      try {
        const response = await fetch(options.url, {
          method: options.method,
          headers: options.headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Record success
        this.recordSuccess(circuitBreakerKey);

        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        
        // Record failure
        this.recordFailure(circuitBreakerKey);

        // Retry logic
        if (attempt < (options.retries || this.config.maxRetries)) {
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
          console.log(`[ConnectionPool] Retrying request to ${options.url} in ${delay}ms (attempt ${attempt + 1})`);
          
          await this.sleep(delay);
          return this.executeRequest(options, attempt + 1);
        }

        throw error;
      }
    } finally {
      this.activeConnections--;
      this.processQueue();
    }
  }

  /**
   * Queues a request when at capacity.
   * @private
   * @param {RequestOptions} options The request options.
   * @returns {Promise<Response>} The response promise.
   */
  private async queueRequest(options: RequestOptions): Promise<Response> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const response = await this.executeRequest(options);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  /**
   * Processes the request queue.
   * @private
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0 && this.activeConnections < this.config.maxConnections) {
      const request = this.requestQueue.shift();
      if (request) {
        // Execute request asynchronously
        request().catch(error => {
          console.error('[ConnectionPool] Queued request failed:', error);
        });
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Gets the circuit breaker key for a URL.
   * @private
   * @param {string} url The URL.
   * @returns {string} The circuit breaker key.
   */
  private getCircuitBreakerKey(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.hostname}:${urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80')}`;
    } catch {
      return url;
    }
  }

  /**
   * Checks if a circuit breaker is open.
   * @private
   * @param {string} key The circuit breaker key.
   * @returns {boolean} True if the circuit breaker is open.
   */
  private isCircuitBreakerOpen(key: string): boolean {
    const state = this.circuitBreakers.get(key);
    if (!state) {
      return false;
    }

    if (state.state === 'OPEN') {
      // Check if we should transition to HALF_OPEN
      if (Date.now() - state.lastFailureTime > this.config.circuitBreakerTimeout) {
        state.state = 'HALF_OPEN';
        state.successCount = 0;
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Records a successful request.
   * @private
   * @param {string} key The circuit breaker key.
   */
  private recordSuccess(key: string): void {
    let state = this.circuitBreakers.get(key);
    if (!state) {
      state = {
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: 0,
        successCount: 0
      };
      this.circuitBreakers.set(key, state);
    }

    if (state.state === 'HALF_OPEN') {
      state.successCount++;
      if (state.successCount >= this.config.circuitBreakerThreshold) {
        state.state = 'CLOSED';
        state.failureCount = 0;
        console.log(`[ConnectionPool] Circuit breaker closed for ${key}`);
      }
    } else if (state.state === 'CLOSED') {
      state.failureCount = Math.max(0, state.failureCount - 1);
    }
  }

  /**
   * Records a failed request.
   * @private
   * @param {string} key The circuit breaker key.
   */
  private recordFailure(key: string): void {
    let state = this.circuitBreakers.get(key);
    if (!state) {
      state = {
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: 0,
        successCount: 0
      };
      this.circuitBreakers.set(key, state);
    }

    state.failureCount++;
    state.lastFailureTime = Date.now();

    if (state.failureCount >= this.config.circuitBreakerThreshold) {
      state.state = 'OPEN';
      console.log(`[ConnectionPool] Circuit breaker opened for ${key} after ${state.failureCount} failures`);
    }
  }

  /**
   * Sleeps for a specified duration.
   * @private
   * @param {number} ms The duration in milliseconds.
   * @returns {Promise<void>} A promise that resolves after the duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gets connection pool statistics.
   * @returns {object} Connection pool statistics.
   */
  getStats(): {
    activeConnections: number;
    maxConnections: number;
    queuedRequests: number;
    circuitBreakers: Record<string, CircuitBreakerState>;
  } {
    return {
      activeConnections: this.activeConnections,
      maxConnections: this.config.maxConnections,
      queuedRequests: this.requestQueue.length,
      circuitBreakers: Object.fromEntries(this.circuitBreakers.entries())
    };
  }

  /**
   * Resets the connection pool.
   */
  reset(): void {
    this.activeConnections = 0;
    this.requestQueue = [];
    this.circuitBreakers.clear();
    this.isProcessingQueue = false;
  }
}

// Global connection pool instance
export const connectionPool = new ConnectionPool({
  maxConnections: 20,
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 30000,
  keepAlive: true,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 60000
});
