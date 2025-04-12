import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { CalendarController } from './controllers/calendar.controller';
import { CalendarService } from './services/calendar.service';

@Module({
    imports : [CommonModule],
    controllers : [CalendarController],
    providers : [CalendarService]
})
export class CalendarModule {}
