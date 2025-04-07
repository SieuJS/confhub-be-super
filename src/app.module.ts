import { Module } from '@nestjs/common';
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
  FeedbacksModule,
  ConferenceOrganizationModule,
  ConferenceJobModule,
  ConferencesModule,
  AdminConferenceModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
