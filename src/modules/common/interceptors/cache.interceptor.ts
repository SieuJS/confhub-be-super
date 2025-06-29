import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { RedisCacheService } from '../services/redis-cache.service';
import * as crypto from 'crypto';

interface CacheKeyData {
  url: string;
  method: string;
  userId: string;
  query: Record<string, unknown>;
}

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
}

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(private readonly cacheService: RedisCacheService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();

    // Skip caching for non-GET requests
    if (request.method !== 'GET') {
      return next.handle();
    }

    // Generate cache key
    const cacheKey = this.generateCacheKey(request);

    try {
      // Try to get cached response
      const cachedResponse = await this.cacheService.get<unknown>(cacheKey);

      if (cachedResponse) {
        // Set cache headers
        response.set({
          'X-Cache': 'HIT',
          'X-Cache-Key': cacheKey,
          'Cache-Control': 'public, max-age=3600',
        });

        return of(cachedResponse);
      }

      // If not cached, execute the handler and cache the result
      return next.handle().pipe(
        tap((data: unknown) => {
          // Cache the response
          const ttl = this.getTTLForRoute(request.path);
          this.cacheService.set(cacheKey, data, ttl).catch((error: Error) => {
            console.error('Failed to cache response:', error);
          });

          // Set cache headers
          response.set({
            'X-Cache': 'MISS',
            'X-Cache-Key': cacheKey,
            'Cache-Control': `public, max-age=${ttl}`,
          });
        }),
      );
    } catch (error) {
      console.error('Cache interceptor error:', error);
      return next.handle();
    }
  }

  private generateCacheKey(request: AuthenticatedRequest): string {
    const url = request.originalUrl || request.url;
    const userId = request.user?.id || 'anonymous';

    const keyData: CacheKeyData = {
      url: url || '',
      method: request.method,
      userId,
      query: this.sanitizeQuery(request.query),
    };

    const keyString = JSON.stringify(keyData);
    return crypto.createHash('sha256').update(keyString).digest('hex');
  }

  private sanitizeQuery(
    query: Record<string, unknown>,
  ): Record<string, unknown> {
    // Remove sensitive parameters
    const sensitiveParams = ['password', 'token', 'secret'];
    const sanitized = { ...query };

    for (const param of sensitiveParams) {
      delete sanitized[param];
    }

    return sanitized;
  }

  private getTTLForRoute(path: string): number {
    const routeTTLMap: Record<string, number> = {
      '/conferences': 1800, // 30 minutes
      '/ranks': 7200, // 2 hours
      '/sources': 7200, // 2 hours
      '/topics': 3600, // 1 hour
      '/users': 300, // 5 minutes
    };

    for (const [route, ttl] of Object.entries(routeTTLMap)) {
      if (path.startsWith(route)) {
        return ttl;
      }
    }

    return 1800; // Default 30 minutes
  }
}
