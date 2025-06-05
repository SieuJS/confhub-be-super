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
          byUser: true,
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

      // Send email to each follower
      for (const follower of followers) {
        const htmlContent = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Conference Update</title>
            <style>
              body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #f4f6f8;
                margin: 0;
                padding: 20px;
              }

              .container {
                max-width: 600px;
                margin: auto;
                background: #fff;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
                padding: 30px;
              }

              h1 {
                font-size: 24px;
                color: #333;
                margin-bottom: 20px;
              }

              .section-title {
                margin-top: 30px;
                font-size: 18px;
                color: #2c3e50;
                border-bottom: 2px solid #e0e0e0;
                padding-bottom: 5px;
              }

              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 15px;
                background-color: #fff;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                border-radius: 8px;
                overflow: hidden;
              }

              th, td {
                text-align: left;
                padding: 16px;
                border-bottom: 1px solid #e0e0e0;
              }

              th {
                background-color: #f8f9fa;
                font-weight: 600;
                color: #2c3e50;
                text-transform: uppercase;
                font-size: 14px;
                letter-spacing: 0.5px;
              }

              td {
                color: #4a5568;
                font-size: 15px;
                line-height: 1.5;
              }

              tr:last-child td {
                border-bottom: none;
              }

              tr:hover td {
                background-color: #f8f9fa;
              }

              /* Column widths */
              th:nth-child(1), td:nth-child(1) {
                width: 40%;
              }

              th:nth-child(2), td:nth-child(2),
              th:nth-child(3), td:nth-child(3) {
                width: 30%;
              }

              /* Center align date columns */
              th:nth-child(2), td:nth-child(2),
              th:nth-child(3), td:nth-child(3) {
                text-align: center;
              }

              /* Add subtle border to the right of each cell except the last one */
              th:not(:last-child), td:not(:last-child) {
                border-right: 1px solid #e0e0e0;
              }

              /* Style for TBD dates */
              td:empty::after {
                content: 'TBD';
                color: #a0aec0;
                font-style: italic;
              }

              .location {
                margin-top: 20px;
                font-size: 16px;
                line-height: 1.5;
              }

              .button {
                display: inline-block;
                margin-top: 25px;
                padding: 12px 24px;
                background-color: #0077cc;
                color: white;
                text-decoration: none;
                border-radius: 4px;
                font-weight: 500;
                transition: background-color 0.2s ease;
              }

              .button:hover {
                background-color: #005fa3;
              }

              .info-section {
                margin-top: 20px;
                padding: 15px;
                background-color: #f8f9fa;
                border-radius: 6px;
              }

              .info-section p {
                margin: 8px 0;
                line-height: 1.5;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Hello ${follower.byUser.firstName}!</h1>
              <p><strong>Conference Update:</strong> ${conference.title}</p>

              <div class="section-title">Dates</div>
              <table>
                <tr>
                  <th>Event</th>
                  <th>From</th>
                  <th>To</th>
                </tr>
                ${conferenceDates
                  .map(
                    (date) => `
                  <tr>
                    <td>${date.name || 'Main Event'}</td>
                    <td>${date.fromDate ? new Date(date.fromDate).toLocaleDateString() : 'TBD'}</td>
                    <td>${date.toDate ? new Date(date.toDate).toLocaleDateString() : 'TBD'}</td>
                  </tr>
                `,
                  )
                  .join('')}
              </table>

              <div class="location">
                <strong>Location:</strong><br />
                ${locations.map(loc => 
                  `${loc.address || ''} ${loc.cityStateProvince || ''} ${loc.country || ''}`
                ).join(', ')}
              </div>

              <div class="info-section">
                <p><strong>Website:</strong> <a href="${latestOrg.link}" target="_blank">${latestOrg.link}</a></p>
                <p><strong>Description:</strong> ${latestOrg.summerize || 'No description available'}</p>
              </div>

              <a href="${latestOrg.link}" class="button" target="_blank">View More Details</a>
            </div>
          </body>
          </html>
        `;

        await this.emailService.sendUpdatedConferenceEmail(
          follower.byUser.email,
          follower.byUser.firstName,
          htmlContent,
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
