/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/common';
import { EmailService } from 'src/modules/email-verify/services/email.service';
import { UserService } from 'src/modules/user/services/user.service';

@Injectable()
export class FollowConferenceService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly emailService: EmailService,
    private readonly userService: UserService,
  ) {}

  async notifyFollowersAboutConferenceUpdate(conferenceId: string) {
    try {
      // Get all users following this conference
      const followers = await this.prismaService.conferenceFollows.findMany({
        where: {
          conferenceId: conferenceId,
        },
        include: {
          belongsTo: true,
        },
      });

      // Get conference details
      const conference = await this.prismaService.conferences.findUnique({
        where: {
          id: conferenceId,
        },
        include: {
          organizations: {
            include: {
              conferenceDates: true,
              locations: true,
            },
          },
        },
      });

      if (!conference) {
        throw new Error('Conference not found');
      }

      // Get the latest organization
      const latestOrg =
        conference.organizations[conference.organizations.length - 1];
      const conferenceDates = latestOrg?.conferenceDates || [];
      const locations = latestOrg?.locations || [];

      // Prepare email content
      const emailContent = `
                <h2>Conference Update: ${conference.title}</h2>
                <p>The conference you are following has been updated with new information:</p>
                <ul>
                    ${
                      conferenceDates.length > 0
                        ? `
                        <li>
                          <strong>Dates:</strong>
                          <table style="border-collapse: collapse; margin-top: 5px;">
                            <thead>
                              <tr>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Event</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">From</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">To</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${conferenceDates
                                .map(
                                  (date) => `
                                <tr>
                                  <td style="border: 1px solid #ddd; padding: 8px;">${date.name || 'Main Event'}</td>
                                  <td style="border: 1px solid #ddd; padding: 8px;">${date.fromDate ? new Date(date.fromDate).toLocaleDateString() : 'TBD'}</td>
                                  <td style="border: 1px solid #ddd; padding: 8px;">${date.toDate ? new Date(date.toDate).toLocaleDateString() : 'TBD'}</td>
                                </tr>
                              `,
                                )
                                .join('')}
                            </tbody>
                          </table>
                        </li>
                    `
                        : ''
                    }
                    ${
                      locations.length > 0
                        ? `
                        <li><strong>Location:</strong> ${locations
                          .map(
                            (loc) =>
                              `${loc.address || ''} ${loc.cityStateProvince || ''} ${loc.country || ''}`,
                          )
                          .join(', ')}</li>
                    `
                        : ''
                    }
                </ul>
                <p>Visit our platform to see all the updates and more details about this conference.</p>
            `;

      // Send email to each follower
      for (const follower of followers) {
        const user = await this.userService.getUserById(follower.userId);
        if (user && user.email) {
          await this.emailService.sendUpdatedConferenceEmail(
            user.email,
            user.firstName || 'User',
            emailContent,
          );
        }
      }

      return {
        success: true,
        message: `Notification emails sent to ${followers.length} followers`,
      };
    } catch (error) {
      console.error('Error sending conference update notifications:', error);
      throw error;
    }
  }
}
