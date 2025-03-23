import { Injectable } from "@nestjs/common";
import { PrismaService } from '../../common'
import { ConferenceAttribute, ConferenceMessageJob } from "../../../constants/conference-attribute";
import { ConferenceCrawlJobInputDTO } from "../models/conference-crawl-job/conference-crawl-job-input.dto";
import { InjectQueue } from "@nestjs/bullmq";
import { CONFERENCE_QUEUE_NAME } from "../../../constants/queue-name";
import { Queue } from "bullmq";
import { CONFERENCE_CRAWL_JOB_NAME } from "../../../constants/job-name";
import { ConferenceCrawlJobDTO } from "../models/conference-crawl-job/conference-crawl-job.dto";
import { HttpService } from "@nestjs/axios";
import { catchError, firstValueFrom } from "rxjs";
import { ConferenceCrawlNewRequestDto } from "../models/crawl-request/conference-crawl-new-request.dto";
import { ConferenceCrawlNewResponseDto } from "../models/crawl-response/conference-crawl-new-reponse.dto";

@Injectable()
export class ConferenceCrawlJobService {
    constructor(
        private prismaService: PrismaService,
        @InjectQueue(CONFERENCE_QUEUE_NAME.CRAWL) 
        private conferenceCrawlQueue : Queue,
        private httpService : HttpService
    ) {}

    async getListConferenceCrawlJob () {
        return this.prismaService.conferenceCrawlJobs.findMany()
    }

    async createConferenceCrawlJob(input : ConferenceCrawlJobInputDTO) : Promise<ConferenceCrawlJobDTO> {

        const jobInstance = await this.prismaService.conferenceCrawlJobs.create({
            data : {
                conferenceId : input.conferenceId,
                status : ConferenceAttribute.JOB_STATUS_PENDING,
                createdAt : new Date(),
                updatedAt : new Date(),
                progress : 0,
                message : ConferenceMessageJob.PENDING
            }
        })

        await this.conferenceCrawlQueue.add(CONFERENCE_CRAWL_JOB_NAME.CRAWL, {
            id : jobInstance.id,
            conferenceId : jobInstance.conferenceId,
            conferenceAcronym : input.conferenceAcronym,
            conferenceTitle : input.conferenceTitle,
            progress : 0,
            status : ConferenceAttribute.JOB_STATUS_PENDING
        })

        return {
            id : jobInstance.id,
            conferenceId : jobInstance.conferenceId,
            conferenceTitle : input.conferenceTitle,
            conferenceAcronym : input.conferenceAcronym,
            status : jobInstance.status as ConferenceAttribute,
            createdAt : jobInstance.createdAt,
            updatedAt : jobInstance.updatedAt,
            progress : jobInstance.progress,
            message : jobInstance.message as ConferenceMessageJob
        }

    }

    async fetchConferenceCrawlData(input : ConferenceCrawlNewRequestDto) : Promise<ConferenceCrawlNewResponseDto> {
        const { data } : {data : ConferenceCrawlNewResponseDto} = await firstValueFrom(
            this.httpService.post("http://localhost:3001/crawl-conferences", 
            [
                {
                    ...input
                }
            ], 
            {
                params: { dataSource: 'client' },
                headers: {
                    'Content-Type': 'application/json'
                }
            }).pipe(
                catchError((error) => {
                    throw error;
                })
            )
        );
        return data
    }

    async updateConferenceCrawlJob (jobId : string, data : Partial<ConferenceCrawlJobInputDTO>) {
        return this.prismaService.conferenceCrawlJobs.update({
            where : {
                id : jobId
            },
            data
        })
    }
}