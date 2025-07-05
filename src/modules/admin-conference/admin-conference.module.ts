import { Module } from '@nestjs/common';
import { AdminConferenceController } from './controllers/admin-conference.controller';
import { AdminConferenceService } from './services/admin-conference.service';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common';
import { NativeConferenceService } from './services/native-conference.service';
import { SourceRankModule } from '../source-rank';
import { ConferencesModule } from '../conference/conference.module';
import { ConferenceOrganizationModule } from '../conference-organization';
import { EmailVerifyModule } from '../email-verify/email-verify.module';
import { NotifyModule } from '../notify/notify.module';
import { FollowConferenceModule } from '../follow-conference/follow-conference.module';

@Module({
  imports: [
    CommonModule,
    AuthModule,
    SourceRankModule,
    ConferencesModule,
    ConferenceOrganizationModule,
    EmailVerifyModule,
    NotifyModule,
    FollowConferenceModule,
  ],
  controllers: [AdminConferenceController],
  providers: [AdminConferenceService, NativeConferenceService],
  exports: [AdminConferenceService],
})
export class AdminConferenceModule {}
