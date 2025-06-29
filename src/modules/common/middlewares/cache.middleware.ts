import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisCacheService } from '../services/redis-cache.service';
import * as crypto from 'crypto';

// User interface for type safety
interface AuthenticatedUser {
  id: string;
  email?: string;
  role?: string;
  firstName?: string;
  lastName?: string;
}

// Enhanced Request interface
interface CacheableRequest extends Request {
  user?: AuthenticatedUser;
  cacheKey?: string;
  skipCache?: boolean;
  cacheTTL?: number;
}

// Type for cached response data
type CachedResponse =
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null;

@Injectable()
export class CacheMiddleware implements NestMiddleware {
  constructor(private readonly cacheService: RedisCacheService) {}

  async use(req: CacheableRequest, res: Response, next: NextFunction) {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip if explicitly disabled
    if (req.query.noCache === 'true' || req.skipCache) {
      return next();
    }

    // Generate cache key based on URL, query params, and user context
    const cacheKey = this.generateCacheKey(req);
    req.cacheKey = cacheKey;

    try {
      // Try to get cached response
      const cachedResponse =
        await this.cacheService.get<CachedResponse>(cacheKey);

      if (cachedResponse) {
        // Set cache headers
        res.set({
          'X-Cache': 'HIT',
          'X-Cache-Key': cacheKey,
          'Cache-Control': 'public, max-age=3600',
        });

        // Return cached response
        return res.json(cachedResponse);
      }

      // Store original res.json method
      const originalJson = res.json.bind(res) as (
        body: CachedResponse,
      ) => Response;

      // Override res.json to cache the response
      res.json = (body: CachedResponse): Response => {
        // Don't cache error responses
        if (res.statusCode >= 400) {
          return originalJson(body);
        }

        // Cache the response
        const ttl = req.cacheTTL || this.getTTLForRoute(req.path);
        this.cacheService.set(cacheKey, body, ttl).catch((error: Error) => {
          console.error('Failed to cache response:', error);
        });

        // Set cache headers
        res.set({
          'X-Cache': 'MISS',
          'X-Cache-Key': cacheKey,
          'Cache-Control': `public, max-age=${ttl}`,
        });

        return originalJson(body);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  }

  private generateCacheKey(req: Request): string {
    const url = req.originalUrl || req.url;
    const user = req.user as AuthenticatedUser | undefined;
    const userId = user?.id || 'anonymous';
    const userRole = user?.role || 'guest';

    // Include relevant user context but avoid sensitive data
    const keyData = {
      url,
      method: req.method,
      userId: userId,
      userRole: userRole,
      // Include specific query params that affect response
      filters: this.extractCacheableParams(req.query || {}),
    };

    // Create hash for consistent key generation
    const keyString = JSON.stringify(keyData);
    const hash = crypto.createHash('sha256').update(keyString).digest('hex');

    return `api:${hash}`;
  }

  private extractCacheableParams(
    query: Record<string, unknown>,
  ): Record<string, unknown> {
    // Only include query params that should affect caching
    const cacheableParams = [
      'page',
      'perPage',
      'sortBy',
      'sortOrder',
      'keyword',
      'title',
      'acronym',
      'rank',
      'source',
      'topics',
      'fromDate',
      'toDate',
      'country',
      'continent',
      'mode',
      'researchFields',
      'accessType',
    ];

    const filtered: Record<string, unknown> = {};
    for (const param of cacheableParams) {
      if (query[param] !== undefined) {
        filtered[param] = query[param];
      }
    }

    return filtered;
  }

  private getTTLForRoute(path: string): number {
    // Different TTL for different routes
    const routeTTLMap: Record<string, number> = {
      '/conferences': 1800, // 30 minutes for conference listings
      '/conferences/': 3600, // 1 hour for individual conferences
      '/ranks': 7200, // 2 hours for ranks (rarely change)
      '/sources': 7200, // 2 hours for sources
      '/topics': 3600, // 1 hour for topics
      '/feedbacks': 600, // 10 minutes for feedbacks
      '/users': 300, // 5 minutes for user data
    };

    // Find matching route pattern
    for (const [route, ttl] of Object.entries(routeTTLMap)) {
      if (path.startsWith(route)) {
        return ttl;
      }
    }

    // Default TTL
    return 1800; // 30 minutes
  }
}

/**
 * Type for classes that can be cached
 */
interface CacheableClass {
  cacheService?: RedisCacheService;
  redisCacheService?: RedisCacheService;
  constructor: { name: string };
}

/**
 * Type for async methods that can be cached
 */
type AsyncMethod<T = unknown> = (...args: unknown[]) => Promise<T>;

/**
 * Cache decorator for methods with improved type safety
 */
export function Cacheable(ttl: number = 3600, keyPrefix?: string) {
  return function <T extends CacheableClass>(
    target: T,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value as AsyncMethod;

    descriptor.value = async function (
      this: T,
      ...args: unknown[]
    ): Promise<unknown> {
      const cacheService = this.cacheService || this.redisCacheService;

      if (!cacheService) {
        console.warn(
          'RedisCacheService not found, executing method without cache',
        );
        // Type assertion needed here due to Function.apply limitations
        return originalMethod.apply(this, args) as Promise<unknown>;
      }

      // Generate cache key
      const key = keyPrefix
        ? `${keyPrefix}:${JSON.stringify(args)}`
        : `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;

      const cacheKey = crypto.createHash('sha256').update(key).digest('hex');

      try {
        // Try to get from cache
        const cached = await cacheService.get<unknown>(cacheKey);
        if (cached !== null) {
          return cached;
        }

        // Execute method and cache result
        // Type assertion needed here due to Function.apply limitations
        const result = (await originalMethod.apply(this, args)) as unknown;
        await cacheService.set(cacheKey, result, ttl);

        return result;
      } catch (error) {
        console.error('Cache decorator error:', error);
        // Type assertion needed here due to Function.apply limitations
        return originalMethod.apply(this, args) as Promise<unknown>;
      }
    };
  };
}

/**
 * Cache invalidation decorator with improved type safety
 */
export function InvalidateCache(patterns: string[]) {
  return function <T extends CacheableClass>(
    target: T,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value as AsyncMethod;

    descriptor.value = async function (
      this: T,
      ...args: unknown[]
    ): Promise<unknown> {
      // Type assertion needed here due to Function.apply limitations
      const result = (await originalMethod.apply(this, args)) as unknown;

      const cacheService = this.cacheService || this.redisCacheService;
      if (cacheService) {
        try {
          // Invalidate cache patterns
          for (const pattern of patterns) {
            await cacheService.delByPattern(pattern);
          }
        } catch (error) {
          console.error('Cache invalidation error:', error);
        }
      }

      return result;
    };
  };
}
