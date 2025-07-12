import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/common';
import { EmailService } from 'src/modules/email-verify/services/email.service';
import { NotificationService } from 'src/modules/notify/services/notification.service';
import { UserService } from 'src/modules/user/services/user.service';

@Injectable()
export class FollowConferenceService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly emailService: EmailService,
    private readonly userService: UserService,
    private readonly noficationService: NotificationService,
  ) {}

  async notifyFollowersAboutConferenceUpdate(conferenceId: string) {
    try {
      const followers = await this.prismaService.conferenceFollows.findMany({
        where: {
          conferenceId: conferenceId,
        },
        include: {
          belongsTo: true,
          byUser: true,
        },
      });

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
      console.log('send email to followers:', followers.length, 'followers');

      // Get the latest organization
      const latestOrg =
        conference.organizations[conference.organizations.length - 1];
      const conferenceDates = latestOrg?.conferenceDates || [];
      const locations = latestOrg?.locations || [];
      const linkToConference = `https://confhub.ddns.net/en/conferences/detail?id=${conference.id}`;

      // Send email to each follower
      for (const follower of followers) {
        const emailHtml = `
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif; background-color: #f4f4f4;">
            <div style="background-color: #ffffff; padding: 20px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h1 style="color: #2c3e50; margin-bottom: 20px; font-size: 24px;">Conference Update</h1>
              
              <p style="color: #4a5568; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                Dear ${follower.byUser.firstName} ${follower.byUser.lastName},
              </p>
              
              <p style="color: #4a5568; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                The conference "${conference.title}" has been updated. Here are the changes:
              </p>

              ${
                locations.length > 0
                  ? `
                <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #3182ce; border-radius: 4px;">
                  <h3 style="color: #2c3e50; margin: 0 0 10px 0; font-size: 18px;">Location Information</h3>
                  ${locations
                    .map(
                      (location) => `
                    <div style="margin-bottom: 10px;">
                      <strong style="color: #2c3e50;">Conference Venue:</strong>
                      <br>
                      <span style="color: #4a5568;">${location.address || 'Address not specified'}</span>
                      ${
                        location.cityStateProvince
                          ? `<br><span style="color: #4a5568;">${location.cityStateProvince}${
                              location.country ? `, ${location.country}` : ''
                            }</span>`
                          : ''
                      }
                    </div>
                  `,
                    )
                    .join('')}
                </div>
              `
                  : ''
              }

              <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #ffffff;">
                <tr style="background-color: #f8f9fa;">
                  <th style="padding: 12px; text-align: left; border: 1px solid #ddd; font-weight: bold; color: #2c3e50;">Event</th>
                  <th style="padding: 12px; text-align: center; border: 1px solid #ddd; font-weight: bold; color: #2c3e50;">Start Date</th>
                  <th style="padding: 12px; text-align: center; border: 1px solid #ddd; font-weight: bold; color: #2c3e50;">End Date</th>
                </tr>
                <tr>
                  <td style="padding: 12px; border: 1px solid #ddd; color: #4a5568;">Conference</td>
                  <td style="padding: 12px; border: 1px solid #ddd; text-align: center; color: #4a5568;">${conferenceDates[0]?.fromDate ? new Date(conferenceDates[0].fromDate).toLocaleDateString() : 'TBD'}</td>
                  <td style="padding: 12px; border: 1px solid #ddd; text-align: center; color: #4a5568;">${conferenceDates[0]?.toDate ? new Date(conferenceDates[0].toDate).toLocaleDateString() : 'TBD'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border: 1px solid #ddd; color: #4a5568;">Abstract Submission</td>
                  <td style="padding: 12px; border: 1px solid #ddd; text-align: center; color: #4a5568;">${conferenceDates[1]?.fromDate ? new Date(conferenceDates[1].fromDate).toLocaleDateString() : 'TBD'}</td>
                  <td style="padding: 12px; border: 1px solid #ddd; text-align: center; color: #4a5568;">${conferenceDates[1]?.toDate ? new Date(conferenceDates[1].toDate).toLocaleDateString() : 'TBD'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border: 1px solid #ddd; color: #4a5568;">Paper Submission</td>
                  <td style="padding: 12px; border: 1px solid #ddd; text-align: center; color: #4a5568;">${conferenceDates[2]?.fromDate ? new Date(conferenceDates[2].fromDate).toLocaleDateString() : 'TBD'}</td>
                  <td style="padding: 12px; border: 1px solid #ddd; text-align: center; color: #4a5568;">${conferenceDates[2]?.toDate ? new Date(conferenceDates[2].toDate).toLocaleDateString() : 'TBD'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border: 1px solid #ddd; color: #4a5568;">Review Period</td>
                  <td style="padding: 12px; border: 1px solid #ddd; text-align: center; color: #4a5568;">${conferenceDates[3]?.fromDate ? new Date(conferenceDates[3].fromDate).toLocaleDateString() : 'TBD'}</td>
                  <td style="padding: 12px; border: 1px solid #ddd; text-align: center; color: #4a5568;">${conferenceDates[3]?.toDate ? new Date(conferenceDates[3].toDate).toLocaleDateString() : 'TBD'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border: 1px solid #ddd; color: #4a5568;">Final Paper Submission</td>
                  <td style="padding: 12px; border: 1px solid #ddd; text-align: center; color: #4a5568;">${conferenceDates[4]?.fromDate ? new Date(conferenceDates[4].fromDate).toLocaleDateString() : 'TBD'}</td>
                  <td style="padding: 12px; border: 1px solid #ddd; text-align: center; color: #4a5568;">${conferenceDates[4]?.toDate ? new Date(conferenceDates[4].toDate).toLocaleDateString() : 'TBD'}</td>
                </tr>
              </table>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${linkToConference}" 
                   style="display: inline-block; 
                          background: linear-gradient(135deg, #3182ce 0%, #2b77cb 100%); 
                          color: #ffffff; 
                          text-decoration: none; 
                          padding: 14px 32px; 
                          border-radius: 8px; 
                          font-weight: 600; 
                          font-size: 16px; 
                          box-shadow: 0 4px 12px rgba(49, 130, 206, 0.3); 
                          transition: all 0.3s ease; 
                          border: none;
                          cursor: pointer;">
                  📅 View Conference Details
                </a>
                <p style="color: #718096; font-size: 14px; margin-top: 12px; margin-bottom: 0;">
                  Click the button above to see the complete conference information
                </p>
              </div>

              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                <p style="color: #718096; font-size: 14px; margin: 0;">
                  Best regards,<br>
                  ConfHub Team
                </p>
                <p style="color: #a0aec0; font-size: 12px; margin: 10px 0 0 0;">
                  You're receiving this email because you're following this conference. 
                  <a href="${linkToConference}" style="color: #3182ce; text-decoration: none;">Manage your preferences</a>
                </p>
              </div>
            </div>
          </div>
        `;
        await this.noficationService.sendEmailNotification(
          follower.byUser.id,
          emailHtml,
        );
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
