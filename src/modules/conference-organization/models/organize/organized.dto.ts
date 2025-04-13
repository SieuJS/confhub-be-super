import { ConferenceDateDTO } from "../date/conference-date.dto";
import { LocationDTO } from "../location/location.dto";

export class OrganizedDTO{
    id : string;
    isAvailable : boolean;
    accessType : string
    year : number | null;
    conferenceId : string;
    link : string;
    cfpLink: string;
    impLink : string;
    summerize : string;
    callForPaper : string;
    publisher : string;
    topics : string[];
    conferenceDates : Partial<ConferenceDateDTO>[];
    locations : Partial<LocationDTO>[];
    createdAt : Date;
    updatedAt : Date;
}
