import { Module } from '@nestjs/common';
import { ConferenceOrganizationSerivce } from './services';
import { MainSubmissionDateInitializerService } from './services/main-submission-date-initializer.service';
import { CommonModule } from '../common';
import { ConferenceOrganizationController } from './controllers/conference-organization.controller';
import { GeminiModule } from '../gemini/gemini.module';

@Module({
  imports: [CommonModule, GeminiModule],
  providers: [
    ConferenceOrganizationSerivce,
    MainSubmissionDateInitializerService,
  ],
  controllers: [ConferenceOrganizationController],
  exports: [
    ConferenceOrganizationSerivce,
    MainSubmissionDateInitializerService,
  ],
})
export class ConferenceOrganizationModule {}
