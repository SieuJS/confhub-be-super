import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/common';
import { JournalImportDto } from '../../models/journal-import.dto';
import { JournalListQueryDto } from '../../models/journal-list-query.dto';
import {
  JournalImportResponseDto,
  ImportResult,
} from '../../models/journal-import-response.dto';
import {
  JournalListResponseDto,
  JournalListItemDto,
} from '../../models/journal-list-response.dto';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { TransactionHost } from '@nestjs-cls/transactional';
import { Prisma, PrismaClient } from 'generated/prisma_client';
import {
  JournalCsvImportResponseDto,
  JournalCsvImportResult,
} from '../../models/journal-csv-import-response.dto';

@Injectable()
export class JournalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txHost: TransactionHost<
      TransactionalAdapterPrisma<PrismaClient>
    >,
  ) {}

  async importJournals(
    journals: JournalImportDto[],
  ): Promise<JournalImportResponseDto> {
    const results: ImportResult[] = [];
    let totalSuccess = 0;
    let totalFailed = 0;

    for (const journal of journals) {
      try {
        // Check if journal crawled
        const existingJournal = await this.prisma.journals.findFirst({
          where: {
            AND: [
              { title: journal.Title },
              { issn: journal.Issn },
              { publisher: journal.Publisher },
            ],
          },
        });

        let journalId: string;

        if (existingJournal) {
          journalId = existingJournal.id;
        } else {
          // Create main journal record if it doesn't exist
          const createdJournal = await this.prisma.journals.create({
            data: {
              title: journal.Title,
              type: journal.Type,
              issn: journal.Issn,
              publisher: journal.Publisher,
              country: journal.Country,
              region: journal.Region,
            },
          });
          journalId = createdJournal.id;
        }

        // Delete existing related records
        await this.prisma.$transaction([
          this.prisma.journalDetails.deleteMany({
            where: { journalId },
          }),
          this.prisma.journalAuthorInformations.deleteMany({
            where: { journalId },
          }),
          this.prisma.journalAreas.deleteMany({
            where: { journalId },
          }),
          this.prisma.journalTopics.deleteMany({
            where: { journalId },
          }),
          this.prisma.journalQuartiles.deleteMany({
            where: { journalId },
          }),
          this.prisma.journalBioxBio.deleteMany({
            where: { journalId },
          }),
          this.prisma.journalStatistics.deleteMany({
            where: { journalId },
          }),
        ]);

        // Create or update related records
        await this.prisma.journalDetails.create({
          data: {
            journalId,
            image: journal.Image,
            imageContent: journal.Image_Context,
            sjr: journal.SJR,
            coverage: journal.Coverage,
            scope: journal.Scope,
            hIndex: parseInt(journal['H index']),
            rank: journal.Rank,
            scrimagoLink: journal.scimagoLink,
          },
        });

        if (journal.Information) {
          await this.prisma.journalAuthorInformations.create({
            data: {
              journalId,
              homePage: journal.Information.Homepage,
              instruction:
                journal.Information['How to publish in this journal'],
              mail: journal.Information.Mail,
              thumbnail: journal.Thumbnail,
            },
          });
        }

        await this.prisma.journalAreas.create({
          data: {
            journalId,
            name: journal.Areas,
          },
        });

        // Create journal topics
        if (journal['Subject Area and Category']?.Topics) {
          for (const topic of journal['Subject Area and Category'].Topics) {
            const existingTopic = await this.prisma.topics.findFirst({
              where: { name: topic },
            });

            const topicId = existingTopic
              ? existingTopic.id
              : (await this.prisma.topics.create({ data: { name: topic } })).id;

            await this.prisma.journalTopics.create({
              data: {
                journalId,
                topicId,
              },
            });
          }
        }

        // Create journal quartiles
        if (
          journal.SupplementaryTable &&
          journal.SupplementaryTable.length > 0
        ) {
          for (const entry of journal.SupplementaryTable) {
            await this.prisma.journalQuartiles.create({
              data: {
                journalId,
                year: entry.Year,
                quartile: entry.Quartile,
                category: entry.Category,
              },
            });
          }
        }

        // Create journal bioxbio entries
        if (journal.bioxbio && journal.bioxbio.length > 0) {
          for (const entry of journal.bioxbio) {
            await this.prisma.journalBioxBio.create({
              data: {
                journalId,
                year: entry.Year,
                impactFactor: entry.Impact_factor,
              },
            });
          }
        }
        const statisticsData: { statistic: string; category: string }[] = [];
        const patern = [
          'total',
          'docs',
          'refs',
          'cites',
          'citable',
          'cites per doc',
          'percentage',
          'best',
        ];

        for (const key of Object.keys(journal)) {
          if (patern.some((substr) => key.toLowerCase().includes(substr))) {
            const category = key;
            const statistic = `${journal[key]}`;
            statisticsData.push({ category, statistic });
          }
        }

        for (const stat of statisticsData) {
          await this.prisma.journalStatistics.create({
            data: {
              journalId,
              category: stat.category,
              statistic: stat.statistic,
            },
          });
        }

        results.push({
          success: true,
          message: 'Journal imported successfully',
          data: { id: journalId, title: journal.Title, issn: journal.Issn },
        });
        totalSuccess++;
      } catch (error) {
        results.push({
          success: false,
          message: 'Failed to import journal',
          error: error instanceof Error ? error.message : 'Unknown error',
          data : {
            title: journal.Title,
            issn: journal.Issn,
          }
        });
        totalFailed++;
      }
    }

    return {
      results,
      totalProcessed: journals.length,
      totalSuccess,
      totalFailed,
    };
  }

  async getJournals(
    query: JournalListQueryDto,
  ): Promise<JournalListResponseDto> {
    const {
      page = 1,
      limit = 10,
      search,
      publisher,
      country,
      region,
      type,
      topic,
      category,
      areas,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;
    console.log('Query:', category);
    const where: Prisma.JournalsWhereInput = {
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { issn: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(publisher && {
        publisher: { contains: publisher, mode: 'insensitive' as const },
      }),
      ...(country && {
        country: { contains: country, mode: 'insensitive' as const },
      }),
      ...(region && {
        region: { contains: region, mode: 'insensitive' as const },
      }),
      ...(areas && {
        JournalAreas: {
          some: {
            name: { contains: areas, mode: 'insensitive' as const },
          },
        },
      }),
      ...(
        category && {
          JournalTopics: {
            some: {
              inTopic: {
                name: { contains: category, mode: 'insensitive' as const },
              },
            },
          },
        }
      ),
      ...(query.issn && {
        issn: { contains: query.issn, mode: 'insensitive' as const },
      }),
      ...(query.quartile && {
        quartiles: {
          some: {
            quartile: {
              contains: query.quartile,
              mode: 'insensitive' as const,
            },
          },
        },
      }),
      ...(query.hIndex && {
        JournalDetails: {
          some: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            hIndex: { gte: parseFloat(query.hIndex) },
          },
        },
      }),
      ...(type && { type: { contains: type, mode: 'insensitive' as const } }),
      ...(topic && {
        JournalTopics: {
          some: {
            inTopic: {
              name: { contains: topic, mode: 'insensitive' as const },
            },
          },
        },
      }),
    };

    const [journals, total] = await Promise.all([
      this.txHost.tx.journals.findMany({
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
              inTopic: true,
            },
          },
          quartiles: true,
          JournalBioxBio: true,
          JournalStatistics: true,
        },
      }),
      this.txHost.tx.journals.count({ where }),
    ]);

    const mappedJournals = journals.map((dbInstance) => {
      return new JournalListItemDto(dbInstance);
    });
    return {
      data: mappedJournals,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getJournalById(id: string): Promise<JournalListItemDto> {
    const journal = await this.prisma.journals.findUnique({
      where: { id },
      include: {
        JournalDetails: true,
        JournalAuthorInformations: true,
        JournalAreas: true,
        JournalTopics: {
          include: {
            inTopic: true,
          },
        },
        quartiles: true,
        JournalBioxBio: true,
        JournalStatistics: true,
      },
    });

    if (!journal) {
      throw new Error('Journal not found');
    }

    return new JournalListItemDto(journal);
  }

  async checkAndImportJournalsFromCsv(
    journals: JournalImportDto[],
  ): Promise<JournalCsvImportResponseDto> {
    const results: JournalCsvImportResult[] = [];
    let totalCrawled = 0;
    let totalNotCrawled = 0;

    for (const journal of journals) {
      try {
        // Check if journal has been crawled by looking for quartiles and scope
        const existingJournal = await this.prisma.journals.findFirst({
          where: {
            AND: [{ title: journal.Title }, { issn: journal.Issn }],
          },
          include: {
            JournalDetails: true,
            quartiles: true,
          },
        });

        if (
          existingJournal &&
          (existingJournal.JournalDetails[0]?.scope ||
            existingJournal.quartiles.length > 0)
        ) {
          results.push({
            title: journal.Title,
            issn: journal.Issn,
            crawled: true,
            message: 'Journal has been crawled',
            lastUpdated: existingJournal.updatedAt,
          });
          totalCrawled++;
        } else {
          results.push({
            title: journal.Title,
            issn: journal.Issn,
            crawled: false,
            message: 'Journal has not been crawled',
            lastUpdated: null,
          });
          totalNotCrawled++;
        }
      } catch (error) {
        results.push({
          title: journal.Title,
          issn: journal.Issn,
          crawled: false,
          lastUpdated: null,
          message:
            'Error checking journal: ' +
            (error instanceof Error ? error.message : 'Unknown error'),
        });
      }
    }

    return {
      results,
      totalProcessed: journals.length,
      totalExists: totalCrawled,
      totalNew: totalNotCrawled,
    };
  }
}
