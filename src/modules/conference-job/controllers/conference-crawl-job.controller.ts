import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  HttpException,
} from '@nestjs/common';
import { ConferenceCrawlJobService } from '../services';
import { ApiTags, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import { ConferenceService } from '../../conference/services/conference.service';
import { ConferenceOrganizationSerivce } from '../../conference-organization/services/conference-organization.service';
import { ConferenceCrawlJobInputDTO } from '../models/conference-crawl-job/conference-crawl-job-input.dto';
import { ConferenceCrawlJobDTO } from '../models/conference-crawl-job/conference-crawl-job.dto';
import { ConferenceAttribute } from '../../../constants/conference-attribute';
import { AdminConferenceService } from 'src/modules/admin-conference/services/admin-conference.service';
import { NotificationService } from 'src/modules/notify/services/notification.service';
import { EmailService } from 'src/modules/email-verify/services/email.service';
import { FollowConferenceService } from 'src/modules/follow-conference/services/follow-conference.service';

@ApiTags('conference-crawl-job')
@Controller('conference-crawl-job')
export class ConferenceCrawlJobController {
  constructor(
    private readonly conferenceCrawlJobService: ConferenceCrawlJobService,
    private readonly conferenceService: ConferenceService,
    private readonly conferenceOrganizationService: ConferenceOrganizationSerivce,
    private readonly adminConferenceService: AdminConferenceService,
    private readonly notificationService: NotificationService,
    private readonly emailService: EmailService,
    private readonly followService :  FollowConferenceService
  ) {}

  @Get()
  async findAll() {
    return this.conferenceCrawlJobService.getListConferenceCrawlJob();
  }

  @Get('status')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  async getUpdateStatus(
    @Query('page') page: number = 1,
    @Query('perPage') perPage: number = 10,
    @Query('status') status?: string,
  ) {
    return this.conferenceCrawlJobService.getUpdateStatus(
      page,
      perPage,
      status,
    );
  }

  @Get('stats')
  async getUpdateStats() {
    return this.conferenceCrawlJobService.getUpdateStats();
  }

  @Post('schedule-cron')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        schedule: { type: 'string', description: 'Cron schedule expression' },
        batchSize: {
          type: 'number',
          description: 'Number of conferences to update per batch',
        },
      },
    },
  })
  async scheduleCronUpdate(
    @Body('schedule') schedule: string,
    @Body('batchSize') batchSize: number = 10,
  ) {
    return this.conferenceCrawlJobService.scheduleCronUpdate(
      schedule,
      batchSize,
    );
  }

  @Post('cancel-cron')
  async cancelCronUpdate() {
    return this.conferenceCrawlJobService.cancelCronUpdate();
  }

  @Get('cron-status')
  async getCronStatus() {
    return this.conferenceCrawlJobService.getCronStatus();
  }

  @Get('start')
  async startCrawl() {
    return this.conferenceCrawlJobService.fetchConferenceCrawlData({
      Title: 'AAAI Conference on Human Computation and Crowdsourcing',
      Acronym: 'HCOMP',
    });
  }

  @Post('update/:id')
  @ApiParam({ name: 'id', description: 'Conference ID' })
  async updateConference(@Param('id') id: string) {
    // Get conference details
    const conference = await this.conferenceService.getConferenceById(id);
    if (!conference) {
      throw new HttpException('Conference not found!', 404);
    }

    // Get organization details
    const organization =
      await this.conferenceOrganizationService.getFirstOrganizationsByConferenceId(
        conference.id,
      );
    if (!organization) {
      throw new HttpException('Organization not found', 404);
    }
    // Wait for job completion
    const result =
      await this.conferenceCrawlJobService.fetchUpdateConferenceCrawlData({
        Title: conference.title,
        Acronym: conference.acronym,
        mainLink: organization.link || '',
        cfpLink: organization.cfpLink || '',
        impLink: organization.impLink || '',
      });
    const data = result.data;
    await this.adminConferenceService.importConferences(data as any);
    await this.notificationService.sendUpdateConferenceNotification(conference.id);
    
    // Notify followers about the conference update
    await this.followService.notifyFollowersAboutConferenceUpdate(conference.id);
    
    return {
      success: true,
      data: result,
    };
  }

  @Post('schedule-update')
  @ApiQuery({ name: 'batchSize', required: false, type: Number })
  async scheduleUpdate(@Query('batchSize') batchSize: number = 10) {
    // Get all conferences
    const paginatedConferences = await this.conferenceService.getConferences();
    const conferences = paginatedConferences.payload;

    // Process conferences in batches
    const batches: ConferenceCrawlJobInputDTO[][] = [];
    for (let i = 0; i < conferences.length; i += batchSize) {
      const batch = conferences.slice(i, i + batchSize);
      const batchInputs = await Promise.all(
        batch.map(async (conference) => {
          const organization =
            await this.conferenceOrganizationService.getFirstOrganizationsByConferenceId(
              conference.id,
            );
          if (!organization) {
            return null;
          }
          return {
            conferenceId: conference.id,
            conferenceTitle: conference.title,
            conferenceAcronym: conference.acronym,
            mainLink: organization.link || '',
            cfpLink: organization.cfpLink || '',
            impLink: organization.impLink || '',
            status: 'PENDING',
            progress: 0,
            message: 'Pending',
          } as ConferenceCrawlJobInputDTO;
        }),
      );

      // Filter out null values (conferences without organizations)
      const validBatchInputs = batchInputs.filter(
        (input): input is ConferenceCrawlJobInputDTO => input !== null,
      );
      if (validBatchInputs.length > 0) {
        batches.push(validBatchInputs);
      }
    }

    // Create jobs for each batch
    const results: ConferenceCrawlJobDTO[][] = [];
    for (const batch of batches) {
      const batchResult =
        await this.conferenceCrawlJobService.createBatchUpdateConferenceCrawlJob(
          batch,
        );
      results.push(batchResult);
    }

    return {
      message: 'Batch update jobs scheduled successfully',
      totalBatches: batches.length,
      totalConferences: results.flat().length,
      results,
    };
  }

}
