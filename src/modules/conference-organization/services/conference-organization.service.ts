/* eslint-disable @typescript-eslint/no-unsafe-call */
import { PrismaService } from '../../common';
import { LocationInput } from '../models/location/location.input';
import { LocationDTO } from '../models/location/location.dto';
import { ConferenceDateInput } from '../models/date/conferencer-date.input';
import { ConferenceDateDTO } from '../models/date/conference-date.dto';
import { OrganizedInput } from '../models/organize/organized.input';
import { OrganizedDTO } from '../models/organize/organized.dto';
import { Injectable } from '@nestjs/common';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { TransactionHost } from '@nestjs-cls/transactional';
import parser from 'any-date-parser';
import { PrismaClient } from 'generated/prisma_client';
@Injectable()
export class ConferenceOrganizationSerivce {
  constructor(
    private prismaService: PrismaService,
    private readonly txHost: TransactionHost<
      TransactionalAdapterPrisma<PrismaClient>
    >,
  ) {}

  async importPlace(input: LocationInput): Promise<LocationDTO> {
    const location = await this.txHost.tx.locations.create({
      data: {
        continent: input.continent,
        country: input.country,
        cityStateProvince: input.cityStateProvince,
        address: input.address,
        organizeId: input.organizeId,
        isAvailable: true,
      },
    });
    return {
      ...location,
      continent: location.continent || '',
      country: location.country || '',
      cityStateProvince: location.cityStateProvince || '',
      address: location.address || '',
    };
  }

  async importDate(input: ConferenceDateInput): Promise<ConferenceDateDTO> {
    const date = await this.txHost.tx.conferenceDates.create({
      data: {
        fromDate: parser.fromAny(input.fromDate as any).isValid()
          ? parser.fromAny(input.fromDate as any)
          : null,
        toDate: parser.fromAny(input.toDate as any).isValid()
          ? parser.fromAny(input.toDate as any)
          : null,
        organizedId: input.organizedId,
        type: input.type,
        name: input.name,
        isAvailable: true,
      },
    });
    return date;
  }

  async importTopic({
    organized,
    topic,
  }: {
    organized: string;
    topic: string;
  }) {
    const topicInDb = await this.findOrCreateTopic(topic);

    const organizedTopic = await this.txHost.tx.conferenceTopics.create({
      data: {
        organizeId: organized,
        topicId: topicInDb.id,
      },
    });
    return {
      ...organizedTopic,
      topic: topicInDb.name,
    };
  }

  async removeTopic(name: string) {
    const topicInDb = await this.txHost.tx.topics.findFirst({
      where: {
        name,
      },
    });
    if (!topicInDb) {
      return;
    }

    await this.txHost.tx.conferenceTopics.deleteMany({
      where: {
        topicId: topicInDb.id,
      },
    });

    await this.txHost.tx.journalTopics.deleteMany({
      where: {
        topicId: topicInDb.id,
      },
    });

    await this.txHost.tx.topicUserInteresteds.deleteMany({
      where: {
        topicId: topicInDb.id,
      },
    });

    return this.txHost.tx.topics.delete({
      where: {
        id: topicInDb.id,
      },
    });
  }

  async findOrCreateTopic(topic: string) {
    const topicInDb = await this.txHost.tx.topics.findFirst({
      where: {
        name: topic,
      },
    });
    if (!topicInDb) {
      return this.txHost.tx.topics.create({
        data: {
          name: topic,
        },
      });
    }

    return topicInDb;
  }

  async importOrganize(
    input: OrganizedInput,
  ): Promise<OrganizedDTO | undefined> {
    const organize = await this.txHost.tx.conferenceOrganizations.create({
      data: {
        year: isNaN(input.year as number) ? null : input.year,
        accessType: input.accessType,
        link: input.link,
        impLink: input.impLink,
        isAvailable: true,
        cfpLink: input.cfpLink,
        summerize: input.summerize,
        callForPaper: input.callForPaper,
        conferenceId: input.conferenceId,
        publisher: input.publisher,
      },
    });

    if (!organize) {
      return undefined;
    }

    return {
      ...organize,
      topics: [],
      conferenceDates: [],
      locations: [],
    };
  }

  async getFirstOrganizationsByConferenceId(
    conferenceId: string,
  ): Promise<OrganizedDTO | undefined> {
    const organizedDb =
      await this.prismaService.conferenceOrganizations.findFirst({
        where: {
          isAvailable: true,
          isLastest: true,
          conferenceId,
        },
        include: {
          topics: {
            include: {
              inTopic: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });
    if (!organizedDb) {
      return undefined;
    }
    return {
      ...organizedDb,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      topics: organizedDb.topics.map((topic) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
        return topic.inTopic.name;
      }),
      locations: [],
      conferenceDates: [],
    };
  }

  async getLocationsByOrganizedId(organizedId: string) {
    return this.txHost.tx.locations.findMany({
      where: {
        isAvailable: true,
        organizeId: organizedId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async getAllOrganizedByConferenceId(
    conferenceId: string,
  ): Promise<OrganizedDTO[]> {
    const result = await this.prismaService.conferenceOrganizations.findMany({
      where: {
        isAvailable: true,
        conferenceId,
      },
      include: {
        topics: {
          include: {
            inTopic: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
    return result.map((organizedDb) => {
      return {
        ...organizedDb,
        topics: organizedDb.topics.map((topic) => {
          return topic.inTopic.name;
        }),
        locations: [],
        conferenceDates: [],
      };
    });
  }

  async getConferenceDatesByOrganizedId(organizedId: string) {
    return this.prismaService.conferenceDates.findMany({
      where: {
        isAvailable: true,
        organizedId,
        type: 'conferenceDates',
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async getDatesByOrganizedId(
    organizedId: string,
  ): Promise<ConferenceDateDTO[]> {
    return this.prismaService.conferenceDates.findMany({
      where: {
        isAvailable: true,
        organizedId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async getAllTopics() {
    return this.prismaService.topics.findMany({
      distinct: ['name'],
      select: {
        name: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async getAllTopicsByOrganizedId(organizedId: string) {
    return this.prismaService.conferenceTopics.findMany({
      where: {
        organizeId: organizedId,
      },
      include: {
        inTopic: true,
      },
    });
  }

  async findByLink(link: string): Promise<OrganizedDTO | null> {
    const normalizedLink = link.endsWith('/') ? link.slice(0, -1) : link;
    console.log('Normalized Link:', normalizedLink);
    const result = await this.prismaService.conferenceOrganizations.findFirst({
      where: {
        OR: [
          {
            link: {
              contains: normalizedLink,
              mode: 'insensitive',
            },
          },
          { link: normalizedLink + '/' },
        ],
      },
      include: {
        topics: {
          include: {
            inTopic: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!result) {
      return null;
    }

    return {
      ...result,
      topics: result.topics.map((topic) => topic.inTopic.name),
      locations: [],
      conferenceDates: [],
    };
  }
  async updateLastestOrganization() {
    const conferences = await this.prismaService.conferences.findMany({});
    for (const conference of conferences) {
      const organizations =
        await this.prismaService.conferenceOrganizations.findMany({
          where: { conferenceId: conference.id },
          orderBy: { updatedAt: 'desc' },
        });
      if (organizations.length > 0) {
        await this.prismaService.conferenceOrganizations.update({
          where: { id: organizations[0].id },
          data: { isLastest: true, updatedAt: organizations[0].updatedAt },
        });
        await this.prismaService.conferenceOrganizations.updateMany({
          where: {
            id: { not: organizations[0].id },
            conferenceId: conference.id,
          },
          data: { isLastest: false },
        });
      }
    }
    return { message: 'Latest organizations updated successfully' };
  }

  async updateLastestOrganizationById(conferenceId: string) {
    const organizations =
      await this.prismaService.conferenceOrganizations.findMany({
        where: { conferenceId },
        orderBy: { updatedAt: 'desc' },
      });
    if (organizations.length > 0) {
      await this.prismaService.conferenceOrganizations.update({
        where: { id: organizations[0].id },
        data: { isLastest: true, updatedAt: organizations[0].updatedAt },
      });
      await this.prismaService.conferenceOrganizations.updateMany({
        where: { id: { not: organizations[0].id }, conferenceId },
        data: { isLastest: false },
      });
    }
  }
}
