import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { UserModule } from '../user/user.module';
import { ConferencesModule } from '../conference/conference.module';
import { FollowConferenceController } from './controllers/follow-conference.controller';
import { FollowConferenceService } from './services/follow-conference.service';
import { NotifyModule } from '../notify/notify.module';

@Module({
    imports : [CommonModule, UserModule, ConferencesModule, NotifyModule],
    controllers : [FollowConferenceController],
    providers: [FollowConferenceService],
})
export class FollowConferenceModule {}
