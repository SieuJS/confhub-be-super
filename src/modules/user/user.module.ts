import { Module } from '@nestjs/common';
import { AdminService } from './services/admin.service';
import { CommonModule } from '../common';
import { AdminController } from './controllers/admin.controller';
import { UserService } from './services/user.service';
import { UserController } from './controllers/user.controller';
import { NotifyModule } from '../notify/notify.module';

@Module({
    imports: [CommonModule, NotifyModule],
    controllers : [AdminController, UserController],
    providers: [AdminService, UserService],
    exports: [AdminService, UserService ]
})
export class UserModule {}
