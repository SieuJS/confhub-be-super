import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { AdminConferenceController } from './controllers/admin-conference.controller';
import { AdminConferenceService } from './services/admin-conference.service';

@Module({
    imports : [CommonModule],
    controllers : [AdminConferenceController],
    providers : [AdminConferenceService],
})
export class AdminConferenceModule {}
