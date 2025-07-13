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

@Injectable()
@Processor(CONFERENCE_QUEUE_NAME.CRAWL)
export class ConferenceImportProcessor extends WorkerHost {
  constructor(
    private loggerService: LoggerService,
    private conferenceCrawlJobService: ConferenceCrawlJobService,
    private conferenceOrganizationService: ConferenceOrganizationSerivce,
    private messageService: MessageService,
  ) {
    super();
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
      this.loggerService.info(`Job data: ${JSON.stringify(job.data)}`);
      this.loggerService.info(
        `Sending crawl request for ${conferences.length} conferences`,
      );

      const crawlDataResponse =
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

      if (
        !crawlDataResponse ||
        !crawlDataResponse.data ||
        crawlDataResponse.data.length === 0
      ) {
        this.loggerService.error(`No data found for any of the conferences`);
        throw new Error(`No data found for any of the conferences`);
      }

      // Process each conference in the response
      for (let i = 0; i < crawlDataResponse.data.length; i++) {
        const crawlData = crawlDataResponse.data[i];
        const conference = conferences[i];

        this.loggerService.info(
          `Processing conference: ${conference.conferenceTitle}`,
        );

        const organizeData =
          await this.conferenceOrganizationService.importOrganize({
            year: parseInt(crawlData.year),
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

        // Import dates
        await this.conferenceOrganizationService.importPlace({
          continent: crawlData.continent,
          country: crawlData.country,
          cityStateProvince: crawlData.cityStateProvince,
          address: crawlData.location,
          organizeId: organizeData.id,
        });

        // Import topics
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
          `Successfully processed conference: ${conference.conferenceTitle}`,
        );
      }

      job.data.progress = 100;
      job.data.message = 'Imported all conference data';
      this.messageService.sendMessage(channel, {
        progress: 100,
        message: 'Imported all conference data',
        status: 'completed',
      });

      this.loggerService.info(
        `Imported data for ${conferences.length} conferences`,
      );
    } catch (e) {
      this.loggerService.error(
        `Error while importing conference data: ${e.message}`,
      );
      this.messageService.sendMessage(channel, {
        progress: 100,
        message: `Error while importing conference data: ${e.message}`,
        status: 'failed',
      });
      this.loggerService.error(String(e));
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

      // Send progress update at start
      job.data.progress = 0;
      job.data.message = `Starting batch crawl for ${totalCount} conferences`;
      this.messageService.sendMessage(channel, {
        progress: 0,
        message: `Starting batch crawl for ${totalCount} conferences`,
        status: 'running',
        successCount,
        failedCount,
        totalCount,
      });

      const crawlDataResponse =
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

      // Process each conference in the response
      for (let i = 0; i < crawlDataResponse.data.length; i++) {
        const crawlData = crawlDataResponse.data[i];
        const conference = conferences[i];

        try {
          this.loggerService.info(
            `Processing conference ${i + 1}/${totalCount}: ${conference.conferenceTitle}`,
          );

          const organizeData =
            await this.conferenceOrganizationService.importOrganize({
              year: parseInt(crawlData.year),
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
            continue;
          }

          // Import place data
          await this.conferenceOrganizationService.importPlace({
            continent: crawlData.continent,
            country: crawlData.country,
            cityStateProvince: crawlData.cityStateProvince,
            address: crawlData.location,
            organizeId: organizeData.id,
          });

          // Import topics
          const createdTopics = await Promise.all(
            crawlData.topics.split(' ').map((topic) => {
              return this.conferenceOrganizationService.importTopic({
                organized: organizeData.id,
                topic: topic,
              });
            }),
          );

          await Promise.all(createdTopics);
          successCount++;

          // Send progress update
          const progress = Math.round(((i + 1) / totalCount) * 100);
          job.data.progress = progress;
          job.data.successCount = successCount;
          job.data.failedCount = failedCount;
          job.data.message = `Processed ${i + 1}/${totalCount} conferences`;

          this.messageService.sendMessage(channel, {
            progress,
            message: `Processed ${i + 1}/${totalCount} conferences`,
            status: 'running',
            successCount,
            failedCount,
            totalCount,
          });

          this.loggerService.info(
            `Successfully processed conference ${i + 1}/${totalCount}: ${conference.conferenceTitle}`,
          );
        } catch (conferenceError) {
          failedCount++;
          this.loggerService.error(
            `Error processing conference ${conference.conferenceTitle}: ${conferenceError.message}`,
          );
          // Continue processing other conferences even if one fails
        }
      }

      // Final status update
      job.data.progress = 100;
      job.data.successCount = successCount;
      job.data.failedCount = failedCount;
      job.data.message = `Batch completed: ${successCount} successful, ${failedCount} failed`;

      this.messageService.sendMessage(channel, {
        progress: 100,
        message: `Batch completed: ${successCount} successful, ${failedCount} failed`,
        status: failedCount === 0 ? 'completed' : 'completed_with_errors',
        successCount,
        failedCount,
        totalCount,
      });

      this.loggerService.info(
        `Batch crawl completed: ${successCount} successful, ${failedCount} failed out of ${totalCount} conferences`,
      );
    } catch (e) {
      this.loggerService.error(
        `Error while processing batch crawl: ${e.message}`,
      );
      this.messageService.sendMessage(channel, {
        progress: 100,
        message: `Error while processing batch crawl: ${e.message}`,
        status: 'failed',
        successCount,
        failedCount,
        totalCount,
      });
      this.loggerService.error(String(e));
    }
  }

  handleUpdateConferenceJob(job: Job<ConferenceCrawlJobDTO>) {
    // TODO: Implement update conference job logic
    this.loggerService.info(
      `Update conference job not implemented yet: ${JSON.stringify(job.data)}`,
    );
  }
}
