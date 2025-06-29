# How to Use the Redis Caching System

## Quick Start

The caching system is now set up and ready to use. Here's how to implement it in your application:

### 1. Using the Cache Middleware

Apply the cache middleware to specific routes or globally:

```typescript
// In your module or main app
import { CacheMiddleware } from './modules/common/middlewares/cache.middleware';

// Apply to specific routes
@Module({
  // ...
})
export class ConferenceModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CacheMiddleware)
      .forRoutes({ path: 'conferences*', method: RequestMethod.GET });
  }
}

// Or apply globally in main.ts
const app = await NestFactory.create(AppModule);
app.use(new CacheMiddleware(app.get(RedisCacheService)));
```

### 2. Using Cache Decorators in Services

```typescript
import { Cacheable, InvalidateCache } from '../common/middlewares/cache.middleware';

@Injectable()
export class ConferenceService {
  constructor(private readonly cacheService: RedisCacheService) {}

  @Cacheable(1800, 'conferences') // Cache for 30 minutes
  async getConferences(filters: any): Promise<ConferencePaginationDTO> {
    // This method's results will be automatically cached
    return await this.fetchConferencesFromDB(filters);
  }

  @InvalidateCache(['conferences:*', 'api:*']) // Invalidate related caches
  async createConference(data: any): Promise<Conference> {
    const result = await this.createConferenceInDB(data);
    // Cache invalidation happens automatically after this method
    return result;
  }
}
```

### 3. Manual Cache Operations

```typescript
@Injectable()
export class ConferenceService {
  constructor(private readonly cacheService: RedisCacheService) {}

  async getPopularConferences(): Promise<Conference[]> {
    const cacheKey = 'popular-conferences';
    
    // Try to get from cache
    const cached = await this.cacheService.get<Conference[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const conferences = await this.fetchPopularConferences();
    
    // Cache for 1 hour
    await this.cacheService.set(cacheKey, conferences, 3600);
    
    return conferences;
  }

  async invalidateConferenceCache(conferenceId?: string): Promise<void> {
    // Invalidate all conference-related caches
    await this.cacheService.delByPattern('conferences:*');
    
    if (conferenceId) {
      await this.cacheService.delByPattern(`conference:${conferenceId}:*`);
    }
  }
}
```

## Configuration

### Environment Variables

Make sure these are set in your `.env` file:

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password # Optional for development
```

### Cache TTL Settings

Different data types should have appropriate TTL values:

```typescript
const CACHE_SETTINGS = {
  CONFERENCES_LIST: 1800,      // 30 minutes
  CONFERENCE_DETAIL: 3600,     // 1 hour  
  USER_DATA: 300,              // 5 minutes
  STATIC_DATA: 7200,           // 2 hours
  SEARCH_RESULTS: 900,         // 15 minutes
};
```

## Best Practices

### 1. Cache Key Naming

Use consistent, hierarchical naming:

```typescript
// Good
'conferences:list:page:1:sort:date'
'conference:detail:123'
'user:profile:456'

// Bad
'conf_list_p1'
'conference123'
'userdata456'
```

### 2. Cache Invalidation Strategy

Implement invalidation at the right granularity:

```typescript
// Invalidate specific data
await this.cacheService.del('conference:detail:123');

// Invalidate related data patterns
await this.cacheService.delByPattern('conferences:list:*');

// Invalidate all conference data
await this.cacheService.delByPattern('conference*');
```

### 3. Error Handling

Always handle cache failures gracefully:

```typescript
async getCachedData<T>(key: string, fallback: () => Promise<T>): Promise<T> {
  try {
    const cached = await this.cacheService.get<T>(key);
    if (cached) return cached;
  } catch (error) {
    console.error('Cache read error:', error);
  }

  // Fallback to original data source
  const data = await fallback();
  
  // Try to cache for future requests
  try {
    await this.cacheService.set(key, data, 3600);
  } catch (error) {
    console.error('Cache write error:', error);
  }
  
  return data;
}
```

### 4. Cache Monitoring

Check cache performance regularly:

```typescript
// Add to a service
async getCacheStats(): Promise<any> {
  const info = await this.cacheService.getInfo();
  return {
    memory_usage: info.match(/used_memory_human:(.*)/)?.[1],
    keyspace_hits: info.match(/keyspace_hits:(.*)/)?.[1],
    keyspace_misses: info.match(/keyspace_misses:(.*)/)?.[1],
  };
}
```

## Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   - Check if Redis is running: `redis-cli ping`
   - Verify connection settings in `.env`

2. **Cache Not Working**
   - Check if middleware is properly registered
   - Verify route patterns match your API endpoints

3. **Memory Issues**
   - Monitor Redis memory usage
   - Implement cache eviction policies
   - Use appropriate TTL values

### Debug Mode

Enable cache debugging by setting environment variable:

```bash
CACHE_DEBUG=true
```

This will log all cache operations for troubleshooting.

## Performance Tips

1. **Use Connection Pooling** - Redis supports connection pooling for better performance
2. **Batch Operations** - Use `mget` and `mset` for multiple keys
3. **Compression** - Consider compressing large cached objects
4. **Monitor TTL** - Set appropriate TTL to balance freshness and performance
5. **Use Sets** - For related data, use Redis sets for efficient operations

## Production Considerations

1. **Redis Cluster** - Use Redis Cluster for high availability
2. **Backup Strategy** - Implement Redis backup for persistence
3. **Monitoring** - Use Redis monitoring tools (Redis Insight, etc.)
4. **Security** - Enable Redis AUTH and use TLS in production
5. **Memory Management** - Set max memory limits and eviction policies

The caching system is now fully functional and will automatically improve your application's performance by reducing database load and speeding up response times.
