import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisCacheService } from '../../common/services/redis-cache.service';
import * as crypto from 'crypto';

// Extend Request interface to include oauthState and oauthSessionKey
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      oauthState?: string;
      oauthSessionKey?: string;
    }
  }
}

@Injectable()
export class RedirectUrlMiddleware implements NestMiddleware {
  constructor(private readonly redisCacheService: RedisCacheService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Get the redirectUrl from query parameters
      const redirectUrl = req.query.redirectUrl as string;
      console.log('RedirectUrlMiddleware - Input redirectUrl:', redirectUrl);
      console.log('RedirectUrlMiddleware - Full query:', req.query);
      console.log('RedirectUrlMiddleware - Request path:', req.path);

      // If redirectUrl exists, add it to the queue
      if (redirectUrl) {
        // Validate the redirect URL to prevent open redirect attacks
        if (!this.isValidRedirectUrl(redirectUrl)) {
          console.warn('Invalid redirect URL provided:', redirectUrl);
          return next();
        }

        // Add redirect URL to queue with timestamp for ordering
        const queueItem = {
          redirectUrl,
          timestamp: Date.now(),
          userIp: req.ip || 'unknown',
        };

        // Store in Redis queue - use list for FIFO behavior
        await this.redisCacheService.lpush(
          'oauth:redirect:queue',
          JSON.stringify(queueItem),
        );

        // Set TTL for the entire queue (cleanup old entries)
        await this.redisCacheService.expire('oauth:redirect:queue', 900); // 15 minutes

        console.log(
          'RedirectUrlMiddleware - Added redirect URL to queue:',
          redirectUrl,
        );
        console.log('RedirectUrlMiddleware - Queue item:', queueItem);

        // Also keep the old state-based approach as backup
        const oauthState = crypto.randomBytes(32).toString('hex');
        await this.redisCacheService.set(
          `oauth:redirect:${oauthState}`,
          redirectUrl,
          900, // 15 minutes TTL
        );
        req.oauthState = oauthState;
      } else {
        console.log('RedirectUrlMiddleware - No redirectUrl provided');
      }

      next();
    } catch (error) {
      console.error('RedirectUrlMiddleware error:', error);
      // Continue without caching if Redis fails
      next();
    }
  }

  /**
   * Validate redirect URL to prevent open redirect attacks
   */
  private isValidRedirectUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);

      // Allow localhost for development
      const allowedHosts = [
        'confhub.ddns.net',
        'localhost',
        '127.0.0.1',
        'confhub.com', // Add your production domain
      ];

      // Check if the host is in the allowed list or is a subdomain of allowed hosts
      const isAllowed = allowedHosts.some(
        (allowedHost) =>
          parsedUrl.hostname === allowedHost ||
          parsedUrl.hostname.endsWith(`.${allowedHost}`),
      );

      console.log('RedirectUrlMiddleware - URL validation:', {
        url,
        hostname: parsedUrl.hostname,
        isAllowed,
      });

      return isAllowed;
    } catch (error) {
      console.error('RedirectUrlMiddleware - URL validation error:', error);
      return false;
    }
  }
}
