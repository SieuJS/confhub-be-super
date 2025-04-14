import { Inject, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule, Config, PrismaService } from './modules/common';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { SourceRankModule } from './modules/source-rank';
import { BullModule } from '@nestjs/bullmq';
import { Service } from './modules/tokens';
import { FeedbacksModule } from './modules/feedbacks/feedbacks.module';
import { ConferenceOrganizationModule } from './modules/conference-organization';
import { ConferenceJobModule } from './modules/conference-job';
import { ConferencesModule } from './modules/conference/conference.module';
import { AdminConferenceModule } from './modules/admin-conference/admin-conference.module';
import { ClsModule } from 'nestjs-cls';
import { ClsPluginTransactional  } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { NotifyModule } from './modules/notify/notify.module';
import { EmailVerifyModule } from './modules/email-verify/email-verify.module';
import { JwtModule } from '@nestjs/jwt';
import { CalendarModule } from './modules/calendar/calendar.module';
import { FollowConferenceModule } from './modules/follow-conference/follow-conference.module';
import { BlacklistConferenceModule } from './modules/blacklist-conference/blacklist-conference.module';
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
  ClsModule.forRoot({
    plugins: [
        new ClsPluginTransactional({
            imports: [
              // module in which the PrismaClient is provided
              CommonModule
            ],
            adapter: new TransactionalAdapterPrisma({
                // the injection token of the PrismaClient
                prismaInjectionToken: PrismaService,
            }),
        }),
    ],
    global: true,
    middleware: { mount: true },
}),
  JwtModule.registerAsync({
    imports: [CommonModule],
    inject: [Service.CONFIG],
    useFactory: (config: Config) => {
      console.log('JWT_SECRET', config.JWT_SECRET);
      return ({
      global: true,
      secret: "Must change",
      signOptions: { expiresIn: '3600s' },
    })},
    global: true,
  
  }),
  FeedbacksModule,
  ConferenceOrganizationModule,
  ConferenceJobModule,
  ConferencesModule,
  AdminConferenceModule,
  NotifyModule,
  EmailVerifyModule,
  CalendarModule,
  FollowConferenceModule,
  BlacklistConferenceModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
