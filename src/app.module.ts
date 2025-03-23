import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './modules/common';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { SourceRankModule } from './modules/source-rank';

@Module({
  imports: [CommonModule, UserModule, AuthModule, SourceRankModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
