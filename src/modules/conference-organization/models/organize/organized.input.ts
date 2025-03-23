import { PickType } from "@nestjs/swagger";
import { OrganizedDTO } from "./organized.dto";

export class OrganizedInput extends PickType(OrganizedDTO, 
    ['isAvailable', 'accessType', 'year', 'conferenceId', 'link', 'cfpLink', 'impLink','summerize', 'callForPaper', 'topics', 'publisher']) {}