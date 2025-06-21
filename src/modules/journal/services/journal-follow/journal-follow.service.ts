import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from 'src/modules/common';
import { NotificationService } from 'src/modules/notify/services/notification.service';
import { JournalFollowInput } from '../../models/journal-follow/journal-follow.dto';
import { DEFAULT_TYPE } from 'src/modules/notify/constants/default-type';

@Injectable()
export class JournalFollowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async followJournal(
    userId: string,
    input: JournalFollowInput,
  ): Promise<void> {
    const { journalId } = input;

    // Check if journal exists
    const journal = await this.prisma.journals.findUnique({
      where: { id: journalId },
    });

    if (!journal) {
      throw new HttpException('Journal not found', HttpStatus.NOT_FOUND);
    }

    // Check if already following
    const existingFollow = await this.prisma.journalFollows.findFirst({
      where: {
        userId,
        journalId,
      },
    });

    if (existingFollow) {
      throw new HttpException(
        'Already following this journal',
        HttpStatus.CONFLICT,
      );
    }

    // Create follow record
    await this.prisma.journalFollows.create({
      data: {
        userId,
        journalId,
      },
    });

    // Send notification
    const noti = await this.notificationService.createConferenceNotification({
      userId,
      message: `You are now following ${journal.title}`,
      type: DEFAULT_TYPE.JOURNAL_FOLLOWED,
      isRead: false,
      isDeleted: false,
      isImportant: false,
      journalId: journalId,
    });

    try {
      await this.notificationService.sendNotificationToUser(noti, userId);
    } catch {
      /* empty */
    }
    return;
  }

  async unfollowJournal(
    userId: string,
    input: JournalFollowInput,
  ): Promise<{ message: string }> {
    const { journalId } = input;

    // Check if following
    const existingFollow = await this.prisma.journalFollows.findFirst({
      where: {
        userId,
        journalId,
      },
    });

    if (!existingFollow) {
      throw new HttpException(
        'Not following this journal',
        HttpStatus.NOT_FOUND,
      );
    }

    // Delete follow record
    await this.prisma.journalFollows.delete({
      where: {
        id: existingFollow.id,
      },
    });

    return { message: 'Successfully unfollowed journal' };
  }

  async getFollowedJournals(userId: string) {
    return this.prisma.journalFollows.findMany({
      where: {
        userId,
      },
      include: {
        belongsTo: {
          include: {
            JournalDetails: true,
            JournalAuthorInformations: true,
            JournalAreas: true,
            JournalTopics: {
              include: {
                inTopic: true,
              },
            },
            quartiles: true,
            JournalBioxBio: true,
            JournalStatistics: true,
          },
        },
      },
    });
  }

  async getJournalFollowers(journalId: string) {
    return this.prisma.journalFollows.findMany({
      where: {
        journalId,
      },
      include: {
        byUser: true,
      },
    });
  }
}
