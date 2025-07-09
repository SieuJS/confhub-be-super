import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common';
import { ConferenceRankDTO } from '../models/conference-rank/conference-rank.dto';
import { ConferenceFilter } from '../models/conference-filter/conference.filter';

@Injectable()
export class ConferenceRankService {
  constructor(private prismaService: PrismaService) {}

  async getRankByConferenceId(
    conferenceId: string,
  ): Promise<ConferenceRankDTO[]> {
    const rankInfos = await this.prismaService.conferenceRanks.findMany({
      where: {
        conferenceId,
      },
      include: {
        inFieldOfResearch: true,
        byRank: {
          include: {
            belongsToSource: true,
          },
        },
      },
    });
    const results: ConferenceRankDTO[] = rankInfos.map((rankInfo) => {
      return {
        rank: rankInfo.byRank.name,
        source: rankInfo.byRank.belongsToSource.name,
        fieldOfResearch: rankInfo.inFieldOfResearch.name,
      };
    });
    return results;
  }

  async getRankByConferenceFilter(
    conferenceId: string,
    filter: ConferenceFilter | undefined,
  ): Promise<ConferenceRankDTO | null> {
    const rankInfo = await this.prismaService.conferenceRanks.findFirst({
      where: {
        conferenceId,
        ...(filter?.researchFields &&
        Array.isArray(filter.researchFields) &&
        filter.researchFields.length > 0
          ? {
              OR: filter.researchFields.map((field: string) => ({
                inFieldOfResearch: {
                  name: {
                    contains: field,
                    mode: 'insensitive',
                  },
                },
              })),
            }
          : filter?.researchFields && typeof filter.researchFields === 'string'
            ? {
                inFieldOfResearch: {
                  name: {
                    contains: filter.researchFields,
                    mode: 'insensitive',
                  },
                },
              }
            : {}),
        ...(filter?.source
          ? {
              byRank: {
                belongsToSource: {
                  name: {
                    equals: filter?.source,
                    mode: 'insensitive',
                  },
                },
              },
            }
          : {}),
        ...(filter?.rank
          ? {
              byRank: {
                name: {
                  equals: filter?.rank,
                  mode: 'insensitive',
                },
              },
            }
          : {}),
      },
      include: {
        inFieldOfResearch: true,
        byRank: {
          include: {
            belongsToSource: true,
          },
        },
      },
    });

    if (!rankInfo) {
      return null;
    }

    return {
      rank: rankInfo.byRank.name,
      source: rankInfo.byRank.belongsToSource.name,
      fieldOfResearch: rankInfo.inFieldOfResearch.name,
    };
  }
}
