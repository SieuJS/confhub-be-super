import { ApiProperty, PickType } from "@nestjs/swagger";
import { ConferenceDTO } from "./conference.dto";
import { OrganizedDTO } from "src/modules/conference-organization/models/organize/organized.dto";
import { ConferenceDatesDTO } from "../conference-organization/conference-dates.dto";
import { LocationDTO } from "src/modules/conference-organization/models/location/location.dto";
import { ConferenceFollowByDTO } from "../conference-follow/conference-follow-by.dto";
import { ConferenceRankDTO } from "../conference-rank/conference-rank.dto";
import { ConferenceFeedBackDTO } from "../conference-feedback/conference-feedback.dto";

export class ConferenceInfoDTO extends PickType(ConferenceDTO , [
    'id' ,
    'acronym' ,
    'title',
    'creatorId',
    'createdAt',
    'updatedAt'
]){
    @ApiProperty({description :"Creator name"})
    creatorName : string 
}



export class ConferenceDetailDTO {
    @ApiProperty({description : "Conference information"})
    conference : ConferenceInfoDTO

    @ApiProperty({description : "Organization information"})
    organization : OrganizedDTO | null

    @ApiProperty({description : "Location information"})
    location : LocationDTO | null
 
    @ApiProperty({description : "Rank information"})
    ranks : ConferenceRankDTO[] | null

    @ApiProperty({description : "Important dates"})
    dates : ConferenceDatesDTO[] | null

    @ApiProperty({description : "Feedbacks"})
    feedbacks : ConferenceFeedBackDTO[] | null

    @ApiProperty({description : "Followed by" , type : ConferenceFollowByDTO , isArray : true})
    followBy : ConferenceFollowByDTO[] | null

}