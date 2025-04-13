import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { CalendarController } from './controllers/calendar.controller';
import { CalendarService } from './services/calendar.service';
import { NotifyModule } from '../notify/notify.module';
import { ConferenceOrganizationModule } from '../conference-organization';
import { ConferencesModule } from '../conference/conference.module';

@Module({
    imports : [CommonModule, NotifyModule, ConferenceOrganizationModule, ConferencesModule],
    controllers : [CalendarController],
    providers : [CalendarService]
})
export class CalendarModule {}
