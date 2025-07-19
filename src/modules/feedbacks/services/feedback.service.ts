import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/common';
import { FeedBackDTO } from '../models/feedback.dto';
import { FeedbackInputDTO } from '../models/feedback.input.dto';

@Injectable()
export class FeedbackService {
  constructor(private prismaService: PrismaService) {}

  async createFeedback(input: FeedbackInputDTO, userId: string) {
    return this.prismaService.conferenceFeedbacks.create({
      data: {
        ...input,
        creatorId: userId,
      },
    });
  }
  async getFeedbacksByConferenceId(
    conferenceId: string,
  ): Promise<FeedBackDTO[]> {
    const feedbacks = await this.prismaService.conferenceFeedbacks.findMany({
      where: {
        conferenceId,
      },
      include: {
        byUser: {
          select: {
            avatar: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const results = feedbacks.map((feedback): FeedBackDTO => {
      return {
        id: feedback.id,
        creatorId: feedback.creatorId,
        conferenceId: feedback.conferenceId,
        description: feedback.description,
        star: feedback.star,
        createdAt: feedback.createdAt,
        updatedAt: feedback.updatedAt,
        avatar: feedback.byUser.avatar,
        firstName: feedback.byUser.firstName,
        lastName: feedback.byUser.lastName,
      };
    });

    return results;
  }
}
