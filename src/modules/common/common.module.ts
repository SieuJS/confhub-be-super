import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { CacheModule } from '@nestjs/cache-manager';

import { HealthController } from './controller';
import { LogInterceptor } from './flow';
import { configProvider, LoggerService, PrismaService } from './provider';
import { PaginationService } from './services/pagination.service';
import { RedisCacheService } from './services/redis-cache.service';
import { CacheInterceptor } from './interceptors/cache.interceptor';

@Module({
  imports: [
    TerminusModule,
    CacheModule.register({
      ttl: 3600, // 1 hour default TTL
      max: 1000, // Maximum number of items in cache
    }),
  ],
  providers: [
    configProvider,
    LoggerService,
    LogInterceptor,
    PrismaService,
    PaginationService,
    RedisCacheService,
    CacheInterceptor,
  ],
  exports: [
    configProvider,
    LoggerService,
    LogInterceptor,
    PrismaService,
    PaginationService,
    RedisCacheService,
    CacheInterceptor,
  ],
  controllers: [HealthController],
})
export class CommonModule {}
