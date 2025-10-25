/**
 * @module cache
 * @description Caching utilities for improving performance and reducing API calls.
 * Provides in-memory caching with TTL support and cache invalidation strategies.
 */

/**
 * @interface CacheEntry
 * @description Represents a single cache entry with metadata.
 */
export interface CacheEntry<T = any> {
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
  lastAccessed: number;
}

/**
 * @interface CacheConfig
 * @description Configuration options for the cache.
 */
export interface CacheConfig {
  defaultTtl: number; // Default TTL in milliseconds
  maxSize: number; // Maximum number of entries
  cleanupInterval: number; // Cleanup interval in milliseconds
}

/**
 * @class MemoryCache
 * @description In-memory cache implementation with TTL support and LRU eviction.
 */
export class MemoryCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private config: CacheConfig;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTtl: 5 * 60 * 1000, // 5 minutes
      maxSize: 1000,
      cleanupInterval: 60 * 1000, // 1 minute
      ...config
    };

    // Start cleanup timer
    this.startCleanupTimer();
  }

  /**
   * Gets a value from the cache.
   * @param {string} key The cache key.
   * @returns {T | undefined} The cached value or undefined if not found or expired.
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return undefined;
    }

    // Update access statistics
    entry.hits++;
    entry.lastAccessed = Date.now();

    return entry.value;
  }

  /**
   * Sets a value in the cache.
   * @param {string} key The cache key.
   * @param {T} value The value to cache.
   * @param {number} [ttl] Optional TTL override.
   * @returns {boolean} True if the value was set successfully.
   */
  set(key: string, value: T, ttl?: number): boolean {
    // Check if we need to evict entries
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl: ttl ?? this.config.defaultTtl,
      hits: 0,
      lastAccessed: Date.now()
    };

    this.cache.set(key, entry);
    return true;
  }

  /**
   * Deletes a value from the cache.
   * @param {string} key The cache key.
   * @returns {boolean} True if the key was deleted.
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clears all entries from the cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Checks if a key exists in the cache and is not expired.
   * @param {string} key The cache key.
   * @returns {boolean} True if the key exists and is not expired.
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    return entry !== undefined && !this.isExpired(entry);
  }

  /**
   * Gets cache statistics.
   * @returns {object} Cache statistics.
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    totalHits: number;
    totalMisses: number;
    oldestEntry: number;
    newestEntry: number;
  } {
    const entries = Array.from(this.cache.values());
    const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0);
    const totalMisses = this.cache.size - totalHits;
    const hitRate = totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0;
    
    const timestamps = entries.map(entry => entry.timestamp);
    const oldestEntry = timestamps.length > 0 ? Math.min(...timestamps) : 0;
    const newestEntry = timestamps.length > 0 ? Math.max(...timestamps) : 0;

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate,
      totalHits,
      totalMisses,
      oldestEntry,
      newestEntry
    };
  }

  /**
   * Checks if a cache entry has expired.
   * @private
   * @param {CacheEntry<T>} entry The cache entry to check.
   * @returns {boolean} True if the entry has expired.
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Evicts the least recently used entry.
   * @private
   */
  private evictLRU(): void {
    let lruKey: string | undefined;
    let lruTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  /**
   * Starts the cleanup timer for expired entries.
   * @private
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Cleans up expired entries.
   * @private
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key));

    if (expiredKeys.length > 0) {
      console.log(`[MemoryCache] Cleaned up ${expiredKeys.length} expired entries`);
    }
  }

  /**
   * Destroys the cache and cleans up resources.
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clear();
  }
}

/**
 * @class CacheManager
 * @description Manages multiple cache instances for different purposes.
 */
export class CacheManager {
  private caches = new Map<string, MemoryCache>();

  /**
   * Gets or creates a cache instance.
   * @param {string} name The cache name.
   * @param {Partial<CacheConfig>} [config] Optional cache configuration.
   * @returns {MemoryCache} The cache instance.
   */
  getCache<T = any>(name: string, config?: Partial<CacheConfig>): MemoryCache<T> {
    if (!this.caches.has(name)) {
      this.caches.set(name, new MemoryCache<T>(config));
    }
    return this.caches.get(name) as MemoryCache<T>;
  }

  /**
   * Clears all caches.
   */
  clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }

  /**
   * Destroys all caches.
   */
  destroyAll(): void {
    for (const cache of this.caches.values()) {
      cache.destroy();
    }
    this.caches.clear();
  }

  /**
   * Gets statistics for all caches.
   * @returns {Record<string, any>} Statistics for all caches.
   */
  getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    for (const [name, cache] of this.caches.entries()) {
      stats[name] = cache.getStats();
    }
    return stats;
  }
}

// Global cache manager instance
export const cacheManager = new CacheManager();

// Predefined cache configurations
export const CACHE_CONFIGS = {
  // Short-term cache for API responses
  API_RESPONSE: {
    defaultTtl: 2 * 60 * 1000, // 2 minutes
    maxSize: 500,
    cleanupInterval: 30 * 1000 // 30 seconds
  },
  
  // Medium-term cache for user data
  USER_DATA: {
    defaultTtl: 10 * 60 * 1000, // 10 minutes
    maxSize: 200,
    cleanupInterval: 60 * 1000 // 1 minute
  },
  
  // Long-term cache for static data
  STATIC_DATA: {
    defaultTtl: 60 * 60 * 1000, // 1 hour
    maxSize: 100,
    cleanupInterval: 5 * 60 * 1000 // 5 minutes
  }
} as const;
