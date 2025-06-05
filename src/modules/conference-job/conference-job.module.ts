import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { BullModule } from '@nestjs/bullmq';
import { CONFERENCE_QUEUE_NAME } from '../../constants/queue-name';
import { ConferenceCrawlJobService } from './services/conference-crawl-job.service';
import { ConferenceCrawlJobController } from './controllers/conference-crawl-job.controller';
import { ConferenceImportProcessor } from './queues/conference-import.processor';
import { HttpModule } from '@nestjs/axios';
import { ConferenceOrganizationModule } from '../conference-organization';
import { SocketGatewayModule } from '../socket-gateway/socket-gateway.module';
import { ConferencesModule } from '../conference/conference.module';
import { NotifyModule } from '../notify/notify.module';
import { SourceRankModule } from '../source-rank';
import { AdminConferenceModule } from '../admin-conference/admin-conference.module';
import { EmailVerifyModule } from '../email-verify/email-verify.module';
import { FollowConferenceModule } from '../follow-conference/follow-conference.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    CommonModule,
    BullModule.registerQueue({
      name: CONFERENCE_QUEUE_NAME.CRAWL,
    }),
    ConferencesModule,
    NotifyModule,
    ConferenceOrganizationModule,
    SourceRankModule,
    HttpModule,
    SocketGatewayModule,
    AdminConferenceModule,
    EmailVerifyModule,
    FollowConferenceModule,
    UserModule,
  ],
  providers: [ConferenceCrawlJobService, ConferenceImportProcessor],
  controllers: [ConferenceCrawlJobController],
  exports: [ConferenceCrawlJobService],
})
export class ConferenceJobModule {}
