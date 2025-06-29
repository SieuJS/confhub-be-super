# Redis Caching Implementation Guide

This document provides best practices for implementing Redis caching with Keyv setup for middleware in a NestJS application that can be accessed across all servers in the network.

## Architecture Overview

The caching system consists of:
1. **RedisCacheService** - Core caching service with Redis operations
2. **CacheInterceptor** - Global interceptor for automatic response caching
3. **Cache Decorators** - Method-level caching decorators
4. **Cache Middleware** - Request-level caching middleware (alternative approach)

## Setup

### 1. Dependencies

```bash
npm install @nestjs/cache-manager cache-manager ioredis
npm install --save-dev @types/cache-manager
```

### 2. Configuration

In `app.module.ts`:

```typescript
CacheModule.registerAsync({
  imports: [CommonModule],
  inject: [Service.CONFIG],
  useFactory: (config: Config) => {
    return {
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      ttl: 3600, // 1 hour default TTL
      max: 1000, // Maximum number of items in cache
    };
  },
})
```

### 3. Service Integration

The `RedisCacheService` provides:
- Basic cache operations (get, set, del)
- Pattern-based deletion for cache invalidation
- Multi-key operations (mget, mset)
- Set operations for related data
- TTL management

## Usage Patterns

### 1. Service-Level Caching

```typescript
@Injectable()
export class ConferenceService {
  constructor(
    private readonly cacheService: RedisCacheService,
    // ... other dependencies
  ) {}

  async getConferences(filters: any): Promise<ConferencePaginationDTO> {
    // Generate cache key
    const cacheKey = this.generateCacheKey('conferences', filters);
    
    // Try cache first
    const cached = await this.cacheService.get<ConferencePaginationDTO>(cacheKey);
    if (cached) {
      return cached;
    }

    // Execute query and cache result
    const result = await this.getConferencesFromDB(filters);
    await this.cacheService.set(cacheKey, result, 1800); // 30 min TTL
    
    return result;
  }

  // Cache invalidation on updates
  async updateConference(id: string, data: any) {
    const result = await this.updateConferenceInDB(id, data);
    
    // Invalidate related caches
    await this.cacheService.delByPattern('conferences:*');
    await this.cacheService.delByPattern(`conference:detail:${id}*`);
    
    return result;
  }
}
```

### 2. Global Response Caching

Use the `CacheInterceptor` for automatic response caching:

```typescript
@Controller('conferences')
@UseInterceptors(CacheInterceptor)
export class ConferencesController {
  // All GET endpoints will be automatically cached
}
```

### 3. Method-Level Caching with Decorators

```typescript
class SomeService {
  @Cacheable(3600, 'expensive-operation') // 1 hour cache
  async expensiveOperation(param: string): Promise<any> {
    // This method's results will be cached
    return await this.performExpensiveOperation(param);
  }

  @InvalidateCache(['expensive-operation:*', 'related-data:*'])
  async updateData(data: any): Promise<any> {
    // This method will invalidate specified cache patterns
    return await this.updateDataInDB(data);
  }
}
```

## Best Practices

### 1. Cache Key Strategy

```typescript
private generateCacheKey(operation: string, params: any): string {
  // Include relevant parameters only
  const relevantParams = {
    page: params.page,
    filters: params.filters,
    userId: params.userId, // Include user context if needed
  };
  
  const keyData = JSON.stringify(relevantParams);
  const hash = crypto.createHash('sha256').update(keyData).digest('hex');
  return `${operation}:${hash}`;
}
```

### 2. TTL Strategy

Different data types should have different TTL values:

```typescript
const TTL_CONFIG = {
  USER_SESSION: 1800,      // 30 minutes
  API_RESPONSES: 900,      // 15 minutes
  STATIC_DATA: 7200,       // 2 hours
  SEARCH_RESULTS: 600,     // 10 minutes
  REAL_TIME_DATA: 60,      // 1 minute
};
```

### 3. Cache Invalidation Strategy

Implement hierarchical cache invalidation:

```typescript
async invalidateConferenceCache(conferenceId?: string): Promise<void> {
  const patterns = [
    'conferences:list:*',           // All conference lists
    'conferences:search:*',         // All search results
    'conferences:upcoming:*',       // Upcoming conferences
  ];

  if (conferenceId) {
    patterns.push(`conferences:detail:${conferenceId}*`);
  }

  // Invalidate all patterns
  await Promise.all(
    patterns.map(pattern => this.cacheService.delByPattern(pattern))
  );
}
```

### 4. Cache Warming

Pre-populate cache with frequently accessed data:

```typescript
@Injectable()
export class CacheWarmupService {
  constructor(
    private readonly cacheService: RedisCacheService,
    private readonly conferenceService: ConferenceService,
  ) {}

  @Cron('0 */6 * * *') // Every 6 hours
  async warmupCache(): Promise<void> {
    try {
      // Warm up popular conference listings
      const popularFilters = [
        { rank: 'A*', page: 1 },
        { topics: ['AI', 'ML'], page: 1 },
        { country: 'USA', page: 1 },
      ];

      await Promise.all(
        popularFilters.map(filter => 
          this.conferenceService.getConferences(filter)
        )
      );

      console.log('Cache warmup completed');
    } catch (error) {
      console.error('Cache warmup failed:', error);
    }
  }
}
```

### 5. Cache Monitoring

Implement cache hit/miss monitoring:

```typescript
@Injectable()
export class CacheMetricsService {
  private hits = 0;
  private misses = 0;

  recordHit(): void {
    this.hits++;
  }

  recordMiss(): void {
    this.misses++;
  }

  getHitRatio(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }

  @Cron('0 * * * *') // Every hour
  logMetrics(): void {
    console.log(`Cache Hit Ratio: ${(this.getHitRatio() * 100).toFixed(2)}%`);
    console.log(`Hits: ${this.hits}, Misses: ${this.misses}`);
  }
}
```

### 6. Error Handling

Always handle cache errors gracefully:

```typescript
async getCachedData<T>(key: string, fallback: () => Promise<T>): Promise<T> {
  try {
    const cached = await this.cacheService.get<T>(key);
    if (cached !== null) {
      return cached;
    }
  } catch (error) {
    console.error('Cache read error:', error);
    // Continue to fallback
  }

  try {
    const data = await fallback();
    
    // Try to cache the result
    try {
      await this.cacheService.set(key, data, 3600);
    } catch (error) {
      console.error('Cache write error:', error);
      // Don't fail the request because of cache write errors
    }
    
    return data;
  } catch (error) {
    console.error('Fallback error:', error);
    throw error;
  }
}
```

## Network Distribution

For multi-server deployment:

### 1. Redis Cluster Configuration

```typescript
// For Redis Cluster
const redis = new Redis.Cluster([
  { host: 'redis-1.example.com', port: 6379 },
  { host: 'redis-2.example.com', port: 6379 },
  { host: 'redis-3.example.com', port: 6379 },
], {
  enableReadyCheck: false,
  redisOptions: {
    password: process.env.REDIS_PASSWORD,
  },
});
```

### 2. Cache Synchronization

Implement cache invalidation across all servers:

```typescript
@Injectable()
export class CacheSyncService {
  constructor(private readonly cacheService: RedisCacheService) {}

  async broadcastInvalidation(pattern: string): Promise<void> {
    // Use Redis pub/sub for cache invalidation across servers
    await this.cacheService.redis.publish('cache:invalidate', pattern);
  }

  @OnModuleInit()
  async subscribeToInvalidations(): Promise<void> {
    this.cacheService.redis.subscribe('cache:invalidate');
    
    this.cacheService.redis.on('message', async (channel, pattern) => {
      if (channel === 'cache:invalidate') {
        await this.cacheService.delByPattern(pattern);
      }
    });
  }
}
```

## Performance Considerations

1. **Serialization**: Use efficient serialization for complex objects
2. **Memory Management**: Monitor Redis memory usage and implement eviction policies
3. **Network Latency**: Consider Redis connection pooling and keep-alive settings
4. **Cache Size**: Implement cache size limits and LRU eviction
5. **Monitoring**: Set up Redis monitoring and alerting

## Security

1. **Authentication**: Use Redis AUTH for production
2. **Encryption**: Enable TLS for Redis connections
3. **Network Security**: Use VPC/private networks for Redis instances
4. **Access Control**: Implement role-based access to Redis instances

This caching implementation provides a robust, scalable solution for distributed caching across multiple servers while maintaining data consistency and performance.
