import { PipeTransform } from '@nestjs/common';
import { AdminConferenceParams } from '../models/admin-conference.dto';

export class AdminConferenceParamsPipe implements PipeTransform {
  transform(value: any): AdminConferenceParams {
    if (typeof value.status === 'string') {
      value.status = value.status.split(',');
    }
    if (typeof value.source === 'string') {
      value.source = value.source.split(',');
    }
    if (typeof value.researchFields === 'string') {
      value.researchFields = value.researchFields.split(',');
    }
    if (typeof value.rank === 'string') {
      value.rank = value.rank.split(',');
    }

    return {
      search: value.search || '',
      status: value.status || [],
      source: value.source || [],
      researchFields: value.researchFields || [],
      ranks: value.rank || [],
    };
  }
}
