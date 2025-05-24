import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/common';
import { Prisma } from 'generated/prisma_client';

@Injectable()
export class NativeConferenceService {
  private readonly prismaService: PrismaService;

  constructor(
    prismaService: PrismaService,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
  ) {
    this.prismaService = prismaService;
  }

  async getConferenceByAcronym(acronym: string, name: string) {
    return await this.txHost.tx.conferences.findFirst({
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

  async createConference(
    input: Omit<Prisma.ConferencesCreateInput, 'createdByUser'> & {
      adminId: string;
    },
  ) {
    const { adminId, ...rest } = input;
    const conference = await this.txHost.tx.conferences.create({
      data: {
        ...rest,
        createdByAdmin: {
          connect: { id: adminId },
        },
      },
      include: {
        ranks: true,
        organizations: true,
      },
    });
    return conference;
  }
}
