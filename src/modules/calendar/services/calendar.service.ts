import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/common';
import { CalendarEvent } from '../models/calendar-event.dto';
import { ConferenceService } from 'src/modules/conference/services/conference.service';

@Injectable()
export class CalendarService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly conferenceService: ConferenceService,
  ) {}

  async getCalendarEventsByUserId(
    userId: string,
  ): Promise<CalendarEvent[] | null> {
    const calendar = await this.prismaService.conferenceCalendars.findMany({
      where: {
        userId: userId,
      },
    });
    const calendarEvents: CalendarEvent[] = [];

    for (const event of calendar) {
      const conference =
        await this.conferenceService.getConferenceByIdWithDetail(
          event.conferenceId,
        );
      const conf = await this.prismaService.conferences.findFirst({
        where: {
          id: event.conferenceId,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      if (conf && conference && conference.organizations) {
        conference.organizations?.pop()?.conferenceDates?.forEach((date) => {
          // Check for null values on date properties
          if (date && date.fromDate && date.toDate) {
            const fromDate = new Date(date.fromDate);
            const toDate = new Date(date.toDate);

            if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
              console.error(
                `[ERROR] Invalid date format for conference ${conf.id}, date:`,
                date,
              );
              return;
            }

            const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            console.log(`[13] Date difference in days: ${diffDays}`);

            if (diffDays > 0) {
              for (let i = 0; i <= diffDays; i++) {
                const currentDate = new Date(fromDate);
                currentDate.setDate(fromDate.getDate() + i);
                console.log(
                  `[14] Adding event for date: ${currentDate.toLocaleDateString()}`,
                );
                calendarEvents.push({
                  day: currentDate.getDate(),
                  month: currentDate.getMonth(),
                  year: currentDate.getFullYear(),
                  type: date.type,
                  conference: conf.title,
                  conferenceId: conf.id,
                  name: date.name || 'Conference Date',
                });
              }
            } else {
              console.log(
                `[14] Adding single-day event for date: ${fromDate.toLocaleDateString()}`,
              );
              calendarEvents.push({
                day: fromDate.getDate(),
                month: fromDate.getMonth(),
                year: fromDate.getFullYear(),
                type: date.type,
                conference: conf.title,
                conferenceId: conf.id,
                name: date.name || 'Conference Date',
              });
            }
          } else {
            console.warn(
              `[WARN] Skipping date for conference ${conf.id} due to missing fromDate or toDate`,
            );
          }
        });
      }
    }
    return calendarEvents;
  }

  async addEvent(userId: string, conferenceId: string) {
    return await this.prismaService.conferenceCalendars.create({
      data: {
        userId: userId,
        conferenceId: conferenceId,
      },
      include: {
        belongsTo: {
          select: {
            title: true,
            acronym: true,
          },
        },
      },
    });
  }

  async removeEvent(userId: string, conferenceId: string) {
    const event = await this.prismaService.conferenceCalendars.findFirst({
      where: {
        userId: userId,
        conferenceId: conferenceId,
      },
    });
    if (!event) {
      return;
    }
    return await this.prismaService.conferenceCalendars.delete({
      where: {
        id: event.id,
      },
      include: {
        belongsTo: {
          select: {
            title: true,
            acronym: true,
          },
        },
      },
    });
  }

  async getConferenceCalendarByUserId(userId: string) {
    const calendarConferences =
      await this.prismaService.conferenceCalendars.findMany({
        where: {
          userId: userId,
        },
        include: {
          belongsTo: {
            include: {
              organizations: {
                include: {
                  conferenceDates: {
                    where: {
                      name: 'Conference Date',
                    },
                  },
                  locations: true,
                },
              },
            },
          },
        },
      });
    const formatedFollowedConferences = calendarConferences.map(
      (conference) => {
        // Get the latest organization
        const latestOrg =
          conference.belongsTo?.organizations?.[
            conference.belongsTo?.organizations?.length - 1
          ];

        // Format conference dates
        const conferenceDates =
          latestOrg?.conferenceDates?.map((date) => ({
            fromDate: date.fromDate,
            toDate: date.toDate,
          })) || [];

        // Format locations
        const locations =
          latestOrg?.locations?.map((location) => ({
            address: location.address ?? undefined,
            cityStateProvince: location.cityStateProvince ?? undefined,
            country: location.country ?? undefined,
            continent: location.continent ?? undefined,
          })) || [];

        // Get the first location if available
        const firstLocation = locations[0] || {};

        return {
          id: conference.conferenceId,
          title: conference.belongsTo?.title,
          acronym: conference.belongsTo?.acronym,
          creatorId: conference.belongsTo?.creatorId,
          adminId: conference.belongsTo?.adminId ?? undefined,
          followedAt: conference.createdAt,
          updatedAt: conference.updatedAt,
          status: conference.belongsTo?.status,
          dates: conferenceDates,
          location: {
            address: firstLocation.address,
            cityStateProvince: firstLocation.cityStateProvince,
            country: firstLocation.country,
            continent: firstLocation.continent,
          },
        };
      },
    );
    return formatedFollowedConferences;
  }
}
