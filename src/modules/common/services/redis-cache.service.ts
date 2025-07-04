import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService {
  private redis: Redis;

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
    // Initialize Redis client for advanced operations
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      family: 4,
      keyPrefix: 'confhub:',
    });

    this.redis.on('connect', () => {
      console.log('Redis connected successfully');
    });

    this.redis.on('error', (err) => {
      console.error('Redis connection error:', err);
    });
  }

  /**
   * Get value from cache with fallback to Redis client
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Try cache manager first
      const value = await this.cacheManager.get<T>(key);
      if (value !== undefined) {
        return value;
      }

      // Fallback to direct Redis client
      const redisValue = await this.redis.get(key);
      if (redisValue) {
        return JSON.parse(redisValue) as T;
      }

      return null;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      // Set in cache manager
      await this.cacheManager.set(key, value, ttl ? ttl * 1000 : undefined);

      // Also set in Redis with TTL
      const serializedValue = JSON.stringify(value);
      if (ttl) {
        await this.redis.setex(key, ttl, serializedValue);
      } else {
        await this.redis.set(key, serializedValue);
      }
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Delete key from cache
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      await this.redis.del(key);
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Delete keys by pattern and return count of deleted keys
   */
  async delByPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        // Also clear from cache manager (if possible)
        for (const key of keys) {
          await this.cacheManager.del(key.replace('confhub:', ''));
        }
        return keys.length;
      }
      return 0;
    } catch (error) {
      console.error(
        `Cache delete by pattern error for pattern ${pattern}:`,
        error,
      );
      return 0;
    }
  }

  /**
   * Get or set with callback (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    callback: () => Promise<T>,
    ttl: number = 3600,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await callback();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Increment counter in Redis
   */
  async increment(key: string, by: number = 1): Promise<number> {
    try {
      return await this.redis.incrby(key, by);
    } catch (error) {
      console.error(`Cache increment error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Set expiry for existing key
   */
  async expire(key: string, ttl: number): Promise<void> {
    try {
      await this.redis.expire(key, ttl);
    } catch (error) {
      console.error(`Cache expire error for key ${key}:`, error);
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.redis.mget(...keys);
      return values.map((value) => (value ? (JSON.parse(value) as T) : null));
    } catch (error) {
      console.error(`Cache mget error for keys ${keys.join(', ')}:`, error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple keys at once
   */
  async mset(keyValuePairs: Record<string, any>, ttl?: number): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();

      for (const [key, value] of Object.entries(keyValuePairs)) {
        const serializedValue = JSON.stringify(value);
        pipeline.set(key, serializedValue);
        if (ttl) {
          pipeline.expire(key, ttl);
        }
      }

      await pipeline.exec();
    } catch (error) {
      console.error('Cache mset error:', error);
    }
  }

  /**
   * Add to set (for storing lists of related items)
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.redis.sadd(key, ...members);
    } catch (error) {
      console.error(`Cache sadd error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get all members of a set
   */
  async smembers(key: string): Promise<string[]> {
    try {
      return await this.redis.smembers(key);
    } catch (error) {
      console.error(`Cache smembers error for key ${key}:`, error);
      return [];
    }
  }

  /**
   * Remove from set
   */
  async srem(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.redis.srem(key, ...members);
    } catch (error) {
      console.error(`Cache srem error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Flush all cache
   */
  async flushAll(): Promise<void> {
    try {
      await this.redis.flushall();
      // Note: cache-manager doesn't have reset method, we'll clear specific keys
    } catch (error) {
      console.error('Cache flush all error:', error);
    }
  }

  /**
   * Get Redis info
   */
  async getInfo(): Promise<string> {
    try {
      return await this.redis.info();
    } catch (error) {
      console.error('Cache info error:', error);
      return '';
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    try {
      await this.redis.quit();
    } catch (error) {
      console.error('Redis close error:', error);
    }
  }

  /**
   * Get keys matching a pattern
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.redis.keys(pattern);
    } catch (error) {
      console.error(`Cache keys error for pattern ${pattern}:`, error);
      return [];
    }
  }

  /**
   * Push to left of list (FIFO queue)
   */
  async lpush(key: string, ...values: string[]): Promise<number> {
    try {
      return await this.redis.lpush(key, ...values);
    } catch (error) {
      console.error(`Cache lpush error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Pop from right of list (FIFO queue)
   */
  async rpop(key: string): Promise<string | null> {
    try {
      return await this.redis.rpop(key);
    } catch (error) {
      console.error(`Cache rpop error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Get length of list
   */
  async llen(key: string): Promise<number> {
    try {
      return await this.redis.llen(key);
    } catch (error) {
      console.error(`Cache llen error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Remove all cache data from both cache manager and Redis
   */
  async removeAllCache(): Promise<{ success: boolean; message: string }> {
    try {
      // Get all keys with the prefix to know what we're clearing
      const allKeys = await this.redis.keys('*');
      const keyCount = allKeys.length;

      // Flush all Redis data
      await this.redis.flushall();

      // Clear cache manager by getting all keys and deleting them
      // Since cache-manager doesn't have a direct way to get all keys,
      // we'll use the Redis keys to clear the cache manager
      const cacheManagerPromises = allKeys.map(async (key) => {
        try {
          // Remove the prefix when clearing from cache manager
          const unprefixedKey = key.replace('confhub:', '');
          await this.cacheManager.del(unprefixedKey);
        } catch (error) {
          // Ignore individual key deletion errors
          console.warn(
            `Warning: Could not delete key ${key} from cache manager:`,
            error,
          );
        }
      });

      await Promise.allSettled(cacheManagerPromises);

      console.log(`Successfully cleared ${keyCount} cache entries`);

      return {
        success: true,
        message: `Successfully removed all cache data. Cleared ${keyCount} entries.`,
      };
    } catch (error) {
      console.error('Error removing all cache:', error);
      return {
        success: false,
        message: `Failed to remove all cache: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Remove cache by namespace/prefix pattern
   */
  async removeCacheByNamespace(
    namespace: string,
  ): Promise<{ success: boolean; message: string; deletedCount: number }> {
    try {
      const pattern = `*${namespace}*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length === 0) {
        return {
          success: true,
          message: `No cache entries found for namespace: ${namespace}`,
          deletedCount: 0,
        };
      }

      // Delete from Redis
      await this.redis.del(...keys);

      // Delete from cache manager
      const cacheManagerPromises = keys.map(async (key) => {
        try {
          const unprefixedKey = key.replace('confhub:', '');
          await this.cacheManager.del(unprefixedKey);
        } catch (error) {
          console.warn(
            `Warning: Could not delete key ${key} from cache manager:`,
            error,
          );
        }
      });

      await Promise.allSettled(cacheManagerPromises);

      console.log(
        `Successfully cleared ${keys.length} cache entries for namespace: ${namespace}`,
      );

      return {
        success: true,
        message: `Successfully removed cache for namespace: ${namespace}`,
        deletedCount: keys.length,
      };
    } catch (error) {
      console.error(`Error removing cache for namespace ${namespace}:`, error);
      return {
        success: false,
        message: `Failed to remove cache for namespace ${namespace}: ${(error as Error).message}`,
        deletedCount: 0,
      };
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalKeys: number;
    memoryUsed: string;
    uptime: string;
    connectedClients: number;
  }> {
    try {
      const info = await this.redis.info();
      const keys = await this.redis.keys('*');

      // Parse Redis info for useful stats
      const lines = info.split('\r\n');
      const stats: Record<string, string> = {};

      lines.forEach((line) => {
        const [key, value] = line.split(':');
        if (key && value) {
          stats[key] = value;
        }
      });

      return {
        totalKeys: keys.length,
        memoryUsed: stats['used_memory_human'] || 'N/A',
        uptime: stats['uptime_in_seconds']
          ? `${Math.floor(Number(stats['uptime_in_seconds']) / 3600)}h ${Math.floor((Number(stats['uptime_in_seconds']) % 3600) / 60)}m`
          : 'N/A',
        connectedClients: parseInt(stats['connected_clients'] || '0') || 0,
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        totalKeys: 0,
        memoryUsed: 'N/A',
        uptime: 'N/A',
        connectedClients: 0,
      };
    }
  }
}
