import { Module } from '@nestjs/common';
import { AdminUserController } from './controllers/admin-user.controller';
import { AdminUserService } from './services/admin-user.service';
import { PrismaService } from 'src/modules/common';

@Module({
  controllers: [AdminUserController],
  providers: [AdminUserService, PrismaService],
  exports: [AdminUserService],
})
export class AdminUserModule {}
