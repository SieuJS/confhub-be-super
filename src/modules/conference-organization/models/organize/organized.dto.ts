import { ConferenceDateDTO } from "../date/conference-date.dto";
import { LocationDTO } from "../location/location.dto";

export class OrganizedDTO{
    id : string;
    isAvailable : boolean;
    accessType : string
    year : number;
    conferenceId : string;
    link : string;
    cfpLink: string;
    impLink : string;
    summerize : string;
    callForPaper : string;
    publisher : string;
    topics : string[];
}
