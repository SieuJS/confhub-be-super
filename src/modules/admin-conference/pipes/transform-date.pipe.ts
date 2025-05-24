import { PipeTransform, Injectable } from '@nestjs/common';
import {
  ConferenceDateDTO,
  ConferenceHistoryDto,
  ConferenceLocationDTO,
} from '../models/admin-conference.dto';
import parser from 'any-date-parser';

@Injectable()
export class TransformDatePipe implements PipeTransform {
  transform(value: unknown): ConferenceHistoryDto {
    if (!value || typeof value !== 'object') {
      return value as ConferenceHistoryDto;
    }

    const data = value as Record<string, unknown>;
    const transformed: ConferenceHistoryDto = {
      id: data.id as string,
      conferenceId: data.conferenceId as string,
      year: data.year as number,
      accessType: data.accessType as string,
      isAvailable: data.isAvailable as boolean,
      publisher: data.publisher as string,
      summerize: data.summerize as string,
      callForPaper: data.callForPaper as string,
      link: data.link as string,
      cfpLink: data.cfpLink as string,
      impLink: data.impLink as string,
      locations: (data.locations as ConferenceLocationDTO[]) || [],
      topics: (data.topics as string[]) || [],
      dates: this.transformDates(data.dates as ConferenceDateDTO[]),
    };

    return transformed;
  }

  private transformDates(dates: ConferenceDateDTO[]): ConferenceDateDTO[] {
    if (!Array.isArray(dates)) return [];

    return dates.map((date) => {
      const transformed: ConferenceDateDTO = {
        type: date.type || '',
        startDate: new Date(),
        endDate: new Date(),
        name: date.name || '',
      };

      // Transform startDate if it exists
      if (date.startDate) {
        try {
          const parsedDate = parser.fromString(
            date.startDate as unknown as string,
          );
          if (parsedDate) {
            transformed.startDate = parsedDate;
          }
        } catch {
          console.warn('Failed to parse startDate:', date.startDate);
        }
      }

      // Transform endDate if it exists
      if (date.endDate) {
        try {
          const parsedDate = parser.fromString(
            date.endDate as unknown as string,
          );
          if (parsedDate) {
            transformed.endDate = parsedDate;
          }
        } catch {
          console.warn('Failed to parse endDate:', date.endDate);
        }
      }

      return transformed;
    });
  }
}
