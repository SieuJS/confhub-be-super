import { Module } from '@nestjs/common';
import { EmailService } from './services/email.service';
import { CommonModule } from '../common';
import { UserVerifyService } from './services/user-verify.service';

@Module({
  imports: [CommonModule],
  providers: [EmailService, UserVerifyService],
  exports: [EmailService, UserVerifyService],
})
export class EmailVerifyModule {}
