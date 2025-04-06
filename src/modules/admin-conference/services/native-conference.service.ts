import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma_client';
import { PrismaService } from 'src/modules/common';

@Injectable()
export class NativeConferenceService {
  private readonly prismaService: PrismaService;

  constructor(prismaService: PrismaService) {
    this.prismaService = prismaService;
  }

  async getConferenceByAcronym(acronym: string, name: string) {
    return await this.prismaService.conferences.findFirst({
      where: {
        acronym: acronym,
        title: name,
      },
      include: {
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
      },
    });
  }
}
