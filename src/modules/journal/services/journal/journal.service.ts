import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/common';
import { JournalImportDto } from '../../models/journal-import.dto';
import { JournalListQueryDto } from '../../models/journal-list-query.dto';
import { JournalImportResponseDto, ImportResult } from '../../models/journal-import-response.dto';
import { JournalListResponseDto } from '../../models/journal-list-response.dto';

@Injectable()
export class JournalService {
  constructor(private prisma: PrismaService) {}

  async importJournals(journals: JournalImportDto[]): Promise<JournalImportResponseDto> {
    const results: ImportResult[] = [];
    let totalSuccess = 0;
    let totalFailed = 0;

    for (const journal of journals) {
      try {
        // Create main journal record
        const createdJournal = await this.prisma.journals.create({
          data: {
            title: journal.Title,
            type: journal.Type,
            issn: journal.Issn,
            publisher: journal.Publisher,
            country: journal.Country,
            region: journal.Region,
            JournalDetails: {
              create: {
                image: journal.Image,
                imageContent: journal.Image_Context,
                sjr: journal.SJR,
                coverage: journal.Coverage,
                scope: journal.Scope,
              }
            },
            JournalAuthorInformations: {
              create: {
                homePage: journal.Information.Homepage,
                instruction: journal.Information['How to publish in this journal'],
                mail: journal.Information.Mail,
                thumbnail: journal.Thumbnail,
              }
            },
            JournalAreas: {
              create: {
                name: journal.Areas,
              }
            },
            quartiles: {
              create: journal.SupplementaryTable.map(entry => ({
                year: entry.Year,
                quartile: entry.Quartile,
              }))
            },
            JournalTopics: {
              create: await Promise.all(journal['Subject Area and Category'].Topics.map(async topic => {
                const existingTopic = await this.prisma.topics.findFirst({
                  where: { name: topic }
                });
                
                if (existingTopic) {
                  return { topicId: existingTopic.id };
                }

                const newTopic = await this.prisma.topics.create({
                  data: { name: topic }
                });

                return { topicId: newTopic.id };
              }))
            }
          }
        });

        results.push({
          success: true,
          message: 'Journal imported successfully',
          data: createdJournal
        });
        totalSuccess++;
      } catch (error) {
        results.push({
          success: false,
          message: 'Failed to import journal',
          error: error.message
        });
        totalFailed++;
      }
    }

    return {
      results,
      totalProcessed: journals.length,
      totalSuccess,
      totalFailed
    };
  }

  async getJournals(query: JournalListQueryDto): Promise<JournalListResponseDto> {
    const { page = 1, limit = 10, search, publisher, country, region, type, topic, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { issn: { contains: search, mode: 'insensitive' as const } },
        ]
      }),
      ...(publisher && { publisher: { contains: publisher, mode: 'insensitive' as const } }),
      ...(country && { country: { contains: country, mode: 'insensitive' as const } }),
      ...(region && { region: { contains: region, mode: 'insensitive' as const } }),
      ...(type && { type: { contains: type, mode: 'insensitive' as const } }),
      ...(topic && {
        JournalTopics: {
          some: {
            inTopic: {
              name: { contains: topic, mode: 'insensitive' as const }
            }
          }
        }
      })
    };

    const [total, items] = await Promise.all([
      this.prisma.journals.count({ where }),
      this.prisma.journals.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          JournalDetails: true,
          JournalAuthorInformations: true,
          JournalAreas: true,
          JournalTopics: {
            include: {
              inTopic: true
            }
          }
        }
      })
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
}
