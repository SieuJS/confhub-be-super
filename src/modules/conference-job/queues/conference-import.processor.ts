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

  async process(job: Job<ConferenceCrawlJobDTO, any, string>) {
    switch (job.name) {
      case CONFERENCE_CRAWL_JOB_NAME.CRAWL:
        await this.handleCrawlConferenceJob(job);
        break;
      case CONFERENCE_CRAWL_JOB_NAME.UPDATE:
        await this.handleUpdateConferenceJob(job);
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
      this.loggerService.error(e);
    }
  }

  async handleUpdateConferenceJob(job: Job<ConferenceCrawlJobDTO>) {
    const jobs = Array.isArray(job.data.jobs) ? job.data.jobs : [job.data];

    for (const jobData of jobs) {
      try {
        // Send message to channel
        this.messageService.sendMessage(`conference-crawl-job-${jobData.id}`, {
          status: 'RUNNING',
          progress: 0,
          message: 'Fetching updated conference data...',
        });

        this.loggerService.info(`Update job data: ${JSON.stringify(jobData)}`);
        this.loggerService.info(
          `Sending update request for conference - Title: ${jobData.conferenceTitle}, Acronym: ${jobData.conferenceAcronym}`,
        );

        // Check if we have any organization data
        const hasOrganizationData =
          jobData.mainLink || jobData.cfpLink || jobData.impLink;

        if (!hasOrganizationData) {
          this.loggerService.info(
            `No organization data found for ${jobData.conferenceTitle}, switching to new crawl`,
          );
          // Switch to new crawl
          const crawlDataResponse =
            await this.conferenceCrawlJobService.fetchConferenceCrawlData({
              items: [
                {
                  Title: jobData.conferenceTitle || '',
                  Acronym: jobData.conferenceAcronym || '',
                },
              ],
              models: {
                determineLinks: 'tuned',
                extractInfo: 'non-tuned',
                extractCfp: 'non-tuned',
              },
              description: 'Crawl conference data',
            });
          console.log(
            `Crawl data response: ${JSON.stringify(crawlDataResponse)}`,
          );
          if (
            !crawlDataResponse ||
            !crawlDataResponse.data ||
            crawlDataResponse.data.length === 0
          ) {
            throw new Error(
              `No data found for conference: ${jobData.conferenceTitle}`,
            );
          }

          const crawlData = crawlDataResponse.data[0];
          // Continue with the rest of the crawl process...
          // Import organization and location data
          const organizeData =
            await this.conferenceOrganizationService.importOrganize({
              year: parseInt(crawlData.year),
              conferenceId: jobData.conferenceId,
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
            throw new Error(
              `Failed to import organization data for conference: ${jobData.conferenceTitle}`,
            );
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
        } else {
          // Fetch updated conference crawl data
          const response =
            await this.conferenceCrawlJobService.fetchUpdateConferenceCrawlData(
              {
                items: [
                  {
                    Title: jobData.conferenceTitle || '',
                    Acronym: jobData.conferenceAcronym || '',
                    ...(jobData.mainLink ? { link: jobData.mainLink } : {}),
                    ...(jobData.cfpLink ? { cfpLink: jobData.cfpLink } : {}),
                    ...(jobData.impLink ? { impLink: jobData.impLink } : {}),
                  },
                ],
                models: {
                  determineLinks: 'non-tuned',
                  extractInfo: 'non-tuned',
                  extractCfp: 'non-tuned',
                },
                description: 'Update conference data',
              },
            );
          console.log(
            `Update request for conference - Title: ${jobData.conferenceTitle}, Acronym: ${jobData.conferenceAcronym}`,
          );
          console.log(
            `Update crawl data response: ${JSON.stringify(response)}`,
          );

          if (!response || !response.data || response.data.length === 0) {
            throw new Error(
              `No data found for conference: ${jobData.conferenceTitle}`,
            );
          }

          const crawlData = response.data[0];
          if (!crawlData.mainLink) {
            throw new Error(
              `No link found for conference: ${jobData.conferenceTitle}`,
            );
          }

          // Import organization and location data
          const organizeData =
            await this.conferenceOrganizationService.importOrganize({
              year: parseInt(crawlData.year),
              conferenceId: jobData.conferenceId,
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
            throw new Error(
              `Failed to import organization data for conference: ${jobData.conferenceTitle}`,
            );
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
        }

        // Send success message
        this.messageService.sendMessage(`conference-crawl-job-${jobData.id}`, {
          status: 'COMPLETED',
          progress: 100,
          message: 'Conference update completed successfully',
        });
      } catch (error) {
        console.error(
          `Error updating conference ${jobData.conferenceTitle}:`,
          error,
        );

        // Send error message
        this.messageService.sendMessage(`conference-crawl-job-${jobData.id}`, {
          status: 'FAILED',
          progress: 0,
          message: `Error: ${error.message}`,
        });
        await this.conferenceOrganizationService.updateLastestOrganizationById(
          jobData.conferenceId,
        );
      }
    }
  }
}
