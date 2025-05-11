import { ConferenceDTO } from '../models/conference/conference.dto';

export const emailUpdate = (conference: ConferenceDTO) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Conference Update Notification</title>
      <style>
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          line-height: 1.6;
          color: #2c3e50;
          margin: 0;
          padding: 0;
          background-color: #f8f9fa;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .header {
          background-color: #2c3e50;
          padding: 30px 20px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }
        .content {
          padding: 40px 30px;
        }
        .update-title {
          color: #2c3e50;
          font-size: 22px;
          margin-bottom: 25px;
          font-weight: 600;
        }
        .update-details {
          background-color: #f8f9fa;
          padding: 25px;
          border-radius: 6px;
          margin: 25px 0;
          border: 1px solid #e9ecef;
        }
        .update-detail {
          margin: 15px 0;
          color: #495057;
        }
        .update-detail strong {
          color: #2c3e50;
          font-weight: 600;
        }
        .button {
          display: inline-block;
          padding: 14px 28px;
          background-color: #2c3e50;
          color: #ffffff;
          text-decoration: none;
          border-radius: 6px;
          margin: 25px 0;
          font-weight: 500;
          transition: background-color 0.3s ease;
        }
        .button:hover {
          background-color: #34495e;
        }
        .footer {
          text-align: center;
          padding: 25px;
          font-size: 13px;
          color: #6c757d;
          border-top: 1px solid #e9ecef;
          background-color: #f8f9fa;
          border-radius: 0 0 8px 8px;
        }
        .footer p {
          margin: 5px 0;
        }
        .greeting {
          font-size: 16px;
          color: #495057;
          margin-bottom: 20px;
        }
        .closing {
          margin-top: 30px;
          color: #495057;
        }
        .highlight {
          color: #2c3e50;
          font-weight: 500;
        }
        .update-section {
          margin: 20px 0;
          padding: 15px;
          background-color: #fff;
          border-left: 4px solid #2c3e50;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Conference Update Notification</h1>
        </div>
        <div class="content">
          <div class="greeting">Dear Valued Conference Participant,</div>
          
          <p>We are writing to inform you about important updates regarding the conference you are following.</p>
          
          <div class="update-section">
            <h2 class="update-title">${conference.title}</h2>
            
            <div class="update-details">
              ${
                conference.dates
                  ? `
                <div class="update-detail">
                  <strong>Updated Schedule:</strong><br>
                  ${conference.dates.fromDate ? new Date(conference.dates.fromDate).toLocaleDateString() : 'To be determined'} 
                  ${conference.dates.toDate ? ` - ${new Date(conference.dates.toDate).toLocaleDateString()}` : ''}
                </div>
              `
                  : ''
              }
              
              ${
                conference.location
                  ? `
                <div class="update-detail">
                  <strong>Updated Venue:</strong><br>
                  ${conference.location.address ? `${conference.location.address}, ` : ''}
                  ${conference.location.cityStateProvince ? `${conference.location.cityStateProvince}, ` : ''}
                  ${conference.location.country ? `${conference.location.country}` : ''}
                </div>
              `
                  : ''
              }
              
              ${
                conference.topics && conference.topics.length > 0
                  ? `
                <div class="update-detail">
                  <strong>Conference Topics:</strong><br>
                  ${conference.topics.join(', ')}
                </div>
              `
                  : ''
              }
            </div>
          </div>

          <p class="closing">
            Please review these updates carefully as they may affect your participation plans. 
            We recommend checking the conference website for the most up-to-date information.
          </p>

          <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL}/conferences/detail?id=${conference.id}" class="button">View Updated Details</a>
          </div>

          <p class="closing">
            If you have any questions or require clarification regarding these updates, 
            please do not hesitate to contact our support team.
          </p>

          <p class="closing">
            Best regards,<br>
            <span class="highlight">The ConfHub Team</span>
          </p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>© ${new Date().getFullYear()} ConfHub. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};
