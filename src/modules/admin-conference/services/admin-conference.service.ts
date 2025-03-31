import { Injectable } from '@nestjs/common';
import { paginator, PaginatorTypes } from '@nodeteam/nestjs-prisma-pagination';
import {  Prisma } from 'generated/prisma_client';
import { PrismaService } from 'src/modules/common';
import { AdminConferenceDTO, AdminConferenceParams } from '../models/admin-conference.dto';

const paginate: PaginatorTypes.PaginateFunction = paginator({ perPage: 10 });
@Injectable()
export class AdminConferenceService {
  constructor(private readonly prismaService: PrismaService) {}

  convertToPrismaWhereInput(
    params : AdminConferenceParams
  ) :  (Prisma.ConferencesWhereInput) {
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
            ...(params.status.length > 0 ? {status: {
                in: params.status,
            }} : {}),
            },
            {
                ranks : {
                    some : {
                        byRank : {
                            belongsToSource : {
                                 ...(params.source.length > 0 ? {name : {
                                    in : params.source
                                }} : {})
                            },
                            ...( params.ranks.length > 0 ? {name : {
                                in : params.ranks
                            }} : {})
                        },
                        inFieldOfResearch : {
                            ...(params.researchFields.length > 0 ? {name : {
                                in : params.researchFields
                            }} : {})
                        },
                        
                    }
                }
            }
        ],
    };
  }

  async getConferenceInstances({
    where,
    orderBy,
    include ,
    page,
    perPage,
  }: {
    where: Prisma.ConferencesWhereInput;
    orderBy: Prisma.ConferencesOrderByWithRelationInput;
    include : Prisma.ConferencesInclude;
    page: number;
    perPage: number;
  }): Promise<PaginatorTypes.PaginatedResult<AdminConferenceDTO>> {

    include = {
        ranks : {
            include : {
                byRank : {
                    include : {
                        belongsToSource : true
                    }
                },
                inFieldOfResearch : true
            }
        },
        organizations : {
            include : {
                locations : true,
                topics : true,
                conferenceDates : true
            },

        }
    }

    const paginatedResult = await paginate(this.prismaService.conferences, {
        where,
        orderBy,
        include
    },{
        page,
        perPage,
    });

    const conferences: AdminConferenceDTO[] = paginatedResult.data.map((item: any): AdminConferenceDTO => ({
        id: item.id,
        title: item.title,
        sources: Array.from(new Set(item.ranks.map((rank) => rank.byRank.belongsToSource.name))),
        acronym: item.acronym,
        ranks: Array.from(new Set(item.ranks.map((rank) => rank.byRank.name as string))),
        researchFields : Array.from(new Set(item.ranks.map((rank) => rank.inFieldOfResearch.name as string))),
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
    }));

    return {
        data : conferences,
        meta : paginatedResult.meta,
    }
  }
  
  
}
