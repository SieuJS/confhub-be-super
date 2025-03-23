import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import { ConferenceAttribute } from "../../../../constants/conference-attribute";

export class ConferenceCrawlJobDTO {
    @ApiProperty({description : 'Id of conference crawl job' , example : '123e4567-e89b-12d3-a456-426614174000'})
    id: string;

    @ApiProperty({
        description : "Id of conferencen" , 
        example : "123e4567-e89b-12d3-a456-426614174000"
    })
    conferenceId : string;

    @ApiProperty({
        description : "Title of conferene crawl job",
        example : "Conference crawl job 1"
    })
    conferenceTitle : string;

    @ApiProperty({
        description : "Acronym of conference crawl job",
        example : "CCJ1"
    })
    conferenceAcronym : string;

    @ApiProperty({
        description : "Status of conference crawl job",
        example : "PENDING"
    })
    @IsIn([
        ConferenceAttribute.JOB_STATUS_PENDING, ConferenceAttribute.JOB_STATUS_RUNNING, ConferenceAttribute.JOB_STATUS_COMPLETED,
        ConferenceAttribute.JOB_STATUS_FAILED, ConferenceAttribute.JOB_STATUS_CANCELLED
    ])
    status : ConferenceAttribute.JOB_STATUS_PENDING | ConferenceAttribute.JOB_STATUS_RUNNING | ConferenceAttribute.JOB_STATUS_COMPLETED | ConferenceAttribute.JOB_STATUS_FAILED | ConferenceAttribute.JOB_STATUS_CANCELLED; 

    @ApiProperty({
        description : "Progress", 
        example : 10
    })
    progress : number;

    @ApiProperty({
        description : "Error message",
        example : "Error message"
    })
    message : string;

    @ApiProperty({
        description : "created at",
        example : "2021-01-01T00:00:00.000Z"
    })
    createdAt: Date

    @ApiProperty({
        description : "updated at",
        example : "2021-01-01T00:00:00.000Z"
    })
    updatedAt: Date
    
}