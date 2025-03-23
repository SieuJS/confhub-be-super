
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, Length } from 'class-validator';
import { ConferenceDatesDTO } from '../conference-organization/conference-dates.dto';
import { ConferenceLocation } from '../conference-organization/conference-location';

export class ConferenceDTO {
    @ApiProperty({description : 'Id of conference' , example : '123e4567-e89b-12d3-a456-426614174000'})
    @IsUUID()
    id: string;

    @ApiProperty({description : 'Name of conference' , example : 'Conference 1'})
    @Length(1, 255)
    title: string;

    @ApiProperty({description : 'Acronym  of conference' , example : 'C1'})
    @Length(1, 255)
    acronym: string;

    @ApiProperty({description : "Location of conference" , example : 'Paris'})
    @Length(1, 255)
    location: ConferenceLocation

    @ApiProperty({description : 'Rank of conference', example : 'A*'})
    rank: string

    @ApiProperty({description : 'Source of conference', example : 'CORE'})
    source: string

    @ApiProperty({description : 'Year of conference', example : '2021'})
    year: number

    @ApiProperty({description : 'Field of conference', example : ['4601', '4602'] , isArray : true})
    researchFields: string[]

    @ApiProperty({description : 'Topics of conference', example : 'Artificial Intelligence'})
    topics: string[]

    @ApiProperty({description : 'Conference dates',type : ConferenceDatesDTO})
    dates: ConferenceDatesDTO | undefined

    @ApiProperty({description : 'Conference link', example : 'https://www.conference.com'})
    link: string

    @ApiProperty({description : 'Created at', example : '2021-01-01T00:00:00.000Z'})
    createdAt: Date

    @ApiProperty({description : 'Updated at', example : '2021-01-01T00:00:00.000Z'})
    updatedAt: Date

    @ApiProperty({description : "Id of user who created the conference", example : '123e4567-e89b-12d3-a456-426614174000'})
    @IsUUID()
    creatorId: string

    @ApiProperty({
        description : "Type of conference",
        example : "hybrid"
    })
    accessType : string;

    @ApiProperty({
        description : "Status of conference",
        example : "pending"
    })
    status : string;

}
