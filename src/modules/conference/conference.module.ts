import { Module } from '@nestjs/common';
import { ConferenceService } from './services/conference.service';
import { ConferenceController } from './controllers/conference.controller';
import { CommonModule } from '../common';
import { ConferenceDtoToModelPipe } from './pipes/conference-dto-to-model.pipe';
import { SourceRankModule } from '../source-rank/source-rank.module';
import { ConferenceOrganizationModule } from '../conference-organization';
import { UserModule } from '../user/user.module';
import { ConferenceRankService } from './services/conference-rank.service';
import { NotifyModule } from '../notify/notify.module';
import { SocketGatewayModule } from '../socket-gateway/socket-gateway.module';

import { GeminiModule } from '../gemini/gemini.module';

@Module({
  imports: [
    SocketGatewayModule,
    CommonModule,
    SourceRankModule,
    NotifyModule,
    ConferenceOrganizationModule,
    UserModule,
    GeminiModule,
  ],
  providers: [
    ConferenceService,
    ConferenceDtoToModelPipe,
    ConferenceRankService,
  ],
  controllers: [ConferenceController],
  exports: [ConferenceService],
})
export class ConferencesModule {}
