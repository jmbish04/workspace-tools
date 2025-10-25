/**
 * @module performance-monitor
 * @description Performance monitoring utilities for tracking metrics and optimizing performance.
 * Provides timing, memory usage, and performance analytics.
 */

/**
 * @interface PerformanceMetric
 * @description Represents a single performance metric.
 */
export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

/**
 * @interface PerformanceStats
 * @description Aggregated performance statistics.
 */
export interface PerformanceStats {
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  total: number;
}

/**
 * @interface MemoryUsage
 * @description Memory usage information.
 */
export interface MemoryUsage {
  used: number;
  total: number;
  percentage: number;
  timestamp: number;
}

/**
 * @class PerformanceMonitor
 * @description Monitors and tracks performance metrics.
 */
export class PerformanceMonitor {
  private metrics = new Map<string, PerformanceMetric[]>();
  private timers = new Map<string, number>();
  private maxMetricsPerName = 1000;

  /**
   * Starts a timer for a named operation.
   * @param {string} name The name of the operation.
   * @returns {void}
   */
  startTimer(name: string): void {
    this.timers.set(name, performance.now());
  }

  /**
   * Ends a timer and records the duration.
   * @param {string} name The name of the operation.
   * @param {Record<string, string>} [tags] Optional tags for the metric.
   * @returns {number} The duration in milliseconds.
   */
  endTimer(name: string, tags?: Record<string, string>): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      console.warn(`[PerformanceMonitor] Timer '${name}' was not started`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(name);
    
    this.recordMetric(name, duration, tags);
    return duration;
  }

  /**
   * Records a performance metric.
   * @param {string} name The name of the metric.
   * @param {number} value The value of the metric.
   * @param {Record<string, string>} [tags] Optional tags for the metric.
   * @returns {void}
   */
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      tags
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metrics = this.metrics.get(name)!;
    metrics.push(metric);

    // Keep only the most recent metrics
    if (metrics.length > this.maxMetricsPerName) {
      metrics.splice(0, metrics.length - this.maxMetricsPerName);
    }
  }

  /**
   * Gets performance statistics for a metric.
   * @param {string} name The name of the metric.
   * @param {number} [timeWindow] Time window in milliseconds (default: all time).
   * @returns {PerformanceStats | null} The performance statistics or null if no data.
   */
  getStats(name: string, timeWindow?: number): PerformanceStats | null {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    let filteredMetrics = metrics;
    if (timeWindow) {
      const cutoff = Date.now() - timeWindow;
      filteredMetrics = metrics.filter(m => m.timestamp >= cutoff);
    }

    if (filteredMetrics.length === 0) {
      return null;
    }

    const values = filteredMetrics.map(m => m.value).sort((a, b) => a - b);
    const count = values.length;
    const total = values.reduce((sum, val) => sum + val, 0);
    const avg = total / count;
    const min = values[0];
    const max = values[count - 1];
    const p50 = values[Math.floor(count * 0.5)];
    const p95 = values[Math.floor(count * 0.95)];
    const p99 = values[Math.floor(count * 0.99)];

    return {
      count,
      min,
      max,
      avg,
      p50,
      p95,
      p99,
      total
    };
  }

  /**
   * Gets all performance statistics.
   * @param {number} [timeWindow] Time window in milliseconds (default: all time).
   * @returns {Record<string, PerformanceStats>} All performance statistics.
   */
  getAllStats(timeWindow?: number): Record<string, PerformanceStats> {
    const stats: Record<string, PerformanceStats> = {};
    
    for (const name of this.metrics.keys()) {
      const stat = this.getStats(name, timeWindow);
      if (stat) {
        stats[name] = stat;
      }
    }

    return stats;
  }

  /**
   * Gets memory usage information.
   * @returns {MemoryUsage | null} Memory usage information or null if not available.
   */
  getMemoryUsage(): MemoryUsage | null {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      const total = usage.heapTotal;
      const used = usage.heapUsed;
      
      return {
        used,
        total,
        percentage: (used / total) * 100,
        timestamp: Date.now()
      };
    }

    return null;
  }

  /**
   * Clears all metrics.
   * @returns {void}
   */
  clear(): void {
    this.metrics.clear();
    this.timers.clear();
  }

  /**
   * Clears metrics for a specific name.
   * @param {string} name The name of the metric to clear.
   * @returns {void}
   */
  clearMetric(name: string): void {
    this.metrics.delete(name);
    this.timers.delete(name);
  }

  /**
   * Gets a summary of all metrics.
   * @returns {object} A summary of all metrics.
   */
  getSummary(): {
    totalMetrics: number;
    metricNames: string[];
    memoryUsage: MemoryUsage | null;
    recentStats: Record<string, PerformanceStats>;
  } {
    const totalMetrics = Array.from(this.metrics.values()).reduce((sum, metrics) => sum + metrics.length, 0);
    const metricNames = Array.from(this.metrics.keys());
    const memoryUsage = this.getMemoryUsage();
    const recentStats = this.getAllStats(5 * 60 * 1000); // Last 5 minutes

    return {
      totalMetrics,
      metricNames,
      memoryUsage,
      recentStats
    };
  }
}

/**
 * @class PerformanceTimer
 * @description A utility class for timing operations with automatic cleanup.
 */
export class PerformanceTimer {
  private monitor: PerformanceMonitor;
  private name: string;
  private tags?: Record<string, string>;

  constructor(monitor: PerformanceMonitor, name: string, tags?: Record<string, string>) {
    this.monitor = monitor;
    this.name = name;
    this.tags = tags;
    this.monitor.startTimer(name);
  }

  /**
   * Ends the timer and records the duration.
   * @returns {number} The duration in milliseconds.
   */
  end(): number {
    return this.monitor.endTimer(this.name, this.tags);
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Decorator for automatically timing function execution.
 * @param {string} name The name for the metric.
 * @param {Record<string, string>} [tags] Optional tags for the metric.
 * @returns {Function} The decorator function.
 */
export function timed(name: string, tags?: Record<string, string>) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const timer = new PerformanceTimer(performanceMonitor, name, tags);
      try {
        const result = await method.apply(this, args);
        return result;
      } finally {
        timer.end();
      }
    };
  };
}

/**
 * Utility function for timing async operations.
 * @param {string} name The name for the metric.
 * @param {Function} operation The operation to time.
 * @param {Record<string, string>} [tags] Optional tags for the metric.
 * @returns {Promise<T>} The result of the operation.
 */
export async function timeAsync<T>(
  name: string,
  operation: () => Promise<T>,
  tags?: Record<string, string>
): Promise<T> {
  const timer = new PerformanceTimer(performanceMonitor, name, tags);
  try {
    return await operation();
  } finally {
    timer.end();
  }
}

/**
 * Utility function for timing synchronous operations.
 * @param {string} name The name for the metric.
 * @param {Function} operation The operation to time.
 * @param {Record<string, string>} [tags] Optional tags for the metric.
 * @returns {T} The result of the operation.
 */
export function timeSync<T>(
  name: string,
  operation: () => T,
  tags?: Record<string, string>
): T {
  const timer = new PerformanceTimer(performanceMonitor, name, tags);
  try {
    return operation();
  } finally {
    timer.end();
  }
}
