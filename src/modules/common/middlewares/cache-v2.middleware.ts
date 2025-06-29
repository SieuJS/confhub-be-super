import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisCacheService } from '../services/redis-cache.service';
import * as crypto from 'crypto';

// Define interfaces for better typing
interface CacheableRequest extends Request {
  cacheKey?: string;
  skipCache?: boolean;
  cacheTTL?: number;
  user?: {
    id: string;
    email?: string;
    role?: string;
    firstName?: string;
    lastName?: string;
  };
}

interface CachedResponse {
  data: unknown;
  timestamp: number;
  ttl: number;
}

// Type for JSON response function
type JsonResponseFunction = (body: unknown) => Response;

// Interface for services that have cache functionality
interface CacheableService {
  cacheService?: RedisCacheService;
  redisCacheService?: RedisCacheService;
}

@Injectable()
export class CacheMiddleware implements NestMiddleware {
  constructor(private readonly cacheService: RedisCacheService) {}

  async use(
    req: CacheableRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
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
          'X-Cache-Timestamp': cachedResponse.timestamp.toString(),
        });

        // Return cached response
        res.json(cachedResponse.data);
        return;
      }

      // Store original res.json method
      const originalJson = res.json.bind(res) as JsonResponseFunction;

      // Override res.json to cache the response
      res.json = (body: unknown): Response => {
        // Don't cache error responses
        if (res.statusCode >= 400) {
          return originalJson(body);
        }

        // Cache the response
        const ttl = req.cacheTTL || this.getTTLForRoute(req.path);
        const cacheData: CachedResponse = {
          data: body,
          timestamp: Date.now(),
          ttl,
        };

        this.cacheService
          .set(cacheKey, cacheData, ttl)
          .catch((error: Error) => {
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

  private generateCacheKey(req: CacheableRequest): string {
    const url = req.originalUrl || req.url;
    const userId = req.user?.id || 'anonymous';
    const userRole = req.user?.role || 'guest';

    // Include relevant user context but avoid sensitive data
    const keyData = {
      url,
      method: req.method,
      userId,
      userRole,
      // Include specific query params that affect response
      filters: this.extractCacheableParams(req.query),
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
      '/api/conferences': 1800, // 30 minutes for conference listings
      '/api/conferences/': 3600, // 1 hour for individual conferences
      '/api/ranks': 7200, // 2 hours for ranks (rarely change)
      '/api/sources': 7200, // 2 hours for sources
      '/api/topics': 3600, // 1 hour for topics
      '/api/feedbacks': 600, // 10 minutes for feedbacks
      '/api/users': 300, // 5 minutes for user data
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
 * Cache decorator for methods with better typing
 */
export function Cacheable(ttl: number = 3600, keyPrefix?: string) {
  return function <T extends CacheableService>(
    target: T,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value as (
      ...args: unknown[]
    ) => Promise<unknown>;

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
        const result = (await originalMethod.apply(
          this,
          args,
        )) as Promise<unknown>;
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
 * Cache invalidation decorator with stronger typing
 */
export function InvalidateCache(patterns: string[]) {
  return function <T extends CacheableService>(
    target: T,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value as (
      ...args: unknown[]
    ) => Promise<unknown>;

    descriptor.value = async function (
      this: T,
      ...args: unknown[]
    ): Promise<unknown> {
      // Type assertion needed here due to Function.apply limitations
      const result = (await originalMethod.apply(
        this,
        args,
      )) as Promise<unknown>;

      const cacheService = this.cacheService || this.redisCacheService;
      if (cacheService) {
        // Invalidate cache patterns
        try {
          await Promise.all(
            patterns.map((pattern) => cacheService.delByPattern(pattern)),
          );
        } catch (error) {
          console.error('Cache invalidation error:', error);
        }
      }

      return result;
    };
  };
}
