import { PipeTransform, Injectable } from '@nestjs/common';
import { Conferences } from '@prisma/client';
import { ConferenceDTO } from '../models/conference/conference.dto';
import { ConferenceFilter } from '../models/conference-filter/conference.filter';
import parser from 'any-date-parser';
@Injectable()
export class ConferenceDtoToModelPipe implements PipeTransform<ConferenceDTO, Conferences> {
    transform(value: ConferenceDTO): Conferences {
        const conference : Conferences = {
            id : value.id,
            title : value.title,
            acronym : value.acronym,
            creatorId : value.creatorId,
            status : 'pending',
            createdAt : new Date(),
            updatedAt : new Date(),
        
        }
        return conference;
    }
}
