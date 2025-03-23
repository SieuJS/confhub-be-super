import { Processor, WorkerHost } from "@nestjs/bullmq";
import { LoggerService } from "../../common";
import { Job } from "bullmq";
import { Injectable } from "@nestjs/common";
import { CONFERENCE_QUEUE_NAME } from "../../../constants/queue-name";
import { CONFERENCE_CRAWL_JOB_NAME } from "../../../constants/job-name";
import { ConferenceCrawlJobService } from "../services";
import { ConferenceOrganizationSerivce } from "../../conference-organization";
import { converStringToDate, convertObjectToDate} from "../utils/date-parse";
import { MessageService } from "../../socket-gateway/services/message.service";
import { ConferenceCrawlJobDTO } from "../models/conference-crawl-job/conference-crawl-job.dto";
import { ConferenceAttribute } from "../../../constants/conference-attribute";
@Injectable()
@Processor(CONFERENCE_QUEUE_NAME.CRAWL)
export class ConferenceImportProcessor extends WorkerHost {
    constructor(
        private loggerService: LoggerService,
        private conferenceCrawlJobService: ConferenceCrawlJobService,
        private conferenceOrganizationService: ConferenceOrganizationSerivce,
        private messageService: MessageService
    ) {
        super();
    }

    async process(
        job: Job<ConferenceCrawlJobDTO, any, string>,
        token: string
    ) {
        switch (job.name) {
            case CONFERENCE_CRAWL_JOB_NAME.CRAWL:
                this.handleCrawlConferenceJob(job);
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

    async handleCrawlConferenceJob(
        job: Job<ConferenceCrawlJobDTO, any, string>
    ) {
        job.data.progress = 20;
        job.data.message = "Crawling conference data";
        const channel = "cfp-crawl-"+job.data.id;
        try {
            await this.messageService.sendMessage(channel, {progress : 20, message : "Crawling conference data", status : "processing"});
            await job.updateProgress(20);

            const crawlDataResponse =
                await this.conferenceCrawlJobService.fetchConferenceCrawlData({
                    Title: job.data.conferenceTitle,
                    Acronym: job.data.conferenceAcronym,
                });

            if (crawlDataResponse.data.length === 0) {
                this.loggerService.error(
                    `No data found for ${job.data.conferenceTitle}`
                );
                throw new Error(
                    `No data found for ${job.data.conferenceTitle}`
                );
            }

            job.data.progress = 40;
            job.data.message = "Crawl data success, importing data";
            this.messageService.sendMessage(channel, {progress : 40, message : "Crawl data success, importing data" , status : "processing"});
            await job.updateProgress(40);

            const crawlData = crawlDataResponse.data[0];

            if(!crawlData.link) {
                this.messageService.sendMessage(channel, {progress : 100, message : "No link found for "+job.data.conferenceTitle, status : "failed"});
                await job.updateProgress(100);
                await this.conferenceCrawlJobService.updateConferenceCrawlJob(job.data.id , {
                    status : ConferenceAttribute.JOB_STATUS_FAILED,
                    progress : 100,
                    message : "No link found for "+job.data.conferenceTitle
                });
                this.loggerService.error(
                    `No link found for ${job.data.conferenceTitle}`
                );
                throw new Error(
                    `No link found for ${job.data.conferenceTitle}`
                );
            }

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
                    topics: crawlData.topics.split(","),
                    isAvailable: true,
                    publisher : crawlData.publisher
                });
            if(!organizeData) {
                this.messageService.sendMessage(channel, {progress : 100, message : "No link found for "+job.data.conferenceTitle, status : "failed"});
                await job.updateProgress(100);
                await this.conferenceCrawlJobService.updateConferenceCrawlJob(job.data.id , {
                    status : ConferenceAttribute.JOB_STATUS_FAILED,
                    progress : 100,
                    message : "No link found for "+job.data.conferenceTitle
                });
                this.loggerService.error(
                    `No link found for ${job.data.conferenceTitle}`
                );
                throw new Error(
                    `No link found for ${job.data.conferenceTitle}`
                );
            }
            job.data.progress = 60;
            job.data.message =
                "Imported conference data, importing location data";
            this.messageService.sendMessage(channel, {progress : 60, message : "Imported conference data, importing location data"  , status : "processing"});
            await job.updateProgress(60);

            const locationData =
                await this.conferenceOrganizationService.importPlace({
                    continent: crawlData.continent,
                    country: crawlData.country,
                    cityStateProvince: crawlData.cityStateProvince,
                    address: crawlData.location,
                    organizeId: organizeData.id,
                });

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
                "conferenceDates",
                organizeData.id
            );

            const submissionDateInput = convertObjectToDate(
                submissionDate,
                "submissionDate",
                organizeData.id
            );
            const cameraReadyDateInput = convertObjectToDate(
                cameraReadyDate,
                "cameraReadyDate",
                organizeData.id
            );
            const registrationDateInput = convertObjectToDate(
                registrationDate,
                "registrationDate",
                organizeData.id
            );
            const notificationDateInput = convertObjectToDate(
                notificationDate,
                "notificationDate",
                organizeData.id
            );
            const otherDateInput = convertObjectToDate(
                otherDate,
                "otherDate",
                organizeData.id
            );

            const dateInput = [
                ...conferenceDateInput,
                ...submissionDateInput,
                ...cameraReadyDateInput,
                ...registrationDateInput,
                ...notificationDateInput,
                ...otherDateInput,
            ];

            for (const date of dateInput) {
                await this.conferenceOrganizationService.importDate(date);
            }

            job.data.progress = 100;
            job.data.message = "Imported conference data";
            this.messageService.sendMessage(channel, {progress : 100, message : "Imported conference data", status : "completed"});
            await job.updateProgress(100);

            await this.conferenceCrawlJobService.updateConferenceCrawlJob(job.data.id , {
                status : ConferenceAttribute.JOB_STATUS_COMPLETED,
                progress : 100,
                message : "Imported conference data"
            });

            this.loggerService.info(
                `Imported conference data ${job.data.conferenceTitle}`
            );
        } catch (e) {
            this.loggerService.error(
                `Error while importing conference data ${job.data.conferenceTitle}`
            );
            await this.conferenceCrawlJobService.updateConferenceCrawlJob(job.data.id , {
                status : ConferenceAttribute.JOB_STATUS_FAILED,
                progress : 100,
                message : "Error while importing conference data "+job.data.conferenceTitle
            });
            await job.updateProgress(100);
            this.messageService.sendMessage(channel, {progress : 100, message : "Error while importing conference data "+job.data.conferenceTitle, status : "failed"});
            this.loggerService.error(e);
        }
    }
}

