import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AdminConferenceController } from './controllers/admin-conference.controller';
import { AdminConferenceService } from './services/admin-conference.service';
import { NativeConferenceService } from './services/native-conference.service';
import { AdminSourceService } from './services/admin-source.service';
import { ConferenceOrganizationModule } from '../conference-organization';
import { SourceRankModule } from '../source-rank';
import { ConferencesModule } from '../conference/conference.module';

@Module({
  imports: [
    CommonModule,
    ConferenceOrganizationModule,
    SourceRankModule,
    ConferencesModule,
  ],
  controllers: [AdminConferenceController],
  providers: [
    AdminConferenceService,
    NativeConferenceService,
    AdminSourceService,
  ],
  exports: [AdminConferenceService],
})
export class AdminConferenceModule {}
