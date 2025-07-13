/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { AdminConferenceService } from 'src/modules/admin-conference/services/admin-conference.service';
import { ConferenceSaveDto } from 'src/modules/admin-conference/models/conference-save.dto';
import {
  ConferenceType,
  Continent,
} from 'src/modules/admin-conference/models/conference-save.dto';

@Injectable()
export class ConferenceCrawlJobService {
  private cronJob: CronJob | null = null;

  constructor(
    protected prismaService: PrismaService,
    @InjectQueue(CONFERENCE_QUEUE_NAME.CRAWL)
    private conferenceCrawlQueue: Queue,
    private httpService: HttpService,
    private schedulerRegistry: SchedulerRegistry,
    private adminConferenceService: AdminConferenceService,
  ) {}

  async getListConferenceCrawlJob() {
    return this.prismaService.conferenceCrawlJobs.findMany();
  }

  async getUpdateStatus(
    page: number = 1,
    perPage: number = 10,
    status?: string,
  ) {
    const where = status ? { status } : {};
    const skip = (page - 1) * perPage;

    const [jobs, total] = await Promise.all([
      this.prismaService.conferenceCrawlJobs.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
      }),
      this.prismaService.conferenceCrawlJobs.count({ where }),
    ]);

    return {
      jobs,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async getUpdateStats() {
    const [total, completed, failed, pending, running] = await Promise.all([
      this.prismaService.conferenceCrawlJobs.count(),
      this.prismaService.conferenceCrawlJobs.count({
        where: { status: ConferenceAttribute.JOB_STATUS_COMPLETED },
      }),
      this.prismaService.conferenceCrawlJobs.count({
        where: { status: ConferenceAttribute.JOB_STATUS_FAILED },
      }),
      this.prismaService.conferenceCrawlJobs.count({
        where: { status: ConferenceAttribute.JOB_STATUS_PENDING },
      }),
      this.prismaService.conferenceCrawlJobs.count({
        where: { status: ConferenceAttribute.JOB_STATUS_RUNNING },
      }),
    ]);

    return {
      total,
      completed,
      failed,
      pending,
      running,
      successRate: total > 0 ? (completed / total) * 100 : 0,
    };
  }

  async scheduleCronUpdate(
    schedule: string,
    batchSize: number = 10,
    take?: number,
  ) {
    // Cancel existing cron job if any
    const cancelResult = await this.cancelCronUpdate();
    console.log('Cancel result:', cancelResult);

    try {
      // Create new cron job
      const job = new CronJob(schedule, async () => {
        try {
          console.log('Executing scheduled conference update...');
          await this.scheduleUpdate(batchSize, take);
        } catch (error) {
          console.error('Error in cron update:', error);
        }
      });

      // Add job to scheduler registry with error handling
      try {
        this.schedulerRegistry.addCronJob('conference-update', job);
      } catch (registryError) {
        console.warn(
          'Warning: Could not add job to scheduler registry:',
          registryError,
        );
        // Continue anyway, we can still use the job directly
      }

      this.cronJob = job;

      // Start the job
      job.start();
      console.log('Cron job started successfully');

      return {
        message: 'Cron update scheduled successfully',
        schedule,
        batchSize,
        previousJobCancelled: cancelResult.cancelled,
      };
    } catch (error) {
      console.error('Error creating cron job:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to schedule cron update: ${errorMessage}`);
    }
  }

  async cancelCronUpdate() {
    console.log('🔧 Starting cancelCronUpdate process...');
    let cancelled = false;

    try {
      if (this.cronJob) {
        console.log('🛑 Stopping existing cron job...');
        // Stop the cron job first
        void this.cronJob.stop();
        cancelled = true;

        // Try to remove from scheduler registry if it exists
        try {
          if (this.schedulerRegistry.doesExist('cron', 'conference-update')) {
            this.schedulerRegistry.deleteCronJob('conference-update');
            console.log('✅ Removed cron job from scheduler registry');
          }
        } catch (registryError) {
          console.warn(
            'Warning: Could not remove job from scheduler registry:',
            registryError,
          );
          // Continue anyway since the job itself was stopped
        }

        // Clear the reference
        this.cronJob = null;
        console.log('✅ Cron job reference cleared');
      } else {
        console.log('ℹ️ No active cron job found to cancel');
      }

      // NOTE: NOT terminating queue here as it will be handled by stopConferenceCrawlOperations
      console.log('✅ CancelCronUpdate completed successfully');
    } catch (error) {
      console.error('❌ Error during cron job cancellation:', error);
      // Force clear the reference even if stopping failed
      this.cronJob = null;
    }

    return {
      message: cancelled
        ? 'Cron update cancelled successfully'
        : 'No active cron job to cancel',
      cancelled,
    };
  }

  getCronStatus() {
    const isActive = !!this.cronJob;
    let registryExists = false;

    try {
      registryExists = this.schedulerRegistry.doesExist(
        'cron',
        'conference-update',
      );
    } catch (error) {
      console.warn('Error checking scheduler registry:', error);
    }

    return {
      isActive,
      registryExists,
      schedule: this.cronJob?.cronTime.source || null,
      lastRun: this.cronJob?.lastDate() || null,
      nextRun: this.cronJob?.nextDate() || null,
    };
  }

  async scheduleUpdate(batchSize: number = 10, take?: number) {
    // Get all conferences
    const conferences = await this.prismaService.conferences.findMany({
      include: {
        organizations: {
          take: 1,
          orderBy: { updatedAt: 'asc' },
        },
      },
      where: {
        organizations: {
          some: {
            link: {
              not: '',
            },
            isLastest: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: take || undefined,
    });

    // Process conferences in batches
    const batches: ConferenceCrawlJobInputDTO[][] = [];
    for (let i = 0; i < conferences.length; i += batchSize) {
      const batch = conferences.slice(i, i + batchSize);
      const batchInputs = batch
        .filter((conference) => conference.organizations.length > 0)
        .map((conference) => ({
          conferenceId: conference.id,
          conferenceTitle: conference.title,
          conferenceAcronym: conference.acronym,
          mainLink: conference.organizations[0].link || '',
          cfpLink: conference.organizations[0].cfpLink || '',
          impLink: conference.organizations[0].impLink || '',
          status: ConferenceAttribute.JOB_STATUS_PENDING,
          progress: 0,
          message: ConferenceMessageJob.PENDING,
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
      message: 'Batch update jobs scheduled successfully',
      totalBatches: batches.length,
      totalConferences: results.flat().length,
      results,
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
    const jobType =
      input.mainLink || input.cfpLink || input.impLink
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

  /**
   * Create conference crawl jobs with automatic batch processing
   * Uses batch processing for multiple conferences, single processing for one conference
   */
  async createConferenceCrawlJobs(
    inputs: ConferenceCrawlJobInputDTO | ConferenceCrawlJobInputDTO[],
  ): Promise<ConferenceCrawlJobDTO | ConferenceCrawlJobDTO[]> {
    const inputArray = Array.isArray(inputs) ? inputs : [inputs];

    if (inputArray.length === 1) {
      // Single conference - use individual processing
      return this.createConferenceCrawlJob(inputArray[0]);
    } else {
      // Multiple conferences - use batch processing
      // Determine if these are updates (have links) or new crawls
      const hasLinks = inputArray.some(
        (input) => input.mainLink || input.cfpLink || input.impLink,
      );

      if (hasLinks) {
        return this.createBatchUpdateConferenceCrawlJob(inputArray);
      } else {
        return this.createBatchCrawlJob(inputArray);
      }
    }
  }

  async fetchConferenceCrawlData(
    input: ConferenceCrawlNewRequestDto,
  ): Promise<ConferenceCrawlNewResponseDto> {
    const CRAWL_URL = process.env.CRAWLER_URL;
    const { data }: { data: ConferenceCrawlNewResponseDto } =
      await firstValueFrom(
        this.httpService
          .post(CRAWL_URL + '/crawl-conferences', input, {
            params: { dataSource: 'client', mode: 'sync' },
            headers: {
              'Content-Type': 'application/json',
            },
          })
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
    console.log('Fetching update conference crawl data:', input);
    const { data }: { data: ConferenceCrawlNewResponseDto } =
      await firstValueFrom(
        this.httpService
          .post(CRAWL_URL + '/crawl-conferences', input, {
            params: { dataSource: 'client', mode: 'sync' },
            headers: {
              'Content-Type': 'application/json',
            },
          })
          .pipe(
            catchError((error) => {
              console.error(
                'Error fetching update conference crawl data:',
                error,
              );
              throw error;
            }),
          ),
      );
    console.log('Fetched update conference crawl data:', data);
    return data;
  }

  async importConferenceCrawlData(
    crawlData: ConferenceCrawlNewResponseDto,
    jobId: string,
  ): Promise<void> {
    try {
      // Update job status to running
      await this.prismaService.conferenceCrawlJobs.update({
        where: { id: jobId },
        data: {
          status: ConferenceAttribute.JOB_STATUS_RUNNING,
          progress: 20,
          message: ConferenceMessageJob.RUNNING,
        },
      });

      // Process each conference in the data array
      for (const conference of crawlData.data) {
        // Transform crawl data to ConferenceSaveDto format
        const conferenceData: ConferenceSaveDto = {
          title: conference.name,
          acronym: conference.acronym,
          year: conference.year,
          type: conference.type as ConferenceType,
          publisher: conference.publisher,
          summary: conference.summary,
          callForPapers: conference.callForPapers,
          mainLink: conference.mainLink,
          cfpLink: conference.cfpLink,
          impLink: conference.impLink,
          location: conference.location,
          cityStateProvince: conference.cityStateProvince,
          country: conference.country,
          continent: conference.continent as Continent,
          topics: conference.topics,
          submissionDate: conference.submissionDate as Record<string, string>,
          cameraReadyDate: conference.cameraReadyDate as Record<string, string>,
          conferenceDates: conference.conferenceDates,
          registrationDate: conference.registrationDate as Record<
            string,
            string
          >,
          notificationDate: conference.notificationDate as Record<
            string,
            string
          >,
          otherDate: conference.otherDate as Record<string, string>,
        };

        // Import the conference data
        await this.adminConferenceService.saveConference(conferenceData);
      }

      // Update job status to completed
      await this.prismaService.conferenceCrawlJobs.update({
        where: { id: jobId },
        data: {
          status: ConferenceAttribute.JOB_STATUS_COMPLETED,
          progress: 100,
          message: ConferenceMessageJob.COMPLETED,
        },
      });
    } catch (error: any) {
      // Update job status to failed
      await this.prismaService.conferenceCrawlJobs.update({
        where: { id: jobId },
        data: {
          status: ConferenceAttribute.JOB_STATUS_FAILED,
          progress: 0,
          message: ConferenceMessageJob.FAILED,
        },
      });

      throw new Error(
        `Failed to import conference crawl data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async fetchBatchUpdateConferenceCrawlData(
    inputs: ConferenceCrawlUpdateRequestDto[],
  ): Promise<ConferenceCrawlNewResponseDto> {
    const CRAWL_URL = process.env.CRAWLER_URL;
    const { data }: { data: ConferenceCrawlNewResponseDto } =
      await firstValueFrom(
        this.httpService
          .post(CRAWL_URL + '/crawl-conferences', inputs, {
            params: { dataSource: 'client', mode: 'sync' },
            headers: {
              'Content-Type': 'application/json',
            },
          })
          .pipe(
            catchError((error) => {
              throw error;
            }),
          ),
      );
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
      }),
    );

    // Generate a unique batch ID
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Use the new BATCH_CRAWL job type with ConferenceBatchCrawlJobDTO structure
    await this.conferenceCrawlQueue.add(CONFERENCE_CRAWL_JOB_NAME.BATCH_CRAWL, {
      batchId,
      conferences: jobInstances.map((instance, index) => ({
        id: instance.id,
        conferenceId: instance.conferenceId,
        conferenceAcronym: inputs[index].conferenceAcronym,
        conferenceTitle: inputs[index].conferenceTitle,
        mainLink: inputs[index].mainLink,
        cfpLink: inputs[index].cfpLink,
        impLink: inputs[index].impLink,
        progress: 0,
        status: ConferenceAttribute.JOB_STATUS_PENDING,
        message: ConferenceMessageJob.PENDING,
        createdAt: instance.createdAt,
        updatedAt: instance.updatedAt,
      })),
      progress: 0,
      message: `Batch job created with ${inputs.length} conferences`,
      totalCount: inputs.length,
      successCount: 0,
      failedCount: 0,
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

  async createBatchCrawlJob(
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
      }),
    );

    // Generate a unique batch ID
    const batchId = `batch-crawl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Use the new BATCH_CRAWL job type for new conference crawling
    await this.conferenceCrawlQueue.add(CONFERENCE_CRAWL_JOB_NAME.BATCH_CRAWL, {
      batchId,
      conferences: jobInstances.map((instance, index) => ({
        id: instance.id,
        conferenceId: instance.conferenceId,
        conferenceAcronym: inputs[index].conferenceAcronym,
        conferenceTitle: inputs[index].conferenceTitle,
        progress: 0,
        status: ConferenceAttribute.JOB_STATUS_PENDING,
        message: ConferenceMessageJob.PENDING,
        createdAt: instance.createdAt,
        updatedAt: instance.updatedAt,
      })),
      progress: 0,
      message: `Batch crawl job created with ${inputs.length} conferences`,
      totalCount: inputs.length,
      successCount: 0,
      failedCount: 0,
    });

    return jobInstances.map((instance, index) => ({
      id: instance.id,
      conferenceId: instance.conferenceId,
      conferenceTitle: inputs[index].conferenceTitle,
      conferenceAcronym: inputs[index].conferenceAcronym,
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

  async getConferenceToCrawl(take: number = 10) {
    return this.prismaService.conferences.findMany({
      where: {
        organizations: {
          some: {
            link: {
              not: '',
            },
          },
        },
      },
      take,
    });
  }

  /**
   * Force stop all conference update related cron jobs
   * This is a more aggressive cleanup method
   */
  async forceStopAllCronJobs() {
    let stopped = 0;
    const errors: string[] = [];

    try {
      // Stop our tracked cron job
      if (this.cronJob) {
        void this.cronJob.stop();
        this.cronJob = null;
        stopped++;
      }

      // Try to remove from scheduler registry
      try {
        if (this.schedulerRegistry.doesExist('cron', 'conference-update')) {
          this.schedulerRegistry.deleteCronJob('conference-update');
          stopped++;
        }
      } catch (error) {
        errors.push(
          `Registry deletion error: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
      }

      // Get all cron jobs and try to stop any that might be related
      try {
        const allJobs = this.schedulerRegistry.getCronJobs();
        for (const [jobName, job] of allJobs) {
          if (jobName.includes('conference') || jobName.includes('update')) {
            try {
              void job.stop();
              this.schedulerRegistry.deleteCronJob(jobName);
              stopped++;
            } catch (error) {
              errors.push(
                `Failed to stop job ${jobName}: ${error instanceof Error ? error.message : 'Unknown'}`,
              );
            }
          }
        }
      } catch (error) {
        errors.push(
          `Failed to get all cron jobs: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
      }

      // Force terminate the conference crawl queue
      try {
        await this.conferenceCrawlQueue.obliterate({ force: true });
        console.log('Conference crawl queue force terminated successfully');
        stopped++;
      } catch (queueError) {
        errors.push(
          `Failed to terminate conference crawl queue: ${queueError instanceof Error ? queueError.message : 'Unknown'}`,
        );
      }

      // Also try to pause and drain the queue as additional cleanup
      try {
        await this.conferenceCrawlQueue.pause();
        await this.conferenceCrawlQueue.drain(true);
        console.log('Conference crawl queue paused and drained successfully');
      } catch (drainError) {
        errors.push(
          `Failed to pause/drain queue: ${drainError instanceof Error ? drainError.message : 'Unknown'}`,
        );
      }
    } catch (error) {
      errors.push(
        `General error: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
    }

    return {
      message: `Force stop completed. Stopped ${stopped} jobs/queues.`,
      stopped,
      errors,
    };
  }

  /**
   * Comprehensive stop function that handles queue termination and database status updates
   * This function will:
   * 1. Stop and terminate the conference crawl queue
   * 2. Cancel any active cron jobs
   * 3. Update all pending/running jobs in the database to cancelled status
   * 4. Provide detailed feedback about the stop operation
   */
  async stopConferenceCrawlOperations() {
    console.log('🚀🚀🚀 ENTRY: stopConferenceCrawlOperations method called');
    console.log(
      '🚀 Starting comprehensive stop operation for conference crawl operations...',
    );

    const results = {
      queueStopped: false,
      cronJobsCancelled: false,
      jobsUpdated: 0,
      errors: [] as string[],
      summary: '',
    };

    try {
      // First, let's check current state before stopping
      console.log('📊 Checking current state before stopping...');

      // Check active jobs in database
      const [pendingJobs, runningJobs] = await Promise.all([
        this.prismaService.conferenceCrawlJobs.count({
          where: { status: ConferenceAttribute.JOB_STATUS_PENDING },
        }),
        this.prismaService.conferenceCrawlJobs.count({
          where: { status: ConferenceAttribute.JOB_STATUS_RUNNING },
        }),
      ]);

      console.log(
        `📈 Current database state: ${pendingJobs} pending jobs, ${runningJobs} running jobs`,
      );

      // Check queue state
      try {
        const [waiting, active, completed, failed] = await Promise.all([
          this.conferenceCrawlQueue.getWaiting(),
          this.conferenceCrawlQueue.getActive(),
          this.conferenceCrawlQueue.getCompleted(),
          this.conferenceCrawlQueue.getFailed(),
        ]);

        console.log(
          `📋 Queue state: ${waiting.length} waiting, ${active.length} active, ${completed.length} completed, ${failed.length} failed`,
        );

        // Log active jobs details
        if (active.length > 0) {
          console.log(
            '🔄 Active jobs in queue:',
            active.map((job: any) => ({
              id: job.id,
              name: job.name,
              progress: job.progress,
              data: job.data,
            })),
          );
        }
      } catch (queueCheckError) {
        console.warn('⚠️ Could not check queue state:', queueCheckError);
      }

      // 1. Stop and terminate the conference crawl queue
      console.log('🛑 Step 1: Stopping conference crawl queue...');
      try {
        // Get current active jobs before stopping to update their database status
        const activeJobs = await this.conferenceCrawlQueue.getActive();
        const waitingJobs = await this.conferenceCrawlQueue.getWaiting();
        
        console.log(
          `🔍 Found ${activeJobs.length} active jobs and ${waitingJobs.length} waiting jobs to terminate`,
        );

        // Log details of jobs that will be terminated
        if (activeJobs.length > 0) {
          console.log(
            '🔄 Active jobs being terminated:',
            activeJobs.map((job: any) => ({
              id: job.id,
              name: job.name,
              data: job.data?.conferenceId || job.data?.id || 'unknown',
            })),
          );
        }

        if (waitingJobs.length > 0) {
          console.log(
            '⏳ Waiting jobs being terminated:',
            waitingJobs.map((job: any) => ({
              id: job.id,
              name: job.name,
              data: job.data?.conferenceId || job.data?.id || 'unknown',
            })),
          );
        }

        // First pause the queue to prevent new jobs from being processed
        await this.conferenceCrawlQueue.pause();
        console.log('⏸️ Conference crawl queue paused successfully');

        // Remove all waiting jobs and get the count
        await this.conferenceCrawlQueue.drain(true);
        console.log('🚰 Conference crawl queue drained successfully');

        // Force terminate all jobs including active ones
        await this.conferenceCrawlQueue.obliterate({ force: true });
        console.log('💥 Conference crawl queue obliterated successfully');

        // Update database status for jobs that were in the queue
        if (activeJobs.length > 0 || waitingJobs.length > 0) {
          try {
            // Extract job IDs from queue jobs to update their database status
            const queueJobIds = [...activeJobs, ...waitingJobs]
              .map((job: any) => job.data?.id as string)
              .filter(Boolean);

            if (queueJobIds.length > 0) {
              console.log(
                `📝 Updating ${queueJobIds.length} queue jobs in database:`,
                queueJobIds,
              );

              const queueUpdateResult =
                await this.prismaService.conferenceCrawlJobs.updateMany({
                  where: {
                    id: { in: queueJobIds },
                  },
                  data: {
                    status: ConferenceAttribute.JOB_STATUS_CANCELLED,
                    progress: 0,
                    message: ConferenceMessageJob.CANCELLED,
                    updatedAt: new Date(),
                  },
                });

              console.log(
                `✅ Updated ${queueUpdateResult.count} queue jobs to CANCELLED status`,
              );
            }
          } catch (queueUpdateError) {
            console.error(
              '❌ Failed to update queue jobs in database:',
              queueUpdateError,
            );
          }
        }

        results.queueStopped = true;
        console.log(
          '✅ Step 1 completed: Queue operations stopped and database updated',
        );
      } catch (queueError) {
        const errorMsg = `Failed to stop queue: ${queueError instanceof Error ? queueError.message : 'Unknown'}`;
        results.errors.push(errorMsg);
        console.error('❌ Step 1 failed:', errorMsg);
      }

      // 2. Cancel any active cron jobs
      console.log('🛑 Step 2: Cancelling active cron jobs...');
      try {
        const cancelResult = await this.cancelCronUpdate();
        results.cronJobsCancelled = cancelResult.cancelled;
        console.log('📝 Cron jobs cancellation result:', cancelResult);
        console.log('✅ Step 2 completed: Cron jobs handled');
      } catch (cronError) {
        const errorMsg = `Failed to cancel cron jobs: ${cronError instanceof Error ? cronError.message : 'Unknown'}`;
        results.errors.push(errorMsg);
        console.error('❌ Step 2 failed:', errorMsg);
      }

      // 3. Update all pending/running jobs in the database to cancelled status
      console.log('🛑 Step 3: Updating database job statuses...');
      try {
        const forceUpdateResult = await this.forceUpdateJobsToCancel();
        results.jobsUpdated = forceUpdateResult.updated;
        console.log(
          '✅ Step 3 completed: Database jobs updated using dedicated method',
        );
      } catch (dbError) {
        const errorMsg = `Failed to update database jobs: ${dbError instanceof Error ? dbError.message : 'Unknown'}`;
        results.errors.push(errorMsg);
        console.error('❌ Step 3 failed:', errorMsg);
      }

      // 4. Final verification and summary
      console.log('📊 Step 4: Final verification...');
      try {
        const [finalPending, finalRunning, finalCancelled] = await Promise.all([
          this.prismaService.conferenceCrawlJobs.count({
            where: { status: ConferenceAttribute.JOB_STATUS_PENDING },
          }),
          this.prismaService.conferenceCrawlJobs.count({
            where: { status: ConferenceAttribute.JOB_STATUS_RUNNING },
          }),
          this.prismaService.conferenceCrawlJobs.count({
            where: { status: ConferenceAttribute.JOB_STATUS_CANCELLED },
          }),
        ]);

        console.log(
          `📈 Final database state: ${finalPending} pending, ${finalRunning} running, ${finalCancelled} cancelled`,
        );

        // Check if there are still pending/running jobs
        if (finalPending > 0 || finalRunning > 0) {
          console.warn(
            `⚠️ Warning: Still found ${finalPending} pending and ${finalRunning} running jobs after stop operation`,
          );
          results.errors.push(
            `Still have ${finalPending} pending and ${finalRunning} running jobs after stop operation`,
          );
        }
      } catch (verificationError) {
        console.warn(
          '⚠️ Could not perform final verification:',
          verificationError,
        );
      }

      // 5. Generate summary
      const successfulOperations = [
        results.queueStopped && 'Queue stopped',
        results.cronJobsCancelled && 'Cron jobs cancelled',
        results.jobsUpdated > 0 && `${results.jobsUpdated} jobs updated`,
      ].filter(Boolean);

      if (successfulOperations.length > 0) {
        results.summary = `Stop operation completed. ${successfulOperations.join(', ')}.`;
      } else {
        results.summary =
          'Stop operation completed but no active operations were found.';
      }

      if (results.errors.length > 0) {
        results.summary += ` ${results.errors.length} error(s) occurred during the process.`;
      }

      console.log('📋 Stop operation summary:', results.summary);
      console.log('🏁 Stop operation completed!');
      return results;
    } catch (generalError) {
      const errorMsg = `General error during stop operation: ${generalError instanceof Error ? generalError.message : 'Unknown'}`;
      results.errors.push(errorMsg);
      results.summary = `Stop operation failed: ${errorMsg}`;
      console.error('💥 Stop operation failed:', errorMsg);
      return results;
    }
  }

  /**
   * Force update all pending and running jobs to cancelled status
   * This is a dedicated method to ensure database consistency
   */
  async forceUpdateJobsToCancel() {
    console.log('🔧🔧🔧 ENTRY: forceUpdateJobsToCancel method called');
    console.log('🔧 Force updating all pending/running jobs to cancelled...');

    try {
      // First, check what jobs exist before updating
      const [currentPending, currentRunning] = await Promise.all([
        this.prismaService.conferenceCrawlJobs.findMany({
          where: { status: ConferenceAttribute.JOB_STATUS_PENDING },
          select: {
            id: true,
            conferenceId: true,
            status: true,
            createdAt: true,
          },
        }),
        this.prismaService.conferenceCrawlJobs.findMany({
          where: { status: ConferenceAttribute.JOB_STATUS_RUNNING },
          select: {
            id: true,
            conferenceId: true,
            status: true,
            createdAt: true,
          },
        }),
      ]);

      console.log(
        `📊 Before update: ${currentPending.length} pending, ${currentRunning.length} running jobs`,
      );
      
      if (currentPending.length > 0) {
        console.log('📝 Pending jobs to be cancelled:', currentPending);
      }
      
      if (currentRunning.length > 0) {
        console.log('📝 Running jobs to be cancelled:', currentRunning);
      }

      // Update all pending and running jobs to cancelled
      const updateResult =
        await this.prismaService.conferenceCrawlJobs.updateMany({
          where: {
            OR: [
              { status: ConferenceAttribute.JOB_STATUS_PENDING },
              { status: ConferenceAttribute.JOB_STATUS_RUNNING },
            ],
          },
          data: {
            status: ConferenceAttribute.JOB_STATUS_CANCELLED,
            progress: 0,
            message: ConferenceMessageJob.CANCELLED,
            updatedAt: new Date(),
          },
        });

      console.log(`✅ Updated ${updateResult.count} jobs to CANCELLED status`);

      // Verify the update
      const [finalPending, finalRunning, finalCancelled] = await Promise.all([
        this.prismaService.conferenceCrawlJobs.count({
          where: { status: ConferenceAttribute.JOB_STATUS_PENDING },
        }),
        this.prismaService.conferenceCrawlJobs.count({
          where: { status: ConferenceAttribute.JOB_STATUS_RUNNING },
        }),
        this.prismaService.conferenceCrawlJobs.count({
          where: { status: ConferenceAttribute.JOB_STATUS_CANCELLED },
        }),
      ]);

      console.log(
        `📊 After update: ${finalPending} pending, ${finalRunning} running, ${finalCancelled} cancelled jobs`,
      );

      return {
        updated: updateResult.count,
        beforeUpdate: {
          pending: currentPending.length,
          running: currentRunning.length,
        },
        afterUpdate: {
          pending: finalPending,
          running: finalRunning,
          cancelled: finalCancelled,
        },
      };
    } catch (error) {
      const errorMsg = `Failed to force update jobs: ${error instanceof Error ? error.message : 'Unknown'}`;
      console.error('❌ Force update failed:', errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * Get detailed status of conference crawl jobs for debugging
   * This helps identify why jobs might not be stopping properly
   */
  async getDetailedJobStatus() {
    console.log('🔍 Getting detailed job status for debugging...');

    try {
      const [
        allJobs,
        pendingJobs,
        runningJobs,
        completedJobs,
        failedJobs,
        cancelledJobs,
      ] = await Promise.all([
        this.prismaService.conferenceCrawlJobs.count(),
        this.prismaService.conferenceCrawlJobs.findMany({
          where: { status: ConferenceAttribute.JOB_STATUS_PENDING },
          select: {
            id: true,
            conferenceId: true,
            status: true,
            progress: true,
            message: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        this.prismaService.conferenceCrawlJobs.findMany({
          where: { status: ConferenceAttribute.JOB_STATUS_RUNNING },
          select: {
            id: true,
            conferenceId: true,
            status: true,
            progress: true,
            message: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        this.prismaService.conferenceCrawlJobs.count({
          where: { status: ConferenceAttribute.JOB_STATUS_COMPLETED },
        }),
        this.prismaService.conferenceCrawlJobs.count({
          where: { status: ConferenceAttribute.JOB_STATUS_FAILED },
        }),
        this.prismaService.conferenceCrawlJobs.count({
          where: { status: ConferenceAttribute.JOB_STATUS_CANCELLED },
        }),
      ]);

      // Check queue status
      let queueStatus;
      try {
        const [waiting, active, completed, failed] = await Promise.all([
          this.conferenceCrawlQueue.getWaiting(),
          this.conferenceCrawlQueue.getActive(),
          this.conferenceCrawlQueue.getCompleted(),
          this.conferenceCrawlQueue.getFailed(),
        ]);

        queueStatus = {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          activeJobs: active.map((job: any) => ({
            id: job.id,
            name: job.name,
            progress: job.progress,
          })),
        };
      } catch (queueError) {
        queueStatus = {
          error: `Could not get queue status: ${queueError instanceof Error ? queueError.message : 'Unknown'}`,
        };
      }

      const result = {
        database: {
          totalJobs: allJobs,
          pending: {
            count: pendingJobs.length,
            jobs: pendingJobs,
          },
          running: {
            count: runningJobs.length,
            jobs: runningJobs,
          },
          completed: completedJobs,
          failed: failedJobs,
          cancelled: cancelledJobs,
        },
        queue: queueStatus,
        cronJob: this.getCronStatus(),
      };

      console.log(
        '📊 Detailed status result:',
        JSON.stringify(result, null, 2),
      );
      return result;
    } catch (error) {
      const errorMsg = `Failed to get detailed job status: ${error instanceof Error ? error.message : 'Unknown'}`;
      console.error('❌ Error getting detailed status:', errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * Simple test method to call both individual operations
   * Use this to debug which specific operation is failing
   */
  async testStopOperations() {
    console.log('🧪 Testing stop operations individually...');

    try {
      // Test 1: Force update database jobs
      console.log('🧪 Test 1: Force updating database jobs...');
      const updateResult = await this.forceUpdateJobsToCancel();
      console.log('✅ Test 1 passed:', updateResult);

      // Test 2: Get detailed status
      console.log('🧪 Test 2: Getting detailed status...');
      const statusResult = await this.getDetailedJobStatus();
      console.log('✅ Test 2 passed - see detailed output above');

      // Test 3: Force stop cron jobs
      console.log('🧪 Test 3: Force stopping cron jobs...');
      const cronResult = await this.forceStopAllCronJobs();
      console.log('✅ Test 3 passed:', cronResult);

      return {
        success: true,
        updateResult,
        statusResult,
        cronResult,
      };
    } catch (error) {
      console.error('❌ Test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
