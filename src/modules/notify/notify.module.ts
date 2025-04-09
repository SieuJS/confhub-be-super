import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { NotificationController } from './controllers/notification.controller';
import { NotificationService } from './services/notification.service';

@Module({
    imports : [
        CommonModule
    ],
    controllers : [NotificationController],
    providers : [NotificationService],
})
export class NotifyModule {}
