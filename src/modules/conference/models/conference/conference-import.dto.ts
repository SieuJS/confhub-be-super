import { ApiProperty, PickType } from "@nestjs/swagger";
import { ConferenceDTO } from "./conference.dto";

export class ConferenceImportDTO extends PickType(ConferenceDTO, [
    'id',
    'title',
    'acronym',
    'source' , 
    'rank',
    'year',
    'creatorId',
]) {
    @ApiProperty({
        description : "The field of research codes",
        isArray : true
    })
    fieldOfResearchCodes : string[]
}