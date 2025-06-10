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
  cancelCronUpdate() {
    return this.conferenceCrawlJobService.cancelCronUpdate();
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
              console.log(`[Start Cron Immediate] No organization found for conference: ${conference.title}`);
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

    const data = result.data;
    await this.adminConferenceService.importConferences(data as any);
    await this.notificationService.sendUpdateConferenceNotification(
      conference.id,
    );

    // Notify followers about the conference update
    try {
      await this.followService.notifyFollowersAboutConferenceUpdate(
        conference.id,
      );
    } catch (error: unknown) {
      console.error('Error notifying followers:', error);
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
}
