import { Injectable } from '@nestjs/common';
import { paginator, PaginatorTypes } from '@nodeteam/nestjs-prisma-pagination';
import { Conferences, Prisma } from 'generated/prisma_client';
import { PrismaService } from 'src/modules/common';
import {
  AdminConferenceDTO,
  AdminConferenceParams,
} from '../models/admin-conference.dto';
import { Readable } from 'stream';
import * as papa from 'papaparse';
import { ConferenceImportRow } from '../models/conference-import-row';
import { NativeConferenceService } from './native-conference.service';
import {
  FieldOfResearchService,
  RankService,
  SourceService,
} from 'src/modules/source-rank';
import { ConferenceOrganizationSerivce } from 'src/modules/conference-organization';
import { ConferenceRankService } from 'src/modules/conference/services/conference-rank.service';
import { ConferenceService } from 'src/modules/conference/services/conference.service';
const paginate: PaginatorTypes.PaginateFunction = paginator({ perPage: 10 });
@Injectable()
export class AdminConferenceService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly nativeConferenceService: NativeConferenceService,
    private readonly fieldOfResearchService: FieldOfResearchService,
    private readonly conferenceOrganizationService: ConferenceOrganizationSerivce,
    private readonly rankService: RankService,
    private readonly souceService: SourceService,
    private readonly conferenceService: ConferenceService,
  ) {}

  convertToPrismaWhereInput(
    params: AdminConferenceParams,
  ): Prisma.ConferencesWhereInput {
    return {
      OR: [
        {
          title: {
            contains: params.search,
            mode: 'insensitive',
          },
        },
        {
          acronym: {
            contains: params.search,
            mode: 'insensitive',
          },
        },
      ],
      AND: [
        {
          ...(params.status.length > 0
            ? {
                status: {
                  in: params.status,
                },
              }
            : {}),
        },
        {
          ranks: {
            some: {
              byRank: {
                belongsToSource: {
                  ...(params.source.length > 0
                    ? {
                        name: {
                          in: params.source,
                        },
                      }
                    : {}),
                },
                ...(params.ranks.length > 0
                  ? {
                      name: {
                        in: params.ranks,
                      },
                    }
                  : {}),
              },
              inFieldOfResearch: {
                ...(params.researchFields.length > 0
                  ? {
                      name: {
                        in: params.researchFields,
                      },
                    }
                  : {}),
              },
            },
          },
        },
      ],
    };
  }

  async getConferenceInstances({
    where,
    orderBy,
    include,
    page,
    perPage,
  }: {
    where: Prisma.ConferencesWhereInput;
    orderBy: Prisma.ConferencesOrderByWithRelationInput;
    include: Prisma.ConferencesInclude;
    page: number;
    perPage: number;
  }): Promise<PaginatorTypes.PaginatedResult<AdminConferenceDTO>> {
    include = {
      ranks: {
        include: {
          byRank: {
            include: {
              belongsToSource: true,
            },
          },
          inFieldOfResearch: true,
        },
      },
      organizations: {
        include: {
          locations: true,
          topics: true,
          conferenceDates: true,
        },
      },
    };

    const paginatedResult = await paginate(
      this.prismaService.conferences,
      {
        where,
        orderBy,
        include,
      },
      {
        page,
        perPage,
      },
    );

    const conferences: AdminConferenceDTO[] = paginatedResult.data.map(
      (item: any): AdminConferenceDTO => ({
        id: item.id,
        title: item.title,
        sources: Array.from(
          new Set(item.ranks.map((rank) => rank.byRank.belongsToSource.name)),
        ),
        acronym: item.acronym,
        ranks: Array.from(
          new Set(item.ranks.map((rank) => rank.byRank.name as string)),
        ),
        researchFields: Array.from(
          new Set(
            item.ranks.map((rank) => rank.inFieldOfResearch.name as string),
          ),
        ),
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }),
    );

    return {
      data: conferences,
      meta: paginatedResult.meta,
    };
  }

  async parseCSVFile(
    file: Express.Multer.File,
  ): Promise<ConferenceImportRow[] | null> {
    const streamFile = Readable.from(file.buffer);
    const csvData = await new Promise<any[]>((resolve, reject) => {
      papa.parse(streamFile, {
        delimiter: ',',
        header: false,
        complete: (result) => resolve(result.data),
        error: (error) => reject(error),
      });
    });

    const parseds = csvData.map((row): ConferenceImportRow => {
      return {
        title: row[1],
        acronym: row[2],
        source: row[3],
        rank: row[4],
        researchFieldCodes: row
          .slice(6)
          .map((code) => code.trim())
          .filter((code) => code !== ''),
      };
    });
    return parseds;
  }

  async importConference(
    conferences: ConferenceImportRow[] | null,
    adminId: string,
  ) {
    if (!conferences) {
      throw new Error('No data to import');
    }
    const include = {
      ranks: {
        include: {
          byRank: {
            include: {
              belongsToSource: true,
            },
          },
          inFieldOfResearch: true,
        },
      },
      organizations: {
        include: {
          locations: true,
          topics: true,
          conferenceDates: true,
        },
      },
    };

    const conferenceImported: Promise<AdminConferenceDTO>[] = conferences.map(
      async (conference) => {
        let conferenceInDB =
          await this.nativeConferenceService.getConferenceByAcronym(
            conference.acronym,
            conference.title,
          );
        if (!conferenceInDB) {
          conferenceInDB = await this.prismaService.conferences.create({
            data: {
              title: conference.title,
              acronym: conference.acronym,
              status: 'DRAFT',
              adminId: adminId,
            },
            include: include,
          });
          const sourceInDB = await this.souceService.findOrCreateSource({
            name: conference.source,
            link: '',
          });

          const rankInDB = await this.rankService.findOrCreateRank({
            name: conference.rank,
            source: sourceInDB,
            value: 0,
          });

          for (const researchFieldCode of conference.researchFieldCodes) {
            const researchFieldInDB =
              await this.fieldOfResearchService.getFieldOfResearchByCode(
                researchFieldCode,
              );
            if (!researchFieldInDB) {
              throw new Error(
                `Research field with code ${researchFieldCode} not found`,
              );
            }
            await this.conferenceService.createOrFindRank(
              conferenceInDB?.id as string,
              rankInDB,
              researchFieldInDB?.id,
              new Date().getFullYear(),
            );
          }
        }

        return {
          id: conferenceInDB?.id,
          title: conferenceInDB.title,
          sources: Array.from(
            new Set(
              conferenceInDB.ranks.map(
                (rank) => rank.byRank.belongsToSource.name,
              ),
            ),
          ),
          acronym: conferenceInDB.acronym,
          ranks: Array.from(
            new Set(
              conferenceInDB.ranks.map((rank) => rank.byRank.name as string),
            ),
          ),
          researchFields: Array.from(
            new Set(
              conferenceInDB.ranks.map(
                (rank) => rank.inFieldOfResearch.name as string,
              ),
            ),
          ),
          status: conferenceInDB.status,
          createdAt: conferenceInDB.createdAt,
          updatedAt: conferenceInDB.updatedAt,
        };
      },
    );

    return await Promise.all(conferenceImported).then(
      (conferences: AdminConferenceDTO[]) => {
        return conferences.filter((conference) => conference !== undefined);
      },
    );
  }
}
