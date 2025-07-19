import { Module } from '@nestjs/common';
import { ConferenceBlacklistService } from './services/conference-blacklist.service';
import { ConferenceBlacklistController } from './controller/conference-blacklist.controller';
import { CommonModule } from '../common';
import { UserModule } from '../user/user.module';
import { ConferencesModule } from '../conference/conference.module';
import { NotifyModule } from '../notify/notify.module';

@Module({
  imports: [CommonModule, UserModule, ConferencesModule, NotifyModule],
  controllers: [ConferenceBlacklistController],
  providers: [ConferenceBlacklistService],
})
export class ConferenceBlacklistModule {}
