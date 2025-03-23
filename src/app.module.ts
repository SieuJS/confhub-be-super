import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './modules/common';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [CommonModule, UserModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
