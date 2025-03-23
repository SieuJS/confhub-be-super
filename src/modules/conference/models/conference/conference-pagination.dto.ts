import { ApiProperty } from "@nestjs/swagger";
import { ConferenceDTO } from "./conference.dto";
import { PaginationDTO } from "../../../common";

export class ConferencePaginationDTO {
    @ApiProperty({description :  "Conference Payload", type : ConferenceDTO, isArray : true}) 
    payload : ConferenceDTO[]

    @ApiProperty({description : "Meta data", type : PaginationDTO})
    meta : PaginationDTO
}