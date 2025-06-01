/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { JournalImportDto } from '../models/journal-import.dto';
import * as Papa from 'papaparse';
import { BadRequestException } from '@nestjs/common';

interface CsvRecord {
  Rank: string;
  Sourceid: string;
  Title: string;
  Type: string;
  Issn: string;
  SJR: string;
  'SJR Quartile': string;
  'H index': string;
  'Total Docs. (2024)': string;
  'Total Docs. (3years)': string;
  'Total Refs.': string;
  'Total Cites (3years)': string;
  'Citable Docs. (3years)': string;
  'Cites / Doc. (2years)': string;
  'Ref. / Doc.': string;
  '%Female': string;
  Overton: string;
  SDG: string;
  Country: string;
  Region: string;
  Publisher: string;
  Coverage: string;
  Categories: string;
  Areas: string;
}

function validateRequiredFields(record: CsvRecord): void {
  const requiredFields = ['Title', 'Issn', 'Publisher'];
  const missingFields = requiredFields.filter(
    (field) => !record[field]?.trim(),
  );

  if (missingFields.length > 0) {
    throw new BadRequestException(
      `Missing required fields: ${missingFields.join(', ')}`,
    );
  }
}

function parseNumericValue(
  value: string | undefined,
  fieldName: string,
): number {
  if (!value) return 0;
  // Remove any non-numeric characters except decimal point and minus sign
  const cleanedValue = value.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleanedValue);

  if (isNaN(parsed)) {
    throw new BadRequestException(
      `Invalid numeric value for ${fieldName}: ${value}`,
    );
  }

  return parsed;
}

export function parseJournalCsv(csvContent: string): JournalImportDto[] {
  try {
    const result = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      delimiter: ';',
      transformHeader: (header: string) => header.trim(),
    }) as { data: CsvRecord[] };

    if (!result.data || result.data.length === 0) {
      throw new BadRequestException('No data found in CSV file');
    }

    return result.data.map((record: CsvRecord, index: number) => {
      try {
        validateRequiredFields(record);

        // Transform the CSV record into JournalImportDto format
        const journal: JournalImportDto = {
          scimagoLink: '',
          bioxbio: [],
          Image: '',
          Image_Context: '',
          Rank: record.Rank?.trim() || '',
          Sourceid: record.Sourceid?.trim() || '',
          Title: record.Title.trim(),
          Type: record.Type?.trim() || '',
          Issn: record.Issn.trim(),
          SJR: parseNumericValue(record.SJR, 'SJR'),
          'SJR Best Quartile': record['SJR Quartile']?.trim() || '',
          'H index': record['H index']?.trim() || '',
          'Total Docs. (2023)': record['Total Docs. (2024)']?.trim() || '',
          'Total Docs. (3years)': record['Total Docs. (3years)']?.trim() || '',
          'Total Refs.': record['Total Refs.']?.trim() || '',
          'Total Cites (3years)': record['Total Cites (3years)']?.trim() || '',
          'Citable Docs. (3years)':
            record['Citable Docs. (3years)']?.trim() || '',
          'Cites / Doc. (2years)':
            record['Cites / Doc. (2years)']?.trim() || '',
          'Ref. / Doc.': record['Ref. / Doc.']?.trim() || '',
          '%Female': record['%Female']?.trim() || '',
          Overton: parseNumericValue(record.Overton, 'Overton'),
          SDG: parseNumericValue(record.SDG, 'SDG'),
          Country: record.Country?.trim() || '',
          Region: record.Region?.trim() || '',
          Publisher: record.Publisher.trim(),
          Coverage: record.Coverage?.trim() || '',
          Categories: record.Categories?.trim() || '',
          Areas: record.Areas?.trim() || '',
          title: record.Title.trim(),
          'Subject Area and Category': {
            'Field of Research': '',
            Topics: record.Categories
              ? record.Categories.split(';').map((cat) => cat.trim())
              : [],
          },
          ISSN: record.Issn.trim(),
          Information: {
            Homepage: '',
            'How to publish in this journal': '',
            Mail: '',
          },
          Scope: '',
          SupplementaryTable: [],
          Thumbnail: '',
        };

        return journal;
      } catch (error) {
        throw new BadRequestException(
          `Error processing row ${index + 1}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }
    });
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    throw new BadRequestException(
      `Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}
