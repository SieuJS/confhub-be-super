import { PipeTransform } from "@nestjs/common";
import { AdminConferenceParams } from "../models/admin-conference.dto";


export class AdminConferenceParamsPipe implements PipeTransform {
    transform(value: any): AdminConferenceParams {

        if (typeof value.status === 'string') {
            value.status = [value.status];
        }
        if (typeof value.source === 'string') {
            value.source = [value.source];
        }
        if (typeof value.researchField === 'string') {
            value.researchField = [value.researchField];
        }
        if (typeof value.rank === 'string') {
            value.rank = [value.rank];
        }

        return {
            search: value.search || '',
            status: value.status || [],
            source: value.source || [],
            researchFields: value.researchField || [],
            ranks: value.rank || [],
        };
    }
}