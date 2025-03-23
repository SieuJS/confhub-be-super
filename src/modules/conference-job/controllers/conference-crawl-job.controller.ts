import { Controller, Get } from "@nestjs/common";
import { ConferenceCrawlJobService } from "../services";
import { ApiTags } from "@nestjs/swagger";


@ApiTags('conference-crawl-job')
@Controller('conference-crawl-job')
export class ConferenceCrawlJobController {
    constructor(
        private readonly conferenceCrawlJobService: ConferenceCrawlJobService
    ) {
    }

    @Get()
    async findAll() {
        return this.conferenceCrawlJobService.getListConferenceCrawlJob()
    }

    @Get('start')
    async startCrawl() {
        return this.conferenceCrawlJobService.fetchConferenceCrawlData(
            {
                Title: 'AAAI Conference on Human Computation and Crowdsourcing',
                Acronym: 'HCOMP',
            }
        );
    }
}