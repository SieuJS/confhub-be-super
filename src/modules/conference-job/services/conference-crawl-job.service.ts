import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common';
import {
  ConferenceAttribute,
  ConferenceMessageJob,
} from '../../../constants/conference-attribute';
import { ConferenceCrawlJobInputDTO } from '../models/conference-crawl-job/conference-crawl-job-input.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { CONFERENCE_QUEUE_NAME } from '../../../constants/queue-name';
import { Queue } from 'bullmq';
import { CONFERENCE_CRAWL_JOB_NAME } from '../../../constants/job-name';
import { ConferenceCrawlJobDTO } from '../models/conference-crawl-job/conference-crawl-job.dto';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom } from 'rxjs';
import { ConferenceCrawlNewRequestDto } from '../models/crawl-request/conference-crawl-new-request.dto';
import { ConferenceCrawlNewResponseDto } from '../models/crawl-response/conference-crawl-new-reponse.dto';
import { ConferenceCrawlUpdateRequestDto } from '../models/crawl-request/conference-crawl-update-request.dto';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

@Injectable()
export class ConferenceCrawlJobService {
  private cronJob: CronJob | null = null;

  constructor(
    private prismaService: PrismaService,
    @InjectQueue(CONFERENCE_QUEUE_NAME.CRAWL)
    private conferenceCrawlQueue: Queue,
    private httpService: HttpService,
    private schedulerRegistry: SchedulerRegistry
  ) {}

  async getListConferenceCrawlJob() {
    return this.prismaService.conferenceCrawlJobs.findMany();
  }

  async getUpdateStatus(page: number = 1, perPage: number = 10, status?: string) {
    const where = status ? { status } : {};
    const skip = (page - 1) * perPage;

    const [jobs, total] = await Promise.all([
      this.prismaService.conferenceCrawlJobs.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' }
      }),
      this.prismaService.conferenceCrawlJobs.count({ where })
    ]);

    return {
      jobs,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage)
      }
    };
  }

  async getUpdateStats() {
    const [total, completed, failed, pending, running] = await Promise.all([
      this.prismaService.conferenceCrawlJobs.count(),
      this.prismaService.conferenceCrawlJobs.count({
        where: { status: ConferenceAttribute.JOB_STATUS_COMPLETED }
      }),
      this.prismaService.conferenceCrawlJobs.count({
        where: { status: ConferenceAttribute.JOB_STATUS_FAILED }
      }),
      this.prismaService.conferenceCrawlJobs.count({
        where: { status: ConferenceAttribute.JOB_STATUS_PENDING }
      }),
      this.prismaService.conferenceCrawlJobs.count({
        where: { status: ConferenceAttribute.JOB_STATUS_RUNNING }
      })
    ]);

    return {
      total,
      completed,
      failed,
      pending,
      running,
      successRate: total > 0 ? (completed / total) * 100 : 0
    };
  }

  async scheduleCronUpdate(schedule: string, batchSize: number = 10) {
    // Cancel existing cron job if any
    await this.cancelCronUpdate();

    // Create new cron job
    const job = new CronJob(schedule, async () => {
      try {
        await this.scheduleUpdate(batchSize);
      } catch (error) {
        console.error('Error in cron update:', error);
      }
    });

    // Add job to scheduler registry
    this.schedulerRegistry.addCronJob('conference-update', job);
    this.cronJob = job;

    // Start the job
    job.start();

    return {
      message: 'Cron update scheduled successfully',
      schedule,
      batchSize
    };
  }

  async cancelCronUpdate() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.schedulerRegistry.deleteCronJob('conference-update');
      this.cronJob = null;
    }

    return {
      message: 'Cron update cancelled successfully'
    };
  }

  async getCronStatus() {
    return {
      isActive: !!this.cronJob,
      schedule: this.cronJob?.cronTime.source || null,
      lastRun: this.cronJob?.lastDate() || null,
      nextRun: this.cronJob?.nextDate() || null
    };
  }

  async scheduleUpdate(batchSize: number = 10) {
    // Get all conferences
    const conferences = await this.prismaService.conferences.findMany({
      include: {
        organizations: {
          take: 1,
          orderBy: { updatedAt: 'desc' }
        }
      }
    });

    // Process conferences in batches
    const batches: ConferenceCrawlJobInputDTO[][] = [];
    for (let i = 0; i < conferences.length; i += batchSize) {
      const batch = conferences.slice(i, i + batchSize);
      const batchInputs = batch
        .filter(conference => conference.organizations.length > 0)
        .map(conference => ({
          conferenceId: conference.id,
          conferenceTitle: conference.title,
          conferenceAcronym: conference.acronym,
          mainLink: conference.organizations[0].link || "",
          cfpLink: conference.organizations[0].cfpLink || "",
          impLink: conference.organizations[0].impLink || "",
          status: ConferenceAttribute.JOB_STATUS_PENDING,
          progress: 0,
          message: ConferenceMessageJob.PENDING
        }));

      if (batchInputs.length > 0) {
        batches.push(batchInputs);
      }
    }

    // Create jobs for each batch
    const results: ConferenceCrawlJobDTO[][] = [];
    for (const batch of batches) {
      const batchResult = await this.createBatchUpdateConferenceCrawlJob(batch);
      results.push(batchResult);
    }

    return {
      message: "Batch update jobs scheduled successfully",
      totalBatches: batches.length,
      totalConferences: results.flat().length,
      results
    };
  }

  async createConferenceCrawlJob(
    input: ConferenceCrawlJobInputDTO,
  ): Promise<ConferenceCrawlJobDTO> {
    const jobInstance = await this.prismaService.conferenceCrawlJobs.create({
      data: {
        conferenceId: input.conferenceId,
        status: ConferenceAttribute.JOB_STATUS_PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        progress: 0,
        message: ConferenceMessageJob.PENDING,
      },
    });

    // Determine job type based on input
    const jobType = input.mainLink || input.cfpLink || input.impLink 
        ? CONFERENCE_CRAWL_JOB_NAME.UPDATE 
        : CONFERENCE_CRAWL_JOB_NAME.CRAWL;

    await this.conferenceCrawlQueue.add(jobType, {
        id: jobInstance.id,
        conferenceId: jobInstance.conferenceId,
        conferenceAcronym: input.conferenceAcronym,
        conferenceTitle: input.conferenceTitle,
        mainLink: input.mainLink,
        cfpLink: input.cfpLink,
        impLink: input.impLink,
        progress: 0,
        status: ConferenceAttribute.JOB_STATUS_PENDING,
    });

    return {
        id: jobInstance.id,
        conferenceId: jobInstance.conferenceId,
        conferenceTitle: input.conferenceTitle,
        conferenceAcronym: input.conferenceAcronym,
        mainLink: input.mainLink,
        cfpLink: input.cfpLink,
        impLink: input.impLink,
        status: jobInstance.status as ConferenceAttribute,
        createdAt: jobInstance.createdAt,
        updatedAt: jobInstance.updatedAt,
        progress: jobInstance.progress,
        message: jobInstance.message as ConferenceMessageJob,
    };
  }

  async fetchConferenceCrawlData(
    input: ConferenceCrawlNewRequestDto,
  ): Promise<ConferenceCrawlNewResponseDto> {
    const CRAWL_URL = process.env.CRAWLER_URL;
    const { data }: { data: ConferenceCrawlNewResponseDto } =
      await firstValueFrom(
        this.httpService
          .post(
            CRAWL_URL + '/crawl-conferences',
            [
              {
                ...input,
              },
            ],
            {
              params: { dataSource: 'client' },
              headers: {
                'Content-Type': 'application/json',
              },
            },
          )
          .pipe(
            catchError((error) => {
              throw error;
            }),
          ),
      );
    return data;
  }

  async fetchUpdateConferenceCrawlData(
    input: ConferenceCrawlUpdateRequestDto,
  ): Promise<ConferenceCrawlNewResponseDto> {
    const CRAWL_URL = process.env.CRAWLER_URL;
    const { data }: { data: ConferenceCrawlNewResponseDto } =
      await firstValueFrom(
        this.httpService
          .post(
            CRAWL_URL + '/crawl-conferences',
            [
              {
                ...input,
              },
            ],
            {
              params: {
                dataSource: 'client',
                models: {
                  determineLinks: 'non-tuned',
                  extractInfo: 'non-tuned',
                  extractCfp: 'non-tuned',
                },
              headers: {
                'Content-Type': 'application/json',
              },
            },
          },
          )
          .pipe(
            catchError((error) => {
              throw error;
            }),
          ),
      );
    console.log('data', data);
    return data;
  }

  async fetchBatchUpdateConferenceCrawlData(
    inputs: ConferenceCrawlUpdateRequestDto[],
  ): Promise<ConferenceCrawlNewResponseDto> {
    const CRAWL_URL = process.env.CRAWLER_URL;
    const { data }: { data: ConferenceCrawlNewResponseDto } =
      await firstValueFrom(
        this.httpService
          .post(
            CRAWL_URL + '/crawl-conferences',
            inputs,
            {
              params: {
                dataSource: 'client',
                models: {
                  determineLinks: 'non-tuned',
                  extractInfo: 'non-tuned',
                  extractCfp: 'non-tuned',
                },
              headers: {
                'Content-Type': 'application/json',
              },
            },
          }
          )
          .pipe(
            catchError((error) => {
              throw error;
            }),
          ),
      );
    console.log('batch data', data);
    return data;
  }

  async createBatchUpdateConferenceCrawlJob(
    inputs: ConferenceCrawlJobInputDTO[],
  ): Promise<ConferenceCrawlJobDTO[]> {
    const jobInstances = await Promise.all(
      inputs.map(async (input) => {
        return this.prismaService.conferenceCrawlJobs.create({
          data: {
            conferenceId: input.conferenceId,
            status: ConferenceAttribute.JOB_STATUS_PENDING,
            createdAt: new Date(),
            updatedAt: new Date(),
            progress: 0,
            message: ConferenceMessageJob.PENDING,
          },
        });
      })
    );

    await this.conferenceCrawlQueue.add(CONFERENCE_CRAWL_JOB_NAME.UPDATE, {
      jobs: jobInstances.map((instance, index) => ({
        id: instance.id,
        conferenceId: instance.conferenceId,
        conferenceAcronym: inputs[index].conferenceAcronym,
        conferenceTitle: inputs[index].conferenceTitle,
        mainLink: inputs[index].mainLink,
        cfpLink: inputs[index].cfpLink,
        impLink: inputs[index].impLink,
        progress: 0,
        status: ConferenceAttribute.JOB_STATUS_PENDING,
      })),
    });

    return jobInstances.map((instance, index) => ({
      id: instance.id,
      conferenceId: instance.conferenceId,
      conferenceTitle: inputs[index].conferenceTitle,
      conferenceAcronym: inputs[index].conferenceAcronym,
      mainLink: inputs[index].mainLink,
      cfpLink: inputs[index].cfpLink,
      impLink: inputs[index].impLink,
      status: instance.status as ConferenceAttribute,
      createdAt: instance.createdAt,
      updatedAt: instance.updatedAt,
      progress: instance.progress,
      message: instance.message as ConferenceMessageJob,
    }));
  }

  async updateConferenceCrawlJob(
    jobId: string,
    data: Partial<ConferenceCrawlJobInputDTO>,
  ) {
    return this.prismaService.conferenceCrawlJobs.update({
      where: {
        id: jobId,
      },
      data,
    });
  }
}
