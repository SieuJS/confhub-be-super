import { Module } from '@nestjs/common';
import { ConferenceService } from './services/conference.service';
import { ConferenceController } from './controllers/conference.controller';
import { CommonModule } from '../common';
import { ConferenceDtoToModelPipe } from './pipes/conference-dto-to-model.pipe';
import { SourceRankModule } from '../source-rank/source-rank.module';
import { ConferenceJobModule } from '../conference-job/conference-job.module';
import { ConferenceOrganizationModule } from '../conference-organization';
import { UserModule } from '../user/user.module';
import { ConferenceRankService } from './services/conference-rank.service';

@Module({
  imports : [CommonModule, SourceRankModule, ConferenceJobModule, ConferenceOrganizationModule, UserModule ],
  providers: [ ConferenceService, ConferenceDtoToModelPipe, ConferenceRankService],
  controllers: [ConferenceController],
})
export class ConferencesModule {}
