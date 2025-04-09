import { Module } from '@nestjs/common';
import { AdminService } from './services/admin.service';
import { CommonModule } from '../common';
import { AdminController } from './controllers/admin.controller';
import { UserService } from './services/user.service';
import { UserController } from './controllers/user.controller';
import { EmailVerifyModule } from '../email-verify/email-verify.module';

@Module({
    imports: [CommonModule, UserModule , EmailVerifyModule],
    controllers : [AdminController, UserController],
    providers: [AdminService, UserService],
    exports: [AdminService, UserService]
})
export class UserModule {}
