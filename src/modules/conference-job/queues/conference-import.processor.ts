/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { ConferenceCrawlJobDTO, ConferenceCrawlJobQueueDTO } from '../models/conference-crawl-job/conference-crawl-job.dto';
import { ConferenceCrawlJobType, ConferenceCrawlJobStatus } from '../models/conference-crawl-job/conference-crawl-job.enum';
import { CONFERENCE_QUEUE_NAME } from '../constants/conference-queue-name';
import { ConferenceCrawlJobService } from '../services/conference-crawl-job.service';
import { ConferenceOrganizationService } from '../services/conference-organization.service';
import { MessageService } from '../../socket-gateway/services/message.service';
import { LoggerService } from '../../logger/services/logger.service';
import { converStringToDate, convertObjectToDate } from '../utils/date-parse';
import { WorkerHost } from '@nestjs/bullmq';
import { CONFERENCE_CRAWL_JOB_NAME } from '../../../constants/job-name';
@Injectable()
@Processor(CONFERENCE_QUEUE_NAME.CRAWL)
export class ConferenceImportProcessor extends WorkerHost {
  constructor(
    private readonly conferenceCrawlJobService: ConferenceCrawlJobService,
    private readonly conferenceOrganizationService: ConferenceOrganizationService,
    private readonly messageService: MessageService,
    private readonly loggerService: LoggerService,
  ) {
    super();
  }

  @Process('conference-crawl')
  async process(job: Job<ConferenceCrawlJobDTO | ConferenceCrawlJobQueueDTO>) {
    const queueData = job.data as ConferenceCrawlJobQueueDTO;
    const jobData = queueData.jobs?.[0] || job.data as ConferenceCrawlJobDTO;

    switch (jobData.type) {
      case ConferenceCrawlJobType.CRAWL:
        await this.handleCrawlConferenceJob(job);
        break;
      case ConferenceCrawlJobType.UPDATE:
        await this.handleUpdateConferenceJob(job);
        break;
      case ConferenceCrawlJobType.NOTIFY:
        await this.handleNotifyConferenceJob(job);
        break;
      default:
        throw new Error(`Unknown job type: ${jobData.type}`);
    }
  }

  async handleCrawlConferenceJob(job: Job<ConferenceCrawlJobDTO | ConferenceCrawlJobQueueDTO>) {
    const queueData = job.data as ConferenceCrawlJobQueueDTO;
    const jobData = queueData.jobs?.[0] || job.data as ConferenceCrawlJobDTO;
    
    const channel = 'cfp-crawl-' + jobData.id;
    try {
      await this.messageService.sendMessage(channel, {
        progress: 20,
        message: 'Crawling conference data',
        status: ConferenceCrawlJobStatus.RUNNING,
      });
      await job.updateProgress(20);

      const crawlDataResponse =
        await this.conferenceCrawlJobService.fetchConferenceCrawlData({
          Title: jobData.conferenceTitle,
          Acronym: jobData.conferenceAcronym,
        });
      console.log('response', crawlDataResponse);
      if (crawlDataResponse.data.length === 0) {
        this.loggerService.error(
          `No data found for ${jobData.conferenceTitle}`,
        );
        throw new Error(`No data found for ${jobData.conferenceTitle}`);
      }

      this.messageService.sendMessage(channel, {
        progress: 40,
        message: 'Crawl data success, importing data',
        status: ConferenceCrawlJobStatus.RUNNING,
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
          conferenceId: jobData.conferenceId,
          isAvailable: true,
          publisher: crawlData.publisher,
        });
      if (!organizeData) {
        this.messageService.sendMessage(channel, {
          progress: 100,
          message: 'No link found for ' + jobData.conferenceTitle,
          status: ConferenceCrawlJobStatus.FAILED,
        });
        await job.updateProgress(100);
        this.loggerService.error(
          `No link found for ${jobData.conferenceTitle}`,
        );
        throw new Error(`No link found for ${jobData.conferenceTitle}`);
      }

      this.messageService.sendMessage(channel, {
        progress: 60,
        message: 'Imported conference data, importing location data',
        status: ConferenceCrawlJobStatus.RUNNING,
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

      await Promise.all(createdTopics);

      this.messageService.sendMessage(channel, {
        progress: 100,
        message: 'Imported conference data',
        status: ConferenceCrawlJobStatus.COMPLETED,
      });
      await job.updateProgress(100);

      this.loggerService.info(
        `Imported conference data ${jobData.conferenceTitle}`,
      );
    } catch (error) {
      this.loggerService.error(
        `Error while importing conference data ${jobData.conferenceTitle}`,
      );
      await job.updateProgress(100);
      this.messageService.sendMessage(channel, {
        progress: 100,
        message:
          'Error while importing conference data ' + jobData.conferenceTitle,
        status: ConferenceCrawlJobStatus.FAILED,
      });
      this.loggerService.error(error);
    }
  }

  async handleUpdateConferenceJob(job: Job<ConferenceCrawlJobDTO | ConferenceCrawlJobQueueDTO>) {
    const queueData = job.data as ConferenceCrawlJobQueueDTO;
    const jobs = queueData.jobs || [job.data as ConferenceCrawlJobDTO];

    for (const jobData of jobs) {
      try {
        const jobId = jobData.jobId || jobData.id;
        if (!jobId) {
          console.error('Job ID is missing in job data:', jobData);
          continue;
        }

        // Send message to channel
        await this.messageService.sendMessage(
          `conference-crawl-job-${jobId}`,
          {
            status: ConferenceCrawlJobStatus.RUNNING,
            progress: 0,
            message: 'Fetching updated conference data...',
          },
        );

        // Fetch updated conference crawl data
        const response =
          await this.conferenceCrawlJobService.fetchUpdateConferenceCrawlData({
            Title: jobData.conferenceTitle,
            Acronym: jobData.conferenceAcronym,
            mainLink: jobData.mainLink || '',
            cfpLink: jobData.cfpLink || '',
            impLink: jobData.impLink || '',
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
          `conference-crawl-job-${jobId}`,
          {
            status: ConferenceCrawlJobStatus.COMPLETED,
            progress: 100,
            message: 'Conference update completed successfully',
          },
        );
      } catch (error) {
        console.error(
          `Error updating conference ${jobData.conferenceTitle}:`,
          error,
        );

        const jobId = jobData.jobId || jobData.id;
        if (!jobId) {
          console.error('Job ID is missing in job data:', jobData);
          continue;
        }

        // Send error message
        await this.messageService.sendMessage(
          `conference-crawl-job-${jobId}`,
          {
            status: ConferenceCrawlJobStatus.FAILED,
            progress: 0,
            message: `Error: ${error.message}`,
          },
        );
      }
    }
  }

  async handleNotifyConferenceJob(job: Job<ConferenceCrawlJobDTO | ConferenceCrawlJobQueueDTO>) {
    this.loggerService.info(`Notifying conference import`);
  }
}
