import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { HealthController } from './controller';
import { LogInterceptor } from './flow';
import { configProvider, LoggerService, PrismaService } from './provider';
import { PaginationService } from './services/pagination.service';

@Module({
    imports: [
        TerminusModule
    ],
    providers: [
        configProvider,
        LoggerService,
        LogInterceptor,
        PrismaService,
        PaginationService
    ],
    exports: [
        configProvider,
        LoggerService,
        LogInterceptor,
        PrismaService,
        PaginationService
    ],
    controllers: [
        HealthController
    ],
})
export class CommonModule {}
