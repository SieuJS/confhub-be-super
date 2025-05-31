/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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
import type {
  Prisma,
  Journals,
  JournalDetails,
  JournalAuthorInformations,
  JournalAreas,
  JournalTopics,
  Topics,
  JournalQuartiles,
  JournalBioxBio,
} from 'generated/prisma_client';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { TransactionHost } from '@nestjs-cls/transactional';
import { PrismaClient } from 'generated/prisma_client';

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
        // Check if journal exists
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

        // Create journal statistics
        const statisticsData = [
          { category: 'SJR', statistic: String(journal.SJR) },
          { category: 'Overton', statistic: String(journal.Overton) },
          { category: 'SDG', statistic: String(journal.SDG) },
          { category: 'H index', statistic: String(journal['H index']) },
          {
            category: 'Total Docs (2023)',
            statistic: String(journal['Total Docs. (2023)']),
          },
          {
            category: 'Total Docs (3years)',
            statistic: String(journal['Total Docs. (3years)']),
          },
          { category: 'Total Refs', statistic: String(journal['Total Refs.']) },
          {
            category: 'Total Cites (3years)',
            statistic: String(journal['Total Cites (3years)']),
          },
          {
            category: 'Citable Docs (3years)',
            statistic: String(journal['Citable Docs. (3years)']),
          },
          {
            category: 'Cites per Doc (2years)',
            statistic: String(journal['Cites / Doc. (2years)']),
          },
          {
            category: 'Refs per Doc',
            statistic: String(journal['Ref. / Doc.']),
          },
          {
            category: 'Female Percentage',
            statistic: String(journal['%Female']),
          },
        ].filter(
          (stat) =>
            stat.statistic !== 'undefined' &&
            stat.statistic !== 'null' &&
            stat.statistic !== '',
        );

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
          data: { id: journalId },
        });
        totalSuccess++;
      } catch (error) {
        results.push({
          success: false,
          message: 'Failed to import journal',
          error: error instanceof Error ? error.message : 'Unknown error',
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
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

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
      }) as Promise<
        (Journals & {
          JournalDetails: JournalDetails[];
          JournalAuthorInformations: JournalAuthorInformations[];
          JournalAreas: JournalAreas[];
          JournalTopics: (JournalTopics & { inTopic: Topics })[];
          quartiles: JournalQuartiles[];
          JournalBioxBio: JournalBioxBio[];
          JournalStatistics: { category: string; statistic: string }[];
        })[]
      >,
      this.txHost.tx.journals.count({ where }),
    ]);

    const mappedJournals: JournalListItemDto[] = journals.map((journal) => {
      const details = journal.JournalDetails?.[0];
      const authorInfo = journal.JournalAuthorInformations?.[0];
      const area = journal.JournalAreas?.[0];
      const bioxbio = journal.JournalBioxBio?.map((bio) => ({
        Year: bio.year?.toString() || '',
        Impact_factor: bio.impactFactor?.toString() || '',
      }));

      // Find statistics by category
      const findStatistic = (category: string) => {
        const stat = journal.JournalStatistics?.find(
          (s) => s.category === category,
        );
        return stat?.statistic || '';
      };

      return {
        id: journal.id,
        scimagoLink: '',
        bioxbio: bioxbio || null,
        Image: details?.image || '',
        Image_Context: details?.imageContent || '',
        Rank: '',
        Sourceid: '',
        Title: journal.title,
        Type: journal.type,
        Issn: journal.issn,
        SJR: details?.sjr || 0,
        'SJR Best Quartile': '',
        'H index': findStatistic('H index'),
        'Total Docs. (2023)': findStatistic('Total Docs (2023)'),
        'Total Docs. (3years)': findStatistic('Total Docs (3years)'),
        'Total Refs.': findStatistic('Total Refs'),
        'Total Cites (3years)': findStatistic('Total Cites (3years)'),
        'Citable Docs. (3years)': findStatistic('Citable Docs (3years)'),
        'Cites / Doc. (2years)': findStatistic('Cites per Doc (2years)'),
        'Ref. / Doc.': findStatistic('Refs per Doc'),
        '%Female': findStatistic('Female Percentage'),
        Overton: details?.overton || 0,
        SDG: details?.sdg || 0,
        Country: journal.country,
        Region: journal.region,
        Publisher: journal.publisher,
        Coverage: details?.coverage || '',
        Categories: '',
        Areas: area?.name || '',
        title: journal.title,
        'Subject Area and Category': {
          'Field of Research': '',
          Topics: journal.JournalTopics.map((jt) => jt.inTopic.name),
        },
        ISSN: journal.issn,
        Information: {
          Homepage: authorInfo?.homePage || '',
          'How to publish in this journal': authorInfo?.instruction || '',
          Mail: authorInfo?.mail || '',
        },
        Scope: details?.scope || undefined,
        'Additional Info': undefined,
        SupplementaryTable: journal.quartiles.map((q) => ({
          Category: q.category || '',
          Year: q.year || '',
          Quartile: q.quartile || '',
        })),
        Thumbnail: authorInfo?.thumbnail || '',
        createdAt: journal.createdAt,
        updatedAt: journal.updatedAt,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: mappedJournals,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }
}
