import { Module } from '@nestjs/common';
import { ConferenceRequestController } from './controllers/conference-request.controller';
import { ConferenceRequestService } from './services/conference-request.service';
import { CommonModule } from '../common';

@Module({
    imports: [CommonModule],
    controllers: [ConferenceRequestController],
    providers: [ConferenceRequestService],
    exports: [],
})
export class ConferenceRequestModule {}
