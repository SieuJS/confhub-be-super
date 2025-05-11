import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { NotificationController } from './controllers/notification.controller';
import { NotificationService } from './services/notification.service';
import { SocketGatewayModule } from '../socket-gateway/socket-gateway.module';
import { ScheduleModule } from '@nestjs/schedule';
import { EmailVerifyModule } from '../email-verify/email-verify.module';

@Module({
  imports: [
    CommonModule,
    SocketGatewayModule,
    ScheduleModule,
    EmailVerifyModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotifyModule {}
