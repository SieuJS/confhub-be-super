import { HttpException, Injectable, HttpStatus } from '@nestjs/common';
import { UserInput } from '../models/user.input';
import { PrismaService } from '../../common';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { TransactionHost } from '@nestjs-cls/transactional';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from 'generated/prisma_client';
import { UserDTO } from '../models/user.dto';
import { UpdateUserDto } from '../models/update-user.dto';

@Injectable()
export class UserService {
  constructor(
    private prismaService: PrismaService,
    private txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
    private jwtService: JwtService,
  ) {}

  async getAllUsers() {
    return await this.txHost.tx.users.findMany();
  }

  async getUserByEmail(email: string | undefined): Promise<UserDTO | null> {
    const user = await this.prismaService.users.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    const verification = await this.prismaService.userVerification.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return {
      ...user,
      isVerified: verification?.isVerified ?? false,
    } as UserDTO;
  }

  async getUserById(id: string): Promise<UserDTO> {
    const user = await this.prismaService.users.findUnique({
      where: { id },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    const verification = await this.prismaService.userVerification.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return {
      ...user,
      isVerified: verification?.isVerified ?? false,
    } as UserDTO;
  }

  async getUserVerificationStatus(userId: string) {
    return await this.txHost.tx.userVerification.findFirst({
      where: {
        userId,
        isValid: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getUserInterestedTopics(userId: string) {
    const topics = await this.txHost.tx.topicUserInteresteds.findMany({
      where: {
        userId,
      },
      include: {
        inTopic: true,
      },
    });

    return topics.map((topic) => topic.inTopic.name);
  }

  async createUser(input: UserInput): Promise<UserDTO> {
    const user = await this.prismaService.users.create({
      data: input,
    });

    return {
      ...user,
      isVerified: false,
    } as UserDTO;
  }

  async updateUser(id: string, input: UpdateUserDto): Promise<UserDTO> {
    const { interestedTopics, ...updateData } = input;

    const user = await this.prismaService.users.update({
      where: { id },
      data: updateData,
    });

    if (interestedTopics) {
      await this.updateUserInterestedTopics(id, interestedTopics);
    }

    const verification = await this.prismaService.userVerification.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return {
      ...user,
      isVerified: verification?.isVerified ?? false,
    } as UserDTO;
  }

  async updateUserInterestedTopics(userId: string, topicNames: string[]) {
    // Delete existing interested topics for the user
    await this.txHost.tx.topicUserInteresteds.deleteMany({
      where: {
        userId,
      },
    });

    // For each topic name, find or create the topic, then associate it with the user
    for (const name of topicNames) {
      // Find existing topic or create a new one
      let topic = await this.txHost.tx.topics.findFirst({
        where: { name },
      });

      if (!topic) {
        // Create the topic if it doesn't exist
        topic = await this.txHost.tx.topics.create({
          data: { name },
        });
      }

      // Create the association between user and topic
      await this.txHost.tx.topicUserInteresteds.create({
        data: {
          userId,
          topicId: topic.id,
        },
      });
    }

    return this.getUserInterestedTopics(userId);
  }

  async followConference(userId: string, conferenceId: string) {
    const conference = await this.txHost.tx.conferences.findUnique({
      where: {
        id: conferenceId,
      },
    });
    if (!conference) {
      throw new HttpException('Conference not found', 400);
    }
    const follow = await this.txHost.tx.conferenceFollows.create({
      data: {
        userId,
        conferenceId,
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
    return follow;
  }

  async unfollowConference(userId: string, conferenceId: string) {
    const follow = await this.txHost.tx.conferenceFollows.findFirst({
      where: {
        userId,
        conferenceId,
      },
    });
    if (!follow) {
      return;
    }
    return await this.prismaService.conferenceFollows.delete({
      where: {
        conferenceId_userId: {
          userId,
          conferenceId,
        },
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

  async getFollowedConferences(userId: string) {
    return await this.txHost.tx.conferenceFollows.findMany({
      where: {
        userId,
      },
    });
  }

  async addToCalendar(userId: string, conferenceId: string) {
    return await this.txHost.tx.conferenceCalendars.create({
      data: {
        userId,
        conferenceId,
      },
    });
  }

  async removeFromCalendar(userId: string, conferenceId: string) {
    return await this.txHost.tx.conferenceCalendars.delete({
      where: {
        conferenceId_userId: {
          userId,
          conferenceId,
        },
      },
    });
  }

  async generateToken(userId: string) {
    const user = await this.prismaService.users.findUnique({
      where: {
        id: userId,
      },
    });
    if (!user) {
      throw new HttpException('User not found', 400);
    }
    return {
      token: this.jwtService.sign({
        payload: {
          id: user.id,
          email: user.email,
          role: 'user',
        },
      }),
    };
  }

  async getSettings() {
    return await this.prismaService.users.findFirst({
      where: {
        id: 'f3fce1eb-db4a-47f6-83c4-233559b481a8',
      },
      include: {
        notificationSettings: true,
      },
    });
  }

  async getFollowedConferencesByUserId(userId: string) {
    const followed = await this.txHost.tx.conferenceFollows.findMany({
      where: {
        userId,
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

    const formatedFollowedConferences = followed.map((conference) => {
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
    });

    return formatedFollowedConferences;
  }

  async addToBlacklist(userId: string, conferenceId: string) {
    const conference = await this.txHost.tx.conferences.findUnique({
      where: {
        id: conferenceId,
      },
    });
    if (!conference) {
      throw new HttpException('Conference not found', 400);
    }

    const blacklist = await this.txHost.tx.conferenceBlacklists.create({
      data: {
        userId,
        conferenceId,
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
    return blacklist;
  }

  async removeFromBlacklist(userId: string, conferenceId: string) {
    const blacklist = await this.txHost.tx.conferenceBlacklists.findFirst({
      where: {
        userId,
        conferenceId,
      },
    });
    if (!blacklist) {
      return;
    }
    return await this.prismaService.conferenceBlacklists.delete({
      where: {
        id: blacklist.id,
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

  async getAddedBlacklistConferences(userId: string) {
    const blacklist = await this.txHost.tx.conferenceBlacklists.findMany({
      where: {
        userId,
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

    const formatedBlacklistConferences = blacklist.map((conference) => {
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
        id: conference.id,
        conferenceId: conference.conferenceId,
        title: conference.belongsTo?.title,
        acronym: conference.belongsTo?.acronym,
        creatorId: conference.belongsTo?.creatorId,
        adminId: conference.belongsTo?.adminId ?? undefined,
        createdAt: conference.createdAt,
        updatedAt: conference.updatedAt,
        status: conference.belongsTo?.status,
        dates: {
          fromDate: conferenceDates[0]?.fromDate,
          toDate: conferenceDates[0]?.toDate,
        },
        location: {
          address: firstLocation.address,
          cityStateProvince: firstLocation.cityStateProvince,
          country: firstLocation.country,
          continent: firstLocation.continent,
        },
      };
    });

    return formatedBlacklistConferences;
  }
}
