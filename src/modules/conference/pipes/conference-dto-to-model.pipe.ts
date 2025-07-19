import { PipeTransform, Injectable } from '@nestjs/common';
import { Conferences } from '../../../../generated/prisma_client';
import { ConferenceDTO } from '../models/conference/conference.dto';
@Injectable()
export class ConferenceDtoToModelPipe
  implements PipeTransform<ConferenceDTO, Conferences>
{
  transform(value: ConferenceDTO): Conferences {
    const conference: Conferences = {
      id: value.id,
      title: value.title,
      acronym: value.acronym,
      creatorId: value.creatorId,
      adminId: value.adminId || null,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return conference;
  }
}
