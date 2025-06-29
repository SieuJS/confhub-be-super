import { Injectable } from '@nestjs/common';
import { RedisCacheService } from 'src/modules/common/services/redis-cache.service';

@Injectable()
export class CacheManagementService {
  constructor(private readonly redisCacheService: RedisCacheService) {}

  /**
   * Invalidate cache entries related to a specific user with targeted approach
   * This is more efficient and precise than clearing all cache
   */
  async invalidateUserCache(userId: string): Promise<void> {
    try {
      console.log(`Starting cache invalidation for user: ${userId}`);
      
      // Generate hash-based cache keys that match our cache middleware
      const userSpecificPatterns = [
        // Hash-based patterns that include user ID
        `api:*${userId}*`, // Any cache key containing user ID in the hash
        `*userId=${userId}*`, // Query param based cache keys
        `*"userId":"${userId}"*`, // JSON stringified user ID in cache key
      ];

      // Route-specific patterns that might contain user data
      const routePatterns = [
        'api:conferences:*', // Conference listings (user might have personalized data)
        'api:feedbacks:*', // User feedback cache
        'api:users:*', // User profile cache
        'api:notifications:*', // User notifications
      ];

      // Clear user session and direct user cache
      const directCacheKeys = [
        `user:${userId}`,
        `user:${userId}:*`,
        `session:${userId}`,
        `profile:${userId}`,
      ];

      // Execute invalidation in batches to avoid overwhelming Redis
      const batchSize = 5;
      const allPatterns = [...userSpecificPatterns, ...routePatterns];
      
      for (let i = 0; i < allPatterns.length; i += batchSize) {
        const batch = allPatterns.slice(i, i + batchSize);
        const batchPromises = batch.map(async (pattern) => {
          try {
            const deletedCount =
              await this.redisCacheService.delByPattern(pattern);
            if (deletedCount > 0) {
              console.log(
                `Deleted ${deletedCount} cache entries for pattern: ${pattern}`,
              );
            }
            return deletedCount;
          } catch (err) {
            console.warn(`Failed to delete cache pattern ${pattern}:`, err);
            return 0;
          }
        });
        
        await Promise.all(batchPromises);
      }

      // Clear direct cache keys
      const directKeyPromises = directCacheKeys.map(async (key) => {
        try {
          await this.redisCacheService.del(key);
        } catch (err) {
          console.warn(`Failed to delete cache key ${key}:`, err);
        }
      });
      
      await Promise.all(directKeyPromises);

      console.log(`Cache invalidation completed for user: ${userId}`);
    } catch (error) {
      console.error('Error invalidating user cache:', error);
      throw error;
    }
  }

  /**
   * Invalidate OAuth state cache (for cleanup)
   */
  async invalidateOAuthState(state: string): Promise<void> {
    try {
      const cacheKey = `oauth:redirect:${state}`;
      await this.redisCacheService.del(cacheKey);
      console.log(`OAuth state cache cleared for: ${state}`);
    } catch (error) {
      console.warn(`Failed to clear OAuth state cache for ${state}:`, error);
    }
  }

  /**
   * Get OAuth redirect URL and clean up cache entry
   */
  async getAndClearOAuthRedirectUrl(state: string): Promise<string | null> {
    try {
      const cacheKey = `oauth:redirect:${state}`;
      console.log(`Retrieving OAuth redirect URL for state: ${state}`);
      
      const cachedRedirectUrl =
        await this.redisCacheService.get<string>(cacheKey);
      
      if (cachedRedirectUrl) {
        console.log('Retrieved redirect URL from Redis:', cachedRedirectUrl);
        
        // Clean up the cache entry immediately after retrieval
        await this.redisCacheService.del(cacheKey);
        console.log('Cleaned up OAuth cache entry for state:', state);
        
        return cachedRedirectUrl;
      } else {
        console.log('No cached redirect URL found for state:', state);
        return null;
      }
    } catch (error) {
      console.error('Error retrieving OAuth redirect URL from Redis:', error);
      return null;
    }
  }

  /**
   * Clear all API cache - use only in development or emergency situations
   */
  async clearAllApiCache(): Promise<void> {
    try {
      console.log('Clearing all API cache...');
      const deletedCount = await this.redisCacheService.delByPattern('api:*');
      console.log(`All API cache cleared, deleted ${deletedCount} entries`);
    } catch (error) {
      console.error('Error clearing all API cache:', error);
    }
  }

  /**
   * Clear conference-specific cache (useful when conference data is updated)
   */
  async clearConferenceCache(): Promise<void> {
    try {
      console.log('Clearing conference cache...');
      const patterns = ['api:conferences:*', '*conferences*'];

      for (const pattern of patterns) {
        const deletedCount = await this.redisCacheService.delByPattern(pattern);
        if (deletedCount > 0) {
          console.log(
            `Deleted ${deletedCount} conference cache entries for pattern: ${pattern}`,
          );
        }
      }
    } catch (error) {
      console.error('Error clearing conference cache:', error);
    }
  }

  /**
   * Get OAuth redirect URL with fallback mechanisms for state mismatch
   * This handles cases where Google's state differs from our custom state
   */
  async getOAuthRedirectUrlWithFallback(
    googleState: string,
    customState?: string,
    userIp?: string,
  ): Promise<string | null> {
    try {
      console.log(
        'CacheManagementService - Finding redirect URL with states:',
        { googleState, customState, userIp },
      );

      // Strategy 1: Try with Google's state (direct match)
      let redirectUrl = await this.redisCacheService.get<string>(
        `oauth:redirect:${googleState}`,
      );
      if (redirectUrl && typeof redirectUrl === 'string') {
        console.log('Found redirect URL with Google state:', redirectUrl);
        // Clean up the entry
        await this.redisCacheService.del(`oauth:redirect:${googleState}`);
        return redirectUrl;
      }

      // Strategy 2: Try with custom state (our original approach)
      if (customState) {
        redirectUrl = await this.redisCacheService.get<string>(
          `oauth:redirect:${customState}`,
        );
        if (redirectUrl && typeof redirectUrl === 'string') {
          console.log('Found redirect URL with custom state:', redirectUrl);
          // Clean up the entry
          await this.redisCacheService.del(`oauth:redirect:${customState}`);
          return redirectUrl;
        }
      }

      // Strategy 3: Search session-based keys (fallback for state mismatch)
      if (userIp) {
        const sessionPattern = `oauth:session:${userIp}:*`;
        const sessionKeys = await this.redisCacheService.keys(sessionPattern);
        
        for (const sessionKey of sessionKeys) {
          const sessionData =
            await this.redisCacheService.get<string>(sessionKey);
          if (sessionData && typeof sessionData === 'string') {
            try {
              const data = JSON.parse(sessionData) as {
                redirectUrl: string;
                customState: string;
                timestamp: number;
              };
              // Check if session is recent (within 15 minutes)
              const isRecent = Date.now() - data.timestamp < 15 * 60 * 1000;
              if (isRecent && data.redirectUrl) {
                console.log(
                  'Found redirect URL from session backup:',
                  data.redirectUrl,
                );
                // Clean up the session
                await this.redisCacheService.del(sessionKey);
                return data.redirectUrl;
              }
            } catch (error) {
              console.error('Error parsing session data:', error);
              // Clean up invalid session data
              await this.redisCacheService.del(sessionKey);
            }
          }
        }
      }

      // Strategy 4: Search all oauth:redirect:* keys for recent entries
      const allOAuthKeys =
        await this.redisCacheService.keys('oauth:redirect:*');
      console.log('Searching all OAuth keys:', allOAuthKeys.length);
      
      for (const key of allOAuthKeys) {
        const value = await this.redisCacheService.get<string>(key);
        if (value && typeof value === 'string') {
          // Return the most recent redirect URL as fallback
          console.log('Using fallback redirect URL:', value);
          // Clean up the entry
          await this.redisCacheService.del(key);
          return value;
        }
      }

      console.log('No redirect URL found with any strategy');
      return null;
    } catch (error) {
      console.error('Error in getOAuthRedirectUrlWithFallback:', error);
      return null;
    }
  }

  /**
   * Get redirect URL from queue (FIFO approach)
   * This method pops the first available redirect URL from the queue
   */
  async getRedirectUrlFromQueue(): Promise<string | null> {
    try {
      console.log('CacheManagementService - Getting redirect URL from queue');
      
      // Get queue length first
      const queueLength = await this.redisCacheService.llen(
        'oauth:redirect:queue',
      );
      console.log('Queue length:', queueLength);
      
      if (queueLength === 0) {
        console.log('No redirect URLs in queue');
        return null;
      }
      
      // Pop the oldest item from queue (FIFO)
      const queueItem = await this.redisCacheService.rpop(
        'oauth:redirect:queue',
      );
      
      if (!queueItem) {
        console.log('No item retrieved from queue');
        return null;
      }
      
      try {
        const data = JSON.parse(queueItem) as {
          redirectUrl: string;
          timestamp: number;
          userIp: string;
        };
        
        // Check if the redirect URL is not too old (within 15 minutes)
        const isRecent = Date.now() - data.timestamp < 15 * 60 * 1000;
        
        if (isRecent && data.redirectUrl) {
          console.log('Retrieved redirect URL from queue:', data.redirectUrl);
          console.log('Queue item data:', data);
          return data.redirectUrl;
        } else {
          console.log('Queue item is too old or invalid:', data);
          // If this item is too old, try the next one
          return await this.getRedirectUrlFromQueue();
        }
      } catch (parseError) {
        console.error('Error parsing queue item:', parseError);
        // If parsing fails, try the next item
        return await this.getRedirectUrlFromQueue();
      }
    } catch (error) {
      console.error('Error in getRedirectUrlFromQueue:', error);
      return null;
    }
  }
}
