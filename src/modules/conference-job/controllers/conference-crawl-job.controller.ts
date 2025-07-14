import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  HttpException,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConferenceCrawlJobService } from '../services';
import {
  ApiTags,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ConferenceService } from '../../conference/services/conference.service';
import { ConferenceOrganizationSerivce } from '../../conference-organization/services/conference-organization.service';
import { ConferenceCrawlJobInputDTO } from '../models/conference-crawl-job/conference-crawl-job-input.dto';
import { ConferenceCrawlJobDTO } from '../models/conference-crawl-job/conference-crawl-job.dto';
import { AdminConferenceService } from 'src/modules/admin-conference/services/admin-conference.service';
import { NotificationService } from 'src/modules/notify/services/notification.service';
import { EmailService } from 'src/modules/email-verify/services/email.service';
import { FollowConferenceService } from 'src/modules/follow-conference/services/follow-conference.service';
import { Request } from 'express';
import { JWTGuardAdmin, JWTGuardUser } from 'src/modules/auth/guards/jwt.guard';
import { UserService } from 'src/modules/user/services/user.service';

interface RequestWithUser extends Request {
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  };
}

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
    private readonly followService: FollowConferenceService,
    private readonly userService: UserService,
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
  scheduleCronUpdate(
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
    console.log('🎯🎯🎯 CONTROLLER ENTRY: cancel-cron endpoint called');
    console.log('🎯 Controller: cancel-cron endpoint called');

    try {
      // Use the comprehensive stop method instead of just cancelCronUpdate
      console.log(
        '🎯 Controller: About to call stopConferenceCrawlOperations...',
      );
      const result =
        await this.conferenceCrawlJobService.stopConferenceCrawlOperations();

      console.log('🎯 Controller: stop operation completed, result:', result);
      return result;
    } catch (error) {
      console.error('🎯 Controller: Error in cancel-cron:', error);
      throw error;
    }
  }

  @Post('start-cron-immediate')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        batchSize: {
          type: 'number',
          description: 'Number of conferences to update per batch',
        },
        take: {
          type: 'number',
          description: 'Number of conferences to fetch for immediate execution',
        },
      },
    },
  })
  @ApiBearerAuth('access-token')
  @UseGuards(JWTGuardAdmin)
  async startCronImmediate(
    @Body('batchSize') batchSize: number = 10,
    @Body('take') take: number = 10,
    @Req() req: RequestWithUser,
  ) {
    console.log('[Start Cron Immediate] Starting immediate cron job execution');
    console.log(`[Start Cron Immediate] Batch size: ${batchSize}`);

    try {
      // Get all conferences
      console.log('[Start Cron Immediate] Fetching conferences...');
      const conferences =
        await this.conferenceCrawlJobService.getConferenceToCrawl(take);

      const description =
        req.user.role === 'admin'
          ? 'admin'
          : `${req.user.firstName} ${req.user.lastName} (${req.user.email})`;
      console.log(`[Start Cron Immediate] Executing as: ${description}`);

      // Process conferences in batches
      const batches: ConferenceCrawlJobInputDTO[][] = [];
      for (let i = 0; i < conferences.length; i += batchSize) {
        const batch = conferences.slice(i, i + batchSize);
        console.log(
          `[Start Cron Immediate] Processing batch ${i / batchSize + 1} with ${batch.length} conferences`,
        );

        const batchInputs = await Promise.all(
          batch.map(async (conference) => {
            const organization =
              await this.conferenceOrganizationService.getFirstOrganizationsByConferenceId(
                conference.id,
              );
            if (!organization) {
              console.log(
                `[Start Cron Immediate] No organization found for conference: ${conference.title}`,
              );
              return null;
            }
            return {
              conferenceId: conference.id,
              conferenceTitle: conference.title,
              conferenceAcronym: conference.acronym,
              mainLink: organization?.link || '',
              cfpLink: organization?.cfpLink || '',
              impLink: organization?.impLink || '',
              status: 'PENDING',
              progress: 0,
              message: 'Pending',
              description,
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

      console.log(
        `[Start Cron Immediate] Created ${batches.length} valid batches`,
      );

      // Create and execute jobs for each batch
      const results: ConferenceCrawlJobDTO[][] = [];
      for (let i = 0; i < batches.length; i++) {
        console.log(
          `[Start Cron Immediate] Executing batch ${i + 1}/${batches.length}`,
        );
        const batch = batches[i];
        const batchResult =
          await this.conferenceCrawlJobService.createBatchUpdateConferenceCrawlJob(
            batch,
          );
        results.push(batchResult);
        console.log(
          `[Start Cron Immediate] Completed batch ${i + 1}/${batches.length}`,
        );
      }

      console.log('[Start Cron Immediate] All batches processed successfully');

      return {
        success: true,
        message: 'Immediate cron job execution completed',
        totalBatches: batches.length,
        totalConferences: results.flat().length,
        results,
      };
    } catch (error) {
      console.error('[Start Cron Immediate] Error executing cron job:', error);
      throw new HttpException(
        'Failed to execute immediate cron job: ' + (error as Error).message,
        500,
      );
    }
  }

  @Get('cron-status')
  getCronStatus() {
    return this.conferenceCrawlJobService.getCronStatus();
  }

  @Get('start')
  async startCrawl(@Req() req: RequestWithUser) {
    const description =
      req.user.role === 'admin'
        ? 'admin'
        : `${req.user.firstName} ${req.user.lastName} (${req.user.email})`;

    return this.conferenceCrawlJobService.fetchConferenceCrawlData({
      items: [
        {
          Title: 'AAAI Conference on Human Computation and Crowdsourcing',
          Acronym: 'HCOMP',
        },
      ],
      models: {
        determineLinks: 'non-tuned',
        extractInfo: 'non-tuned',
        extractCfp: 'non-tuned',
      },
      description,
    });
  }

  @Post('update/:id')
  @ApiParam({ name: 'id', description: 'Conference ID' })
  @ApiBearerAuth('access-token')
  @UseGuards(JWTGuardUser)
  async updateConference(@Param('id') id: string, @Req() req: RequestWithUser) {
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

    const user = await this.userService.getUserById(req.user.id);
    if (!user) {
      throw new HttpException('User not found', 404);
    }
    console.log(`${user.firstName} ${user.lastName} (${user.email})`);
    const description =
      req.user.role === 'admin'
        ? 'admin'
        : `${user.firstName} ${user.lastName} (${user.email})`;

    const result =
      await this.conferenceCrawlJobService.fetchUpdateConferenceCrawlData({
        items: [
          {
            Title: conference.title,
            Acronym: conference.acronym,
            mainLink: organization.link || '',
            cfpLink: organization.cfpLink || '',
            impLink: organization.impLink || '',
          },
        ],
        models: {
          determineLinks: 'non-tuned',
          extractInfo: 'non-tuned',
          extractCfp: 'non-tuned',
        },
        description,
      });

    const data = result.data.map((item) => ({
      ...item,
      mainLink: organization.link || item.mainLink,
      cfpLink: organization.cfpLink || item.cfpLink,
      impLink: organization.impLink || item.impLink,
    }));
    await this.adminConferenceService.importConferences(data as any);
    try {
      await this.notificationService.sendUpdateConferenceNotification(
        conference.id,
      );
      await this.followService.notifyFollowersAboutConferenceUpdate(
        conference.id,
      );
    } catch (error: unknown) {
      console.error('Error sending update notification:', error);
    }

    return {
      success: true,
      data: result,
    };
  }

  @Post('schedule-update')
  @ApiQuery({ name: 'batchSize', required: false, type: Number })
  async scheduleUpdate(
    @Query('batchSize') batchSize: number = 10,
    @Req() req: RequestWithUser,
  ) {
    // Get all conferences
    const paginatedConferences = await this.conferenceService.getConferences();
    const conferences = paginatedConferences.payload;

    const description =
      req.user.role === 'admin'
        ? 'admin'
        : `${req.user.firstName} ${req.user.lastName} (${req.user.email})`;

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
            description,
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
  @Post('schedule-delayed')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        delaySeconds: {
          type: 'number',
          description: 'Delay in seconds before execution',
          default: 0,
        },
        delayMinutes: {
          type: 'number',
          description: 'Delay in minutes before execution',
          default: 0,
        },
        delayHours: {
          type: 'number',
          description: 'Delay in hours before execution',
          default: 0,
        },
        batchSize: {
          type: 'number',
          description: 'Number of conferences to update per batch',
          default: 10,
        },
        take: {
          type: 'number',
          description: 'Number of conferences to fetch for execution',
          default: 10,
        },
      },
    },
  })
  @ApiBearerAuth('access-token')
  // @UseGuards(JWTGuardAdmin)
  scheduleDelayedCrawl(
    @Body('delaySeconds') delaySeconds: number = 0,
    @Body('delayMinutes') delayMinutes: number = 0,
    @Body('delayHours') delayHours: number = 0,
    @Body('batchSize') batchSize: number = 10,
    @Body('take') take: number = 10,
  ) {
    // Calculate total delay in milliseconds
    const totalDelayMs =
      (delayHours * 3600 + delayMinutes * 60 + delaySeconds) * 1000;

    if (totalDelayMs <= 0) {
      throw new HttpException('Delay must be greater than 0', 400);
    }

    this.conferenceCrawlJobService.scheduleCronUpdate(
      `0 ${new Date(Date.now() + totalDelayMs).getMinutes()} ${new Date(Date.now() + totalDelayMs).getHours()} * * *`,
      batchSize,
      take,
    );
  }

  @Post('force-update-jobs')
  async forceUpdateJobs() {
    console.log('🎯 Controller: force-update-jobs endpoint called');
    const result =
      await this.conferenceCrawlJobService.forceUpdateJobsToCancel();
    console.log('🎯 Controller: force update completed, result:', result);
    return result;
  }

  @Get('detailed-status')
  async getDetailedStatus() {
    console.log('🎯 Controller: detailed-status endpoint called');
    const result = await this.conferenceCrawlJobService.getDetailedJobStatus();
    console.log('🎯 Controller: detailed status retrieved');
    return result;
  }

  @Post('test-stop-operations')
  async testStopOperations() {
    console.log('🎯 Controller: test-stop-operations endpoint called');
    const result = await this.conferenceCrawlJobService.testStopOperations();
    console.log('🎯 Controller: test operations completed, result:', result);
    return result;
  }

  @Post('simple-cancel-test')
  async simpleCancelTest() {
    console.log('🧪🧪🧪 SIMPLE TEST: simple-cancel-test endpoint called');

    try {
      // Just call the basic cancelCronUpdate method to test
      console.log('🧪 Test: About to call basic cancelCronUpdate...');
      const result = await this.conferenceCrawlJobService.cancelCronUpdate();

      console.log('🧪 Test: basic cancel completed, result:', result);
      return {
        testName: 'simple-cancel-test',
        success: true,
        result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('🧪 Test: Error in simple-cancel-test:', error);
      return {
        testName: 'simple-cancel-test',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
