/* eslint-disable @typescript-eslint/no-floating-promises */
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
import { converStringToDate, convertObjectToDate } from '../utils/date-parse';
import { MessageService } from '../../socket-gateway/services/message.service';
import { ConferenceCrawlJobDTO } from '../models/conference-crawl-job/conference-crawl-job.dto';
import { ConferenceAttribute } from '../../../constants/conference-attribute';
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

  async process(job: Job<ConferenceCrawlJobDTO, any, string>, token: string) {
    switch (job.name) {
      case CONFERENCE_CRAWL_JOB_NAME.CRAWL:
        this.handleCrawlConferenceJob(job);
        break;
      case CONFERENCE_CRAWL_JOB_NAME.UPDATE:
        this.handleUpdateConferenceJob(job);
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

  async handleCrawlConferenceJob(job: Job<ConferenceCrawlJobDTO, any, string>) {
    job.data.progress = 20;
    job.data.message = 'Crawling conference data';
    const channel = 'cfp-crawl-' + job.data.id;
    try {
      await this.messageService.sendMessage(channel, {
        progress: 20,
        message: 'Crawling conference data',
        status: 'processing',
      });
      await job.updateProgress(20);

      const crawlDataResponse =
        await this.conferenceCrawlJobService.fetchConferenceCrawlData({
          Title: job.data.conferenceTitle,
          Acronym: job.data.conferenceAcronym,
        });
      console.log('response', crawlDataResponse);
      if (crawlDataResponse.data.length === 0) {
        this.loggerService.error(
          `No data found for ${job.data.conferenceTitle}`,
        );
        throw new Error(`No data found for ${job.data.conferenceTitle}`);
      }

      job.data.progress = 40;
      job.data.message = 'Crawl data success, importing data';
      this.messageService.sendMessage(channel, {
        progress: 40,
        message: 'Crawl data success, importing data',
        status: 'processing',
      });
      await job.updateProgress(40);

      const crawlData = crawlDataResponse.data[0];

      const organizeData =
        await this.conferenceOrganizationService.importOrganize({
          year: parseInt(crawlData.year),
          accessType: crawlData.type,
          link: crawlData.link,
          impLink: crawlData.impLink,
          cfpLink: crawlData.cfpLink,
          summerize: crawlData.summary,
          callForPaper: crawlData.callForPapers,
          conferenceId: job.data.conferenceId,
          isAvailable: true,
          publisher: crawlData.publisher,
        });
      if (!organizeData) {
        this.messageService.sendMessage(channel, {
          progress: 100,
          message: 'No link found for ' + job.data.conferenceTitle,
          status: 'failed',
        });
        await job.updateProgress(100);
        await this.conferenceCrawlJobService.updateConferenceCrawlJob(
          job.data.id,
          {
            status: ConferenceAttribute.JOB_STATUS_FAILED,
            progress: 100,
            message: 'No link found for ' + job.data.conferenceTitle,
          },
        );
        this.loggerService.error(
          `No link found for ${job.data.conferenceTitle}`,
        );
        throw new Error(`No link found for ${job.data.conferenceTitle}`);
      }
      job.data.progress = 60;
      job.data.message = 'Imported conference data, importing location data';
      this.messageService.sendMessage(channel, {
        progress: 60,
        message: 'Imported conference data, importing location data',
        status: 'processing',
      });
      await job.updateProgress(60);

      const locationData = await this.conferenceOrganizationService.importPlace(
        {
          continent: crawlData.continent,
          country: crawlData.country,
          cityStateProvince: crawlData.cityStateProvince,
          address: crawlData.location,
          organizeId: organizeData.id,
        },
      );

      const {
        submissionDate,
        cameraReadyDate,
        conferenceDates,
        registrationDate,
        notificationDate,
        otherDate,
      } = crawlData;

      const conferenceDateInput = converStringToDate(
        conferenceDates,
        'conferenceDates',
        organizeData.id,
      );

      const submissionDateInput = convertObjectToDate(
        submissionDate,
        'submissionDate',
        organizeData.id,
      );
      const cameraReadyDateInput = convertObjectToDate(
        cameraReadyDate,
        'cameraReadyDate',
        organizeData.id,
      );
      const registrationDateInput = convertObjectToDate(
        registrationDate,
        'registrationDate',
        organizeData.id,
      );
      const notificationDateInput = convertObjectToDate(
        notificationDate,
        'notificationDate',
        organizeData.id,
      );
      const otherDateInput = convertObjectToDate(
        otherDate,
        'otherDate',
        organizeData.id,
      );

      const dateInput = [
        conferenceDateInput,
        ...submissionDateInput,
        ...cameraReadyDateInput,
        ...registrationDateInput,
        ...notificationDateInput,
        ...otherDateInput,
      ];

      for (const date of dateInput) {
        await this.conferenceOrganizationService.importDate(date);
      }

      const createdTopics = await Promise.all(
        crawlData.topics.split(' ').map((topic) => {
          return this.conferenceOrganizationService.importTopic({
            organized: organizeData.id,
            topic: topic,
          });
        }),
      );

      const t = Promise.all(createdTopics);

      job.data.progress = 100;
      job.data.message = 'Imported conference data';
      this.messageService.sendMessage(channel, {
        progress: 100,
        message: 'Imported conference data',
        status: 'completed',
      });
      await job.updateProgress(100);

      await this.conferenceCrawlJobService.updateConferenceCrawlJob(
        job.data.id,
        {
          status: ConferenceAttribute.JOB_STATUS_COMPLETED,
          progress: 100,
          message: 'Imported conference data',
        },
      );

      this.loggerService.info(
        `Imported conference data ${job.data.conferenceTitle}`,
      );
    } catch (e) {
      this.loggerService.error(
        `Error while importing conference data ${job.data.conferenceTitle}`,
      );
      await this.conferenceCrawlJobService.updateConferenceCrawlJob(
        job.data.id,
        {
          status: ConferenceAttribute.JOB_STATUS_FAILED,
          progress: 100,
          message:
            'Error while importing conference data ' + job.data.conferenceTitle,
        },
      );
      await job.updateProgress(100);
      this.messageService.sendMessage(channel, {
        progress: 100,
        message:
          'Error while importing conference data ' + job.data.conferenceTitle,
        status: 'failed',
      });
      this.loggerService.error(e);
    }
  }

  async handleUpdateConferenceJob(job: Job<ConferenceCrawlJobDTO>) {
    const jobs = Array.isArray(job.data) ? job.data : [job.data];

    for (const jobData of jobs) {
      try {
        // Update job progress and message
        await this.conferenceCrawlJobService.updateConferenceCrawlJob(
          jobData.id,
          {
            status: ConferenceAttribute.JOB_STATUS_RUNNING,
            progress: 0,
            message: 'Fetching updated conference data...',
          },
        );

        // Send message to channel
        await this.messageService.sendMessage(
          `conference-crawl-job-${jobData.id}`,
          {
            status: 'RUNNING',
            progress: 0,
            message: 'Fetching updated conference data...',
          },
        );

        // Fetch updated conference crawl data
        const response =
          await this.conferenceCrawlJobService.fetchUpdateConferenceCrawlData({
            Title: jobData.conferenceTitle,
            Acronym: jobData.conferenceAcronym,
            mainLink: jobData.mainLink,
            cfpLink: jobData.cfpLink,
            impLink: jobData.impLink,
          });

        console.log('Crawl data response:', response);

        if (!response || !response.data || response.data.length === 0) {
          throw new Error(
            `No data found for conference: ${jobData.conferenceTitle}`,
          );
        }

        const crawlData = response.data[0];
        if (!crawlData.link) {
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
            link: crawlData.link,
            cfpLink: crawlData.cfpLink,
            impLink: crawlData.impLink,
            summerize: crawlData.summary,
            callForPaper: crawlData.callForPapers,
            publisher: crawlData.publisher,
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

        // Send success message
        await this.messageService.sendMessage(
          `conference-crawl-job-${jobData.id}`,
          {
            status: 'COMPLETED',
            progress: 100,
            message: 'Conference update completed successfully',
          },
        );

        // Update job status
        await this.conferenceCrawlJobService.updateConferenceCrawlJob(
          jobData.id,
          {
            status: ConferenceAttribute.JOB_STATUS_COMPLETED,
            progress: 100,
            message: 'Conference update completed successfully',
          },
        );
      } catch (error) {
        console.error(
          `Error updating conference ${jobData.conferenceTitle}:`,
          error,
        );

        // Send error message
        await this.messageService.sendMessage(
          `conference-crawl-job-${jobData.id}`,
          {
            status: 'FAILED',
            progress: 0,
            message: `Error: ${error.message}`,
          },
        );

        // Update job status
        await this.conferenceCrawlJobService.updateConferenceCrawlJob(
          jobData.id,
          {
            status: ConferenceAttribute.JOB_STATUS_FAILED,
            progress: 0,
            message: `Error: ${error.message}`,
          },
        );
      }
    }
  }
}
