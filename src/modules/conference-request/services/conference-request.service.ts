import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/common';
import { ConferencePostRequestDTO } from '../models/conference-request.dto';

@Injectable()
export class ConferenceRequestService {
  constructor(private readonly prismaService: PrismaService) {}

  async getConferenceRequestsById(
    id: string,
  ): Promise<ConferencePostRequestDTO | null> {
    const request = await this.prismaService.conferencePostRequests.findUnique({
      where: { id },
      include: {
        byUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        byAdmin: true,
        belongsTo: true,
      },
    });
    if (!request) {
      return null;
    }
    return {
      id: request.id,
      conferenceId: request.conferenceId,
      userId: request.userId,
      adminId: request.adminId,
      status: request.status,
      message: request.message,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      conference: {
        id: request.belongsTo.id,
        title: request.belongsTo.title,
        acronym: request.belongsTo.acronym,
      },
      user: {
        id: request.byUser.id,
        email: request.byUser.email,
        firstName: request.byUser.firstName,
        lastName: request.byUser.lastName,
      },
      admin: request.byAdmin
        ? {
            id: request.byAdmin.id,
            email: request.byAdmin.email,
            fullName: request.byAdmin.fullName,
          }
        : null,
    };
  }

  async getConferenceRequestsByUserId(
    userId: string,
    status?: string,
  ): Promise<ConferencePostRequestDTO[]> {
    const requests = await this.prismaService.conferencePostRequests.findMany({
      where: { userId, status },
      orderBy: { createdAt: 'desc' },
      include: {
        byUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        byAdmin: true,
        belongsTo: true,
      },
    });

    return requests.map((request) => ({
      id: request.id,
      conferenceId: request.conferenceId,
      userId: request.userId,
      adminId: request.adminId,
      status: request.status,
      message: request.message,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      conference: {
        id: request.belongsTo.id,
        title: request.belongsTo.title,
        acronym: request.belongsTo.acronym,
      },
      user: {
        id: request.byUser.id,
        email: request.byUser.email,
        firstName: request.byUser.firstName,
        lastName: request.byUser.lastName,
      },
      admin: request.byAdmin
        ? {
            id: request.byAdmin.id,
            email: request.byAdmin.email,
            fullName: request.byAdmin.fullName,
          }
        : null,
    }));
  }
}
