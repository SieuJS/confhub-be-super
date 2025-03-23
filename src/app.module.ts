import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule, Config } from './modules/common';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { SourceRankModule } from './modules/source-rank';
import { BullModule } from '@nestjs/bullmq';
import { Service } from './modules/tokens';
import { FeedbacksModule } from './modules/feedbacks/feedbacks.module';

@Module({
  imports: [CommonModule, UserModule, AuthModule, SourceRankModule,
    BullModule.forRootAsync( {
      imports : [CommonModule],
      inject: [Service.CONFIG],
      useFactory : async (config : Config) => ({
          connection : {
              host : config.REDIS_HOST,
              port : config.REDIS_PORT
          }
      })
  }),
  FeedbacksModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
