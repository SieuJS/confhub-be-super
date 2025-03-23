import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { BullModule } from '@nestjs/bullmq';
import { CONFERENCE_QUEUE_NAME } from '../../constants/queue-name';
import { ConferenceCrawlJobService } from './services/conference-crawl-job.service';
import { ConferenceCrawlJobController } from './controllers/conference-crawl-job.controller';
import { ConferenceImportProcessor } from './queues/conference-import.processor';
import { HttpModule } from '@nestjs/axios';
import { ConferenceOrganizationModule } from '../conference-organization';
import { ConferenceImportListener } from './queues/conference-import.listener';
import { SocketGatewayModule } from '../socket-gateway/socket-gateway.module';

@Module({
    imports: [CommonModule, 
        BullModule.registerQueue({
            name : CONFERENCE_QUEUE_NAME.CRAWL
        }),
        HttpModule, ConferenceOrganizationModule, SocketGatewayModule
    ],
    providers: [
        ConferenceCrawlJobService , ConferenceImportProcessor
    ],
    controllers: [
        ConferenceCrawlJobController
    ],
    exports: [ConferenceCrawlJobService]
})
export class ConferenceJobModule {
}
