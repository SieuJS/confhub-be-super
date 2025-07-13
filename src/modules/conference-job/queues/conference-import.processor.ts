/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { LoggerService } from '../../common';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { CONFERENCE_QUEUE_NAME } from '../../../constants/queue-name';
import { CONFERENCE_CRAWL_JOB_NAME } from '../../../constants/job-name';
import { ConferenceCrawlJobService } from '../services';
import { ConferenceOrganizationSerivce } from '../../conference-organization';
import { MessageService } from '../../socket-gateway/services/message.service';
import { ConferenceCrawlJobDTO } from '../models/conference-crawl-job/conference-crawl-job.dto';
import { ConferenceBatchCrawlJobDTO } from '../models/conference-crawl-job/conference-batch-crawl-job.dto';
import {
  ConferenceAttribute,
  ConferenceMessageJob,
} from '../../../constants/conference-attribute';
import { PrismaService } from '../../common';

@Injectable()
@Processor(CONFERENCE_QUEUE_NAME.CRAWL)
export class ConferenceImportProcessor extends WorkerHost {
  constructor(
    private loggerService: LoggerService,
    private conferenceCrawlJobService: ConferenceCrawlJobService,
    private conferenceOrganizationService: ConferenceOrganizationSerivce,
    private messageService: MessageService,
    private prismaService: PrismaService,
  ) {
    super();
  }

  /**
   * Update job status in database for statistics tracking
   */
  private async updateJobStatusInDatabase(
    jobId: string,
    status: ConferenceAttribute,
    progress: number,
    message: string,
  ): Promise<void> {
    try {
      await this.prismaService.conferenceCrawlJobs.update({
        where: { id: jobId },
        data: {
          status,
          progress,
          message,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      this.loggerService.error(
        `Failed to update job status in database for job ${jobId}: ${error.message}`,
      );
    }
  }

  /**
   * Update individual job status in database (for batch processing)
   */
  private async updateIndividualJobInBatch(
    jobId: string,
    status: ConferenceAttribute,
    progress: number,
    message: string,
  ): Promise<void> {
    try {
      await this.prismaService.conferenceCrawlJobs.update({
        where: { id: jobId },
        data: {
          status,
          progress,
          message,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      this.loggerService.error(
        `Failed to update individual job status in database for job ${jobId}: ${error.message}`,
      );
    }
  }

  async process(
    job: Job<ConferenceCrawlJobDTO | ConferenceBatchCrawlJobDTO, any, string>,
  ) {
    switch (job.name) {
      case CONFERENCE_CRAWL_JOB_NAME.CRAWL:
        await this.handleCrawlConferenceJob(job as Job<ConferenceCrawlJobDTO>);
        break;
      case CONFERENCE_CRAWL_JOB_NAME.BATCH_CRAWL:
        await this.handleBatchCrawlConferenceJob(
          job as Job<ConferenceBatchCrawlJobDTO>,
        );
        break;
      case CONFERENCE_CRAWL_JOB_NAME.UPDATE:
        this.handleUpdateConferenceJob(job as Job<ConferenceCrawlJobDTO>);
        break;
      case CONFERENCE_CRAWL_JOB_NAME.NOTIFY:
        this.loggerService.info(`Notifying conference import`);
        break;
      default:
        this.loggerService.error(`Unknown job name ${job.name}`);
        break;
    }
    return job.data;
  }

  async handleCrawlConferenceJob(job: Job<ConferenceCrawlJobDTO>) {
    const conferences = Array.isArray(job.data) ? job.data : [job.data];
    const channel = 'cfp-crawl-' + job.data.id;

    try {
      // Set job status to running
      job.data.status = ConferenceAttribute.JOB_STATUS_RUNNING;
      job.data.progress = 0;
      job.data.message = ConferenceMessageJob.RUNNING;
      await job.updateProgress(0);

      // Update database status
      await this.updateJobStatusInDatabase(
        job.data.id,
        ConferenceAttribute.JOB_STATUS_RUNNING,
        0,
        ConferenceMessageJob.RUNNING,
      );

      // Send initial status update
      this.messageService.sendMessage(channel, {
        progress: 0,
        message: ConferenceMessageJob.RUNNING,
        status: ConferenceAttribute.JOB_STATUS_RUNNING,
      });

      this.loggerService.info(`Job data: ${JSON.stringify(job.data)}`);
      this.loggerService.info(
        `Sending crawl request for ${conferences.length} conferences`,
      );

      // Check if this is an update job (conferences have links) or new crawl job
      const hasLinks = conferences.some(
        (conf) => conf.mainLink || conf.cfpLink || conf.impLink,
      );

      let crawlDataResponse;

      if (hasLinks) {
        // Use update crawler for conferences with existing links
        this.loggerService.info(
          `Using update crawler for conference with existing links`,
        );

        const updateItems = conferences.map((conf) => ({
          Title: conf.conferenceTitle || '',
          Acronym: conf.conferenceAcronym || '',
          mainLink: conf.mainLink || '',
          cfpLink: conf.cfpLink || '',
          impLink: conf.impLink || '',
        }));

        crawlDataResponse =
          await this.conferenceCrawlJobService.fetchUpdateConferenceCrawlData({
            items: updateItems,
            models: {
              determineLinks: 'tuned',
              extractInfo: 'non-tuned',
              extractCfp: 'non-tuned',
            },
            description: `Update crawl for ${conferences.length} conferences`,
          });
      } else {
        // Use new crawler for conferences without links
        this.loggerService.info(
          `Using new crawler for conference without existing links`,
        );

        crawlDataResponse =
          await this.conferenceCrawlJobService.fetchConferenceCrawlData({
            items: conferences.map((conf) => ({
              Title: conf.conferenceTitle || '',
              Acronym: conf.conferenceAcronym || '',
            })),
            models: {
              determineLinks: 'tuned',
              extractInfo: 'non-tuned',
              extractCfp: 'non-tuned',
            },
            description: 'Crawl conference data',
          });
      }

      if (
        !crawlDataResponse ||
        !crawlDataResponse.data ||
        crawlDataResponse.data.length === 0
      ) {
        this.loggerService.error(`No data found for any of the conferences`);
        throw new Error(`No data found for any of the conferences`);
      }

      // Log mismatch if crawler returns different number of results than expected
      if (crawlDataResponse.data.length !== conferences.length) {
        this.loggerService.error(
          `Crawler returned ${crawlDataResponse.data.length} results but expected ${conferences.length}. Some conferences may not have been processed by the crawler.`,
        );
        throw new Error(
          `Crawler data mismatch: expected ${conferences.length} results, got ${crawlDataResponse.data.length}`,
        );
      }

      // Process each conference by matching title and acronym
      for (let i = 0; i < conferences.length; i++) {
        const conference = conferences[i];

        // Find matching crawler data by title and acronym
        const crawlData = crawlDataResponse.data.find((data: any) => {
          const dataName = String(data.name || '').toLowerCase();
          const conferenceTitle = String(
            conference.conferenceTitle || '',
          ).toLowerCase();
          const dataAcronym = String(data.acronym || '').toLowerCase();
          const conferenceAcronym = String(
            conference.conferenceAcronym || '',
          ).toLowerCase();

          const titleMatch =
            dataName.includes(conferenceTitle) ||
            conferenceTitle.includes(dataName);
          const acronymMatch = dataAcronym === conferenceAcronym;
          return Boolean(titleMatch || acronymMatch);
        });

        if (!crawlData) {
          this.loggerService.error(
            `No matching crawler data found for conference: ${conference.conferenceTitle} (${conference.conferenceAcronym})`,
          );
          continue; // Skip this conference
        }

        this.loggerService.info(
          `Processing conference ${i + 1}/${conferences.length}: ${conference.conferenceTitle}`,
        );

        // Log crawler data for debugging
        this.loggerService.info(
          `Crawler data for ${conference.conferenceTitle}: ${JSON.stringify({
            year: crawlData.year,
            type: crawlData.type,
            mainLink: crawlData.mainLink,
            cfpLink: crawlData.cfpLink,
            impLink: crawlData.impLink,
            summary: crawlData.summary,
            callForPapers: crawlData.callForPapers,
            publisher: crawlData.publisher,
          })}`,
        );

        // Update progress during processing
        const progress = Math.round(((i + 0.5) / conferences.length) * 100);
        job.data.progress = progress;
        job.data.message = `Processing conference ${i + 1}/${conferences.length}`;
        await job.updateProgress(progress);

        this.messageService.sendMessage(channel, {
          progress,
          message: `Processing conference ${i + 1}/${conferences.length}`,
          status: ConferenceAttribute.JOB_STATUS_RUNNING,
        });

        const organizeData =
          await this.conferenceOrganizationService.importOrganize({
            year: parseInt(String(crawlData.year || '0')),
            conferenceId: conference.conferenceId,
            accessType: crawlData.type,
            link: crawlData.mainLink || '',
            cfpLink: crawlData.cfpLink || '',
            impLink: crawlData.impLink || '',
            summerize: crawlData.summary || '',
            callForPaper: crawlData.callForPapers || '',
            publisher: crawlData.publisher || '',
            isAvailable: true,
          });

        if (!organizeData) {
          this.loggerService.error(
            `Failed to import organization data for ${conference.conferenceTitle}`,
          );
          continue; // Skip to next conference instead of failing the whole batch
        }

        // Log successful organization import
        this.loggerService.info(
          `Successfully imported organization data for ${conference.conferenceTitle}. Organization ID: ${organizeData.id}`,
        );

        // Import place data
        this.loggerService.info(
          `Importing place data for ${conference.conferenceTitle}: ${JSON.stringify(
            {
              continent: crawlData.continent,
              country: crawlData.country,
              cityStateProvince: crawlData.cityStateProvince,
              address: crawlData.location,
            },
          )}`,
        );

        await this.conferenceOrganizationService.importPlace({
          continent: crawlData.continent,
          country: crawlData.country,
          cityStateProvince: crawlData.cityStateProvince,
          address: crawlData.location,
          organizeId: organizeData.id,
        });

        this.loggerService.info(
          `Successfully imported place data for ${conference.conferenceTitle}`,
        );

        // Import topics
        this.loggerService.info(
          `Importing topics for ${conference.conferenceTitle}: ${crawlData.topics}`,
        );

        const createdTopics = await Promise.all(
          crawlData.topics.split(' ').map((topic) => {
            return this.conferenceOrganizationService.importTopic({
              organized: organizeData.id,
              topic: topic,
            });
          }),
        );

        await Promise.all(createdTopics);

        this.loggerService.info(
          `Successfully imported ${createdTopics.length} topics for ${conference.conferenceTitle}`,
        );

        // Import dates from crawler data
        this.loggerService.info(
          `Importing dates for ${conference.conferenceTitle}. Available date fields: ${JSON.stringify(
            {
              conferenceDates: crawlData.conferenceDates,
              submissionDate: crawlData.submissionDate,
              notificationDate: crawlData.notificationDate,
              cameraReadyDate: crawlData.cameraReadyDate,
              registrationDate: crawlData.registrationDate,
              conferenceDate: crawlData.conferenceDate,
              dates: crawlData.dates,
            },
          )}`,
        );

        await this.conferenceOrganizationService.importDatesFromCrawlerData(
          crawlData,
          organizeData.id,
        );

        this.loggerService.info(
          `Successfully imported dates for ${conference.conferenceTitle}`,
        );

        // Update latest organization flag for this conference
        await this.conferenceOrganizationService.updateLastestOrganizationById(
          String(conference.conferenceId),
        );

        this.loggerService.info(
          `Successfully processed conference: ${conference.conferenceTitle}`,
        );
      }

      // Update job status to completed
      job.data.status = ConferenceAttribute.JOB_STATUS_COMPLETED;
      job.data.progress = 100;
      job.data.message = ConferenceMessageJob.COMPLETED;
      await job.updateProgress(100);

      // Update database status
      await this.updateJobStatusInDatabase(
        job.data.id,
        ConferenceAttribute.JOB_STATUS_COMPLETED,
        100,
        ConferenceMessageJob.COMPLETED,
      );

      this.messageService.sendMessage(channel, {
        progress: 100,
        message: ConferenceMessageJob.COMPLETED,
        status: ConferenceAttribute.JOB_STATUS_COMPLETED,
      });

      this.loggerService.info(
        `Imported data for ${conferences.length} conferences`,
      );
    } catch (e) {
      // Update job status to failed
      const errorMessage = `${ConferenceMessageJob.FAILED}: ${e.message}`;
      job.data.status = ConferenceAttribute.JOB_STATUS_FAILED;
      job.data.progress = 100;
      job.data.message = errorMessage;
      await job.updateProgress(100);

      // Update database status
      await this.updateJobStatusInDatabase(
        job.data.id,
        ConferenceAttribute.JOB_STATUS_FAILED,
        100,
        errorMessage,
      );

      this.loggerService.error(
        `Error while importing conference data: ${e.message}`,
      );
      this.messageService.sendMessage(channel, {
        progress: 100,
        message: errorMessage,
        status: ConferenceAttribute.JOB_STATUS_FAILED,
      });
      this.loggerService.error(String(e));

      // Re-throw the error so the job is marked as failed in BullMQ
      throw e;
    }
  }

  async handleBatchCrawlConferenceJob(job: Job<ConferenceBatchCrawlJobDTO>) {
    const { conferences, batchId } = job.data;
    const channel = 'cfp-batch-crawl-' + batchId;
    const totalCount = conferences.length;
    let successCount = 0;
    let failedCount = 0;

    try {
      this.loggerService.info(`Batch job data: ${JSON.stringify(job.data)}`);
      this.loggerService.info(
        `Sending batch crawl request for ${totalCount} conferences`,
      );

      // Initialize batch job status
      job.data.progress = 0;
      job.data.successCount = 0;
      job.data.failedCount = 0;
      job.data.message = `Starting batch crawl for ${totalCount} conferences`;
      await job.updateProgress(0);

      // Update all conference jobs to running status in database
      for (const conference of conferences) {
        await this.updateIndividualJobInBatch(
          conference.id,
          ConferenceAttribute.JOB_STATUS_RUNNING,
          0,
          `Starting batch crawl for ${totalCount} conferences`,
        );
      }

      // Send progress update at start
      this.messageService.sendMessage(channel, {
        progress: 0,
        message: `Starting batch crawl for ${totalCount} conferences`,
        status: ConferenceAttribute.JOB_STATUS_RUNNING,
        successCount,
        failedCount,
        totalCount,
      });

      // Check if this is an update job (conferences have links) or new crawl job
      const hasLinks = conferences.some(
        (conf) => conf.mainLink || conf.cfpLink || conf.impLink,
      );

      let crawlDataResponse;

      if (hasLinks) {
        // Use update crawler for conferences with existing links
        this.loggerService.info(
          `Using update crawler for batch with existing links`,
        );

        const updateItems = conferences.map((conf) => ({
          Title: conf.conferenceTitle || '',
          Acronym: conf.conferenceAcronym || '',
          mainLink: conf.mainLink || '',
          cfpLink: conf.cfpLink || '',
          impLink: conf.impLink || '',
        }));

        crawlDataResponse =
          await this.conferenceCrawlJobService.fetchUpdateConferenceCrawlData({
            items: updateItems,
            models: {
              determineLinks: 'tuned',
              extractInfo: 'non-tuned',
              extractCfp: 'non-tuned',
            },
            description: `Batch update crawl for ${totalCount} conferences`,
          });
      } else {
        // Use new crawler for conferences without links
        this.loggerService.info(
          `Using new crawler for batch without existing links`,
        );

        crawlDataResponse =
          await this.conferenceCrawlJobService.fetchConferenceCrawlData({
            items: conferences.map((conf) => ({
              Title: conf.conferenceTitle || '',
              Acronym: conf.conferenceAcronym || '',
            })),
            models: {
              determineLinks: 'tuned',
              extractInfo: 'non-tuned',
              extractCfp: 'non-tuned',
            },
            description: `Batch crawl for ${totalCount} conferences`,
          });
      }

      if (
        !crawlDataResponse ||
        !crawlDataResponse.data ||
        crawlDataResponse.data.length === 0
      ) {
        this.loggerService.error(
          `No data found for any of the conferences in batch`,
        );
        throw new Error(`No data found for any of the conferences in batch`);
      }

      // Log the mismatch if crawler returns fewer results than expected
      if (crawlDataResponse.data.length !== totalCount) {
        this.loggerService.error(
          `Crawler returned ${crawlDataResponse.data.length} results but expected ${totalCount}. Some conferences may not have been processed by the crawler.`,
        );
      }

      // Process each conference with matching crawl data
      for (let i = 0; i < conferences.length; i++) {
        const conference = conferences[i];

        // Find matching crawler data by title and acronym
        const crawlData = crawlDataResponse.data.find((data: any) => {
          const dataName = String(data.name || '').toLowerCase();
          const conferenceTitle = String(
            conference.conferenceTitle || '',
          ).toLowerCase();
          const dataAcronym = String(data.acronym || '').toLowerCase();
          const conferenceAcronym = String(
            conference.conferenceAcronym || '',
          ).toLowerCase();

          const titleMatch =
            dataName.includes(conferenceTitle) ||
            conferenceTitle.includes(dataName);
          const acronymMatch = dataAcronym === conferenceAcronym;
          return Boolean(titleMatch || acronymMatch);
        });

        // If no matching data found, mark as failed
        if (!crawlData) {
          this.loggerService.error(
            `No matching crawler data found for conference: ${conference.conferenceTitle} (${conference.conferenceAcronym})`,
          );
          failedCount++;
          await this.updateIndividualJobInBatch(
            conference.id,
            ConferenceAttribute.JOB_STATUS_FAILED,
            100,
            `No matching data found in crawler response`,
          );
          continue;
        }

        try {
          this.loggerService.info(
            `Processing conference ${i + 1}/${totalCount}: ${conference.conferenceTitle}`,
          );

          // Log crawler data for debugging
          this.loggerService.info(
            `Crawler data for ${conference.conferenceTitle}: ${JSON.stringify({
              year: crawlData.year,
              type: crawlData.type,
              mainLink: crawlData.mainLink,
              cfpLink: crawlData.cfpLink,
              impLink: crawlData.impLink,
              summary: crawlData.summary,
              callForPapers: crawlData.callForPapers,
              publisher: crawlData.publisher,
            })}`,
          );

          const organizeData =
            await this.conferenceOrganizationService.importOrganize({
              year: parseInt(String(crawlData.year || '0')),
              conferenceId: conference.conferenceId,
              accessType: crawlData.type,
              link: crawlData.mainLink || '',
              cfpLink: crawlData.cfpLink || '',
              impLink: crawlData.impLink || '',
              summerize: crawlData.summary || '',
              callForPaper: crawlData.callForPapers || '',
              publisher: crawlData.publisher || '',
              isAvailable: true,
            });

          if (!organizeData) {
            this.loggerService.error(
              `Failed to import organization data for ${conference.conferenceTitle}`,
            );
            failedCount++;
            job.data.failedCount = failedCount;

            // Update individual job status to failed in database
            await this.updateIndividualJobInBatch(
              conference.id,
              ConferenceAttribute.JOB_STATUS_FAILED,
              100,
              `Failed to import organization data for ${conference.conferenceTitle}`,
            );

            continue;
          }

          // Log successful organization import
          this.loggerService.info(
            `Successfully imported organization data for ${conference.conferenceTitle}. Organization ID: ${organizeData.id}`,
          );

          // Import place data
          this.loggerService.info(
            `Importing place data for ${conference.conferenceTitle}: ${JSON.stringify(
              {
                continent: crawlData.continent,
                country: crawlData.country,
                cityStateProvince: crawlData.cityStateProvince,
                address: crawlData.location,
              },
            )}`,
          );

          await this.conferenceOrganizationService.importPlace({
            continent: crawlData.continent,
            country: crawlData.country,
            cityStateProvince: crawlData.cityStateProvince,
            address: crawlData.location,
            organizeId: organizeData.id,
          });

          this.loggerService.info(
            `Successfully imported place data for ${conference.conferenceTitle}`,
          );

          // Import topics
          this.loggerService.info(
            `Importing topics for ${conference.conferenceTitle}: ${crawlData.topics}`,
          );

          const createdTopics = await Promise.all(
            crawlData.topics.split(' ').map((topic) => {
              return this.conferenceOrganizationService.importTopic({
                organized: organizeData.id,
                topic: topic,
              });
            }),
          );

          await Promise.all(createdTopics);

          this.loggerService.info(
            `Successfully imported ${createdTopics.length} topics for ${conference.conferenceTitle}`,
          );

          // Import dates from crawler data
          this.loggerService.info(
            `Importing dates for ${conference.conferenceTitle}. Available date fields: ${JSON.stringify(
              {
                conferenceDates: crawlData.conferenceDates,
                submissionDate: crawlData.submissionDate,
                notificationDate: crawlData.notificationDate,
                cameraReadyDate: crawlData.cameraReadyDate,
                registrationDate: crawlData.registrationDate,
                conferenceDate: crawlData.conferenceDate,
                dates: crawlData.dates,
              },
            )}`,
          );

          await this.conferenceOrganizationService.importDatesFromCrawlerData(
            crawlData,
            organizeData.id,
          );

          await this.conferenceOrganizationService.updateLastestOrganizationById(
            String(conference.conferenceId),
          );

          this.loggerService.info(
            `Successfully imported dates for ${conference.conferenceTitle}`,
          );
          successCount++;

          // Update latest organization flag for this conferenc

          // Update individual job status to completed in database
          await this.updateIndividualJobInBatch(
            conference.id,
            ConferenceAttribute.JOB_STATUS_COMPLETED,
            100,
            `Successfully processed: ${conference.conferenceTitle}`,
          );

          // Update progress for BullMQ
          const progress = Math.round(((i + 1) / totalCount) * 100);
          job.data.progress = progress;
          job.data.successCount = successCount;
          job.data.failedCount = failedCount;
          job.data.message = `Processed ${i + 1}/${totalCount} conferences`;
          await job.updateProgress(progress);

          this.messageService.sendMessage(channel, {
            progress,
            message: `Processed ${i + 1}/${totalCount} conferences`,
            status: ConferenceAttribute.JOB_STATUS_RUNNING,
            successCount,
            failedCount,
            totalCount,
          });

          this.loggerService.info(
            `Successfully processed conference ${i + 1}/${totalCount}: ${conference.conferenceTitle}`,
          );
        } catch (conferenceError) {
          failedCount++;
          job.data.failedCount = failedCount;

          // Update individual job status to failed in database
          await this.updateIndividualJobInBatch(
            conference.id,
            ConferenceAttribute.JOB_STATUS_FAILED,
            100,
            `Failed to process: ${conferenceError.message}`,
          );

          this.loggerService.error(
            `Error processing conference ${conference.conferenceTitle}: ${conferenceError.message}`,
          );
          // Continue processing other conferences even if one fails
        }
      }

      // Final status update - determine overall status message
      const statusMessage =
        failedCount === 0
          ? 'completed'
          : successCount > 0
            ? 'completed_with_errors'
            : 'failed';

      job.data.progress = 100;
      job.data.successCount = successCount;
      job.data.failedCount = failedCount;
      job.data.message = `Batch completed: ${successCount} successful, ${failedCount} failed`;
      await job.updateProgress(100);

      // Note: Individual job statuses have already been updated during processing
      // We don't need to bulk update all jobs here since each job was updated individually

      this.messageService.sendMessage(channel, {
        progress: 100,
        message: `Batch completed: ${successCount} successful, ${failedCount} failed`,
        status: statusMessage,
        successCount,
        failedCount,
        totalCount,
      });

      this.loggerService.info(
        `Batch crawl completed: ${successCount} successful, ${failedCount} failed out of ${totalCount} conferences`,
      );
    } catch (e) {
      // Update job status for complete failure
      const errorMessage = `Error while processing batch crawl: ${e.message}`;
      job.data.progress = 100;
      job.data.message = errorMessage;
      await job.updateProgress(100);

      // Update all remaining jobs to failed status in database
      for (const conference of conferences) {
        await this.updateIndividualJobInBatch(
          conference.id,
          ConferenceAttribute.JOB_STATUS_FAILED,
          100,
          errorMessage,
        );
      }

      this.loggerService.error(
        `Error while processing batch crawl: ${e.message}`,
      );
      this.messageService.sendMessage(channel, {
        progress: 100,
        message: errorMessage,
        status: ConferenceAttribute.JOB_STATUS_FAILED,
        successCount,
        failedCount,
        totalCount,
      });
      this.loggerService.error(String(e));

      // Re-throw the error so the job is marked as failed in BullMQ
      throw e;
    }
  }

  handleUpdateConferenceJob(job: Job<ConferenceCrawlJobDTO>) {
    // TODO: Implement update conference job logic
    this.loggerService.info(
      `Update conference job not implemented yet: ${JSON.stringify(job.data)}`,
    );
  }
}
