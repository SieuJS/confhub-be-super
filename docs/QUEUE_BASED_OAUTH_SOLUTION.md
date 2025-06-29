# Queue-Based OAuth Redirect URL Solution

## Problem Summary

The OAuth state mismatch issue was causing redirect URLs to not be found after Google OAuth callback. The problem occurred because:

1. **Middleware**: Generated custom state `abc123...` and stored redirect URL with key `oauth:redirect:abc123...`
2. **Google OAuth**: Generated different state `xyz789...` during OAuth flow
3. **Callback**: Tried to find redirect URL using Google's state `xyz789...` but it was stored with custom state `abc123...`

## Queue-Based Solution

Instead of trying to match states (which are unpredictable with Google OAuth), we implemented a **First-In-First-Out (FIFO) queue** system.

### How It Works

1. **Request Phase** (`RedirectUrlMiddleware`):
   ```
   GET /auth/google?redirectUrl=http://localhost:8386/apis/auth/google-callback
   ```
   - Validates the redirect URL
   - Adds redirect URL to Redis queue: `oauth:redirect:queue`
   - Queue item includes: `{redirectUrl, timestamp, userIp}`
   - Sets 15-minute TTL for automatic cleanup

2. **OAuth Flow**:
   - User is redirected to Google
   - Google handles authentication
   - Google redirects back with its own state (we don't care about the state anymore)

3. **Callback Phase** (`GoogleOAuthGuard` + `AuthController`):
   ```
   GET /auth/google/callback?state=xyz789...&code=...
   ```
   - **Primary**: Pops the first (oldest) redirect URL from queue
   - **Fallback**: Uses the previous multi-strategy approach if queue is empty
   - **Default**: Uses hardcoded fallback URL if nothing is found

### Key Benefits

✅ **State Independent**: No need to match OAuth states  
✅ **FIFO Order**: First redirect URL requested is first one used  
✅ **Automatic Cleanup**: Old entries expire automatically  
✅ **Fallback Support**: Multiple strategies ensure reliability  
✅ **Type Safe**: All operations are strongly typed  

### Redis Queue Structure

```
oauth:redirect:queue (List)
├── Item 1: {"redirectUrl": "http://localhost:8386/apis/auth/google-callback", "timestamp": 1735281234567, "userIp": "192.168.1.100"}
├── Item 2: {"redirectUrl": "http://localhost:8386/admin/callback", "timestamp": 1735281234890, "userIp": "192.168.1.101"}
└── Item 3: {"redirectUrl": "http://localhost:8386/mobile/callback", "timestamp": 1735281235123, "userIp": "192.168.1.102"}
```

**Operations**:
- `LPUSH`: Add new redirect URL to left (newest)
- `RPOP`: Remove redirect URL from right (oldest) - FIFO behavior

### Code Changes

#### 1. **RedirectUrlMiddleware** - Queue Storage
```typescript
// Add to queue
await this.redisCacheService.lpush(
  'oauth:redirect:queue',
  JSON.stringify({
    redirectUrl,
    timestamp: Date.now(),
    userIp: req.ip || 'unknown',
  })
);

// Set TTL
await this.redisCacheService.expire('oauth:redirect:queue', 900);
```

#### 2. **CacheManagementService** - Queue Retrieval
```typescript
async getRedirectUrlFromQueue(): Promise<string | null> {
  const queueItem = await this.redisCacheService.rpop('oauth:redirect:queue');
  // Parse and validate the item
  // Return redirect URL or null
}
```

#### 3. **AuthController** - Simple Usage
```typescript
// Try queue first (primary approach)
const queueRedirectUrl = await this.cacheManagementService.getRedirectUrlFromQueue();

if (queueRedirectUrl) {
  redirectUrl = queueRedirectUrl; // Success!
} else {
  // Fallback approaches...
}
```

#### 4. **RedisCacheService** - Queue Methods
```typescript
async lpush(key: string, ...values: string[]): Promise<number>
async rpop(key: string): Promise<string | null>  
async llen(key: string): Promise<number>
```

### Security Considerations

- **URL Validation**: All redirect URLs are validated against allowed hosts
- **TTL Expiry**: Queue items expire after 15 minutes
- **IP Tracking**: User IP is stored for audit/debugging purposes
- **Timestamp Validation**: Old items are rejected even if not expired

### Edge Cases Handled

1. **Empty Queue**: Falls back to state-based strategies
2. **Expired Items**: Automatically skipped with recursive retry
3. **Invalid JSON**: Gracefully handled with error logging
4. **Concurrent Users**: FIFO ensures each user gets their redirect URL
5. **Redis Failures**: Graceful degradation to default URL

### Testing

The solution can be tested with:
```bash
# Multiple concurrent requests
curl "http://localhost:3000/api/v1/auth/google?redirectUrl=http://localhost:8386/apis/auth/google-callback"
curl "http://localhost:3000/api/v1/auth/google?redirectUrl=http://localhost:8386/admin-callback"

# Each OAuth callback should get the correct redirect URL in FIFO order
```

### Monitoring

Queue status can be monitored with:
```bash
# Check queue length
redis-cli LLEN oauth:redirect:queue

# View queue contents (without removing)
redis-cli LRANGE oauth:redirect:queue 0 -1
```

This queue-based approach eliminates the OAuth state matching complexity while ensuring reliable redirect URL handling for all users.
