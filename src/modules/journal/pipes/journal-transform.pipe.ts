import { PipeTransform, Injectable } from '@nestjs/common';
import { JournalImportDto } from '../models/journal-import.dto';

@Injectable()
export class JournalTransformPipe implements PipeTransform {
  transform(value: JournalImportDto[]) {
    return value.map((journal) => {
      // Transform numeric fields
      const numericFields = {
        SJR: parseFloat,
        Overton: parseFloat,
        SDG: parseFloat,
        'H index': parseFloat,
        'Total Docs. (2023)': parseFloat,
        'Total Docs. (3years)': parseFloat,
        'Total Refs.': parseFloat,
        'Total Cites (3years)': parseFloat,
        'Citable Docs. (3years)': parseFloat,
        'Cites / Doc. (2years)': parseFloat,
        'Ref. / Doc.': parseFloat,
        '%Female': parseFloat,
      };

      // Transform each numeric field if it exists and is a string
      Object.entries(numericFields).forEach(([field, transformFn]) => {
        if (journal[field] && typeof journal[field] === 'string') {
          // Remove commas from the string before parsing
          const valueWithoutCommas = journal[field].replace(/,/g, '.');
          const transformed = transformFn(valueWithoutCommas);
          if (!isNaN(transformed)) {
            journal[field] = transformed;
          }
        }
      });

      // Transform bioxbio array if it exists
      if (journal.bioxbio) {
        journal.bioxbio = journal.bioxbio.map((item) => {
          const year =
            typeof item.Year === 'string'
              ? parseInt((item.Year as string).replace(/,/g, ''))
              : item.Year;

          const impactFactor =
            typeof item.Impact_factor === 'string'
              ? parseFloat((item.Impact_factor as string).replace(/,/g, ''))
              : item.Impact_factor;

          return {
            ...item,
            Year: year,
            Impact_factor: impactFactor,
          };
        });
      }

      return journal;
    });
  }
}
