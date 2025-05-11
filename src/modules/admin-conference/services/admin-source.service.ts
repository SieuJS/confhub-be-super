import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/common';

@Injectable()
export class AdminSourceService {
  constructor(private readonly prismaService: PrismaService) {}

  async getSourcesForConference(conferenceId: string) {
    const queryResult = await this.prismaService.conferenceRanks.findMany({
      where: {
        conferenceId: conferenceId,
      },
      include: {
        byRank: {
          include: {
            belongsToSource: true,
          },
        },
      },
    });
  }
}
