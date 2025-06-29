import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisCacheService } from '../../common/services/redis-cache.service';
import * as crypto from 'crypto';

@Injectable()
export class RedirectUrlMiddleware implements NestMiddleware {
  constructor(private readonly redisCacheService: RedisCacheService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      // Get the redirectUrl from query parameters
      const redirectUrl = req.query.redirectUrl as string;
      console.log('Input redirectUrl:', redirectUrl);

      // If redirectUrl exists, store it in Redis with a unique state key
      if (redirectUrl) {
        // Generate a unique state parameter for this OAuth flow
        const oauthState = crypto.randomBytes(32).toString('hex');
        
        // Store the redirect URL in Redis with the state as key
        // TTL of 10 minutes (600 seconds) for OAuth flow
        await this.redisCacheService.set(
          `oauth:redirect:${oauthState}`,
          redirectUrl,
          600, // 10 minutes TTL
        );

        // Store the state in the request for use in OAuth flow
        req.oauthState = oauthState;
        
        // Also add state to query params for Google OAuth
        req.query.state = oauthState;
        
        console.log('Stored redirect URL in Redis with state:', oauthState);
      }

      next();
    } catch (error) {
      console.error('RedirectUrlMiddleware error:', error);
      // Continue without caching if Redis fails
      next();
    }
  }
}
