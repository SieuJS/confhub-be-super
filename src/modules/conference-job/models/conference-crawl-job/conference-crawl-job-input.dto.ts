import {  PickType } from "@nestjs/swagger";
import { ConferenceCrawlJobDTO } from "./conference-crawl-job.dto";

export class ConferenceCrawlJobInputDTO extends PickType(ConferenceCrawlJobDTO, [
    'conferenceId',
    'conferenceTitle' , 
    'conferenceAcronym',
    'status',
    'progress',
    'message',
]) {
    
}