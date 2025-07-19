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

      topics: organizedDb.topics.map((topic) => {
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
  async updateLastestOrganizationById(conferenceId: string) {
    const organizations =
      await this.prismaService.conferenceOrganizations.findMany({
        where: { conferenceId },
        orderBy: { updatedAt: 'desc' },
      });
    if (organizations.length > 0) {
      // First set all to false while preserving their updatedAt timestamps
      for (const org of organizations) {
        await this.prismaService.conferenceOrganizations.update({
          where: { id: org.id },
          data: {
            isLastest: false,
            updatedAt: org.updatedAt, // Preserve original updatedAt
          },
        });
      }

      // Then set the latest one to true while preserving its updatedAt timestamp
      await this.prismaService.conferenceOrganizations.update({
        where: { id: organizations[0].id },
        data: {
          isLastest: true,
          updatedAt: organizations[0].updatedAt, // Preserve original updatedAt
        },
      });

      // Sync conference updatedAt with the latest organization's updatedAt
      await this.prismaService.conferences.update({
        where: { id: conferenceId },
        data: {
          updatedAt: organizations[0].updatedAt, // Sync with latest organization's updatedAt
        },
      });
    }
  }

  async updateLastestOrgByConference(confId: string) {
    const organizations =
      await this.prismaService.conferenceOrganizations.findMany({
        where: { conferenceId: confId },
        orderBy: { updatedAt: 'desc' },
      });
    if (organizations.length > 0) {
      // First set all to false while preserving their updatedAt timestamps
      for (const org of organizations) {
        await this.prismaService.conferenceOrganizations.update({
          where: { id: org.id },
          data: {
            isLastest: false,
            updatedAt: org.updatedAt, // Preserve original updatedAt
          },
        });
      }

      // Then set the latest one to true while preserving its updatedAt timestamp
      await this.prismaService.conferenceOrganizations.update({
        where: { id: organizations[0].id },
        data: {
          isLastest: true,
          updatedAt: organizations[0].updatedAt, // Preserve original updatedAt
        },
      });

      // Sync conference updatedAt with the latest organization's updatedAt
      await this.prismaService.conferences.update({
        where: { id: confId },
        data: {
          updatedAt: organizations[0].updatedAt, // Sync with latest organization's updatedAt
        },
      });
    }
    return { message: 'Latest organization updated successfully' };
  }

  /**
   * Import dates from crawler data
   * Handles various date fields that may come from the crawler API
   */
  async importDatesFromCrawlerData(
    crawlData: any,
    organizeId: string,
  ): Promise<void> {
    try {
      const dateFields = [
        {
          field: 'conferenceDates',
          type: 'conferenceDates',
          name: 'Conference Date',
        },
        {
          field: 'submissionDate',
          type: 'submissionDate',
          name: 'Submission Deadline',
        },
        {
          field: 'notificationDate',
          type: 'notificationDate',
          name: 'Notification Date',
        },
        {
          field: 'cameraReadyDate',
          type: 'cameraReadyDate',
          name: 'Camera Ready Date',
        },
        {
          field: 'registrationDate',
          type: 'registrationDate',
          name: 'Registration Date',
        },
        {
          field: 'conferenceDate',
          type: 'conferenceDate',
          name: 'Conference Date',
        },
        { field: 'dates', type: 'dates', name: 'Important Dates' },
      ];

      for (const dateField of dateFields) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const dateValue = crawlData[dateField.field];
        if (dateValue) {
          let dateInput: ConferenceDateInput;

          if (typeof dateValue === 'string') {
            // Handle string dates
            const [fromDate, toDate] = this.parseDateRange(dateValue);
            dateInput = {
              fromDate,
              toDate,
              type: dateField.type,
              name: dateField.name,
              organizedId: organizeId,
            };

            if (fromDate || toDate) {
              await this.importDate(dateInput);
            }
          } else if (typeof dateValue === 'object' && dateValue !== null) {
            // Handle object dates (e.g., { "Paper Submission": "2024-01-15", "Notification": "2024-03-01" })
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            for (const [key, value] of Object.entries(dateValue)) {
              if (value && typeof value === 'string') {
                const [fromDate, toDate] = this.parseDateRange(value);
                dateInput = {
                  fromDate,
                  toDate,
                  type: dateField.type,
                  name: key,
                  organizedId: organizeId,
                };

                if (fromDate || toDate) {
                  await this.importDate(dateInput);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(
        `Error importing dates for organization ${organizeId}:`,
        error,
      );
      // Don't throw error - dates are not critical for import success
    }
  }

  /**
   * Parse date range from string (similar to the utility function)
   */
  private parseDateRange(dateRange: string): [Date | null, Date | null] {
    try {
      // Normalize dash types and remove any extra spaces
      dateRange = dateRange
        .replace('–', '-')
        .replace(/\s*,\s*/g, ', ')
        .trim();

      let parts = dateRange.split(' - ');

      // If splitting by " - " fails, attempt to split by "–"
      if (parts.length === 1) {
        parts = dateRange.split('-');
      }

      if (parts.length !== 2) {
        let singleDate = parser.fromString(dateRange);
        if (!singleDate.isValid()) {
          singleDate = parser.fromString('1' + dateRange);
        }
        if (!singleDate.isValid()) {
          return [null, null];
        } else {
          return [singleDate, singleDate];
        }
      }

      let firstPart = parts[0].trim();
      let lastPart = parts[1].trim();

      if (/^\d/.test(lastPart)) {
        lastPart = firstPart.split(' ')[0] + ' ' + parts[1].trim();
      }

      let lastDate = parser.fromString(lastPart);
      if (!lastDate.isValid()) {
        lastPart = firstPart.split(' ')[0] + lastPart;
        lastDate = parser.fromString(lastPart);
      }
      if (!lastDate.isValid()) return [null, null];

      // If firstPart lacks a year, inherit from lastDate
      const yearOfFirstPart = firstPart.split(' ').pop() || '';
      if (yearOfFirstPart.length < 4) {
        firstPart += ' ' + lastDate.getFullYear();
      }
      let firstDate = parser.fromString(firstPart);

      if (!firstDate.isValid()) {
        firstPart += ` ${lastDate.getFullYear()}`;
        firstDate = parser.fromString(firstPart);
      }

      if (!firstDate.isValid()) return [null, null];

      return [firstDate, lastDate];
    } catch (error) {
      console.error('Error parsing date range:', dateRange, error);
      return [null, null];
    }
  }

  async getAllDateTypes(): Promise<string[]> {
    const dateTypes = await this.prismaService.conferenceDates.findMany({
      distinct: ['type'],
      select: {
        type: true,
      },
    });

    return dateTypes.map((date) => date.type);
  }

  async getDatenameByType(type: string): Promise<string[] | null> {
    const date = await this.prismaService.conferenceDates.findMany({
      distinct: ['name'],
      where: {
        type,
      },
      select: {
        name: true,
      },
    });
    return date.length > 0 ? date.map((d) => d.name) : null;
  }

  /**
   * Create main submission date entries based on Gemini analysis
   */
  async createMainSubmissionDateEntries(
    mainSubmissionDateNames: string[],
    organizedId: string,
  ): Promise<void> {
    for (const name of mainSubmissionDateNames) {
      // Check if this name already exists as mainSubmissionDate type
      const existing = await this.prismaService.conferenceDates.findFirst({
        where: {
          name,
          type: 'mainSubmissionDate',
          organizedId,
        },
      });

      if (!existing) {
        // Create a new entry with type 'mainSubmissionDate'
        await this.prismaService.conferenceDates.create({
          data: {
            name,
            type: 'mainSubmissionDate',
            organizedId,
            isAvailable: true,
            // fromDate and toDate can be null for this classification type
          },
        });
      }
    }
  }

  /**
   * Get all main submission date names
   */
  async getMainSubmissionDateNames(): Promise<string[]> {
    const dates = await this.prismaService.conferenceDates.findMany({
      distinct: ['name'],
      where: {
        type: 'mainSubmissionDate',
      },
      select: {
        name: true,
      },
    });
    return dates.map((d) => d.name);
  }
}
