# Environment Variables for Redis Caching

Add these environment variables to your `.env` file:

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0

# For production with Redis Cluster
REDIS_CLUSTER_ENABLED=true
REDIS_CLUSTER_NODES=redis-1.example.com:6379,redis-2.example.com:6379,redis-3.example.com:6379

# Cache Configuration
CACHE_TTL_DEFAULT=3600
CACHE_TTL_CONFERENCES=1800
CACHE_TTL_USERS=300
CACHE_TTL_STATIC=7200

# Cache Monitoring
CACHE_METRICS_ENABLED=true
CACHE_DEBUG_ENABLED=false
```

## Docker Compose Configuration

```yaml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    container_name: confhub_redis
    ports:
      - "6379:6379"
    environment:
      - REDIS_PASSWORD=${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    command: redis-server --requirepass ${REDIS_PASSWORD}
    networks:
      - confhub_network

  app:
    build: .
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=${REDIS_PASSWORD}
    depends_on:
      - redis
    networks:
      - confhub_network

volumes:
  redis_data:

networks:
  confhub_network:
    driver: bridge
```

## Production Redis Cluster Setup

For production, consider using Redis Cluster or a managed Redis service like AWS ElastiCache, Google Cloud Memorystore, or Azure Cache for Redis.

### AWS ElastiCache Configuration

```bash
REDIS_HOST=your-cluster.cache.amazonaws.com
REDIS_PORT=6379
REDIS_CLUSTER_ENABLED=true
REDIS_TLS_ENABLED=true
```

### Google Cloud Memorystore

```bash
REDIS_HOST=10.x.x.x
REDIS_PORT=6379
REDIS_AUTH_ENABLED=true
```
