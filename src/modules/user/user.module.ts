import { Module } from '@nestjs/common';
import { AdminService } from './services/admin.service';
import { CommonModule } from '../common';
import { AdminController } from './controllers/admin.controller';
import { UserService } from './services/user.service';
import { UserController } from './controllers/user.controller';
import { EmailVerifyModule } from '../email-verify/email-verify.module';
import { JwtModule } from '@nestjs/jwt';
import { NotifyModule } from '../notify/notify.module';

@Module({
    imports: [NotifyModule,CommonModule, EmailVerifyModule ,     
        JwtModule.register({
            secret: process.env.JWT_SECRET,
            signOptions: {
                expiresIn: '3600s',
            },
        })
    ],
    controllers : [AdminController, UserController],
    providers: [AdminService, UserService],
    exports: [AdminService, UserService]
})
export class UserModule {}
