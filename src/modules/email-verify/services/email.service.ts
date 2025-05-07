import { Inject, Injectable } from '@nestjs/common';
import * as brevo from '@getbrevo/brevo';
import { Service } from 'src/modules/tokens';
import { Config, LoggerService, PrismaService } from 'src/modules/common';
@Injectable()
export class EmailService {
    private brevoClient: brevo.TransactionalEmailsApi
  constructor(
    @Inject(Service.CONFIG) private readonly config: Config,
    private prismaService: PrismaService,
    private logger: LoggerService,

  ) {
    this.isExistsSetting()
      .then( async (setting) => {
        const newBrevo = new brevo.TransactionalEmailsApi();
        if (setting) {
          newBrevo.setApiKey(
            brevo.TransactionalEmailsApiApiKeys.apiKey,
            setting.apiKey,
          );
        } else {
          this.logger.info('Create new Brevo setting...');
          await prismaService.emailSettings.create({
            data: {
              apiKey: this.config.BREVO_API_KEY,
              senderEmail: this.config.SENDER_EMAIL,
              senderName: this.config.SENDER_NAME,
            },
          });
          newBrevo.setApiKey(
            brevo.TransactionalEmailsApiApiKeys.apiKey,
            config.BREVO_API_KEY,
          );
        }
        return newBrevo;
      })
      .then((brevoClient) => {
        this.brevoClient = brevoClient;
        this.logger.info('Initial Email successful');
      })
      .catch((error) => {
        this.logger.error('Error initializing Brevo client: ' + error);
      });
  }

  async isExistsSetting() {
    const setting = await this.prismaService.emailSettings.findFirst();
    return setting;
  }

  async getSender() {
    const setting = await this.prismaService.emailSettings.findFirst();
    if (setting) {
      return {
        senderEmail: setting.senderEmail,
        senderName: setting.senderName,
      };
    } else {
      this.logger.error('Brevo setting not found');
      throw new Error('Brevo setting not found');
    }
  }

  async sendEmailVerification(
    toEmail: string,
    firstName: string,
    verificationCode: string,
  ) {
    const sendSmtpEmail = new brevo.SendSmtpEmail(); // <<< Sử dụng brevo import
    const { senderEmail, senderName } = await this.getSender();
    const apiInstance = this.brevoClient;
    const setting = await this.isExistsSetting();
    if (!setting) {
      this.logger.error('Brevo setting not found');
      throw new Error('Brevo setting not found');
    }
    apiInstance.setApiKey(
        brevo.TransactionalEmailsApiApiKeys.apiKey,
        setting.apiKey,
    )
    sendSmtpEmail.subject = 'Verify Your Account - Your App Name'; // <<< Thay đổi Subject nếu cần
    sendSmtpEmail.htmlContent = `
        <html>
            <body>
                <h1>Welcome to Your App Name, ${firstName}!</h1>
                <p>Thank you for registering. Please use the following code to verify your email address:</p>
                <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 20px 0; padding: 10px; background-color: #f0f0f0; display: inline-block;">
                    ${verificationCode}
                </p>
                <p>This code will expire in 15 minutes.</p>
                <p>If you did not request this registration, please ignore this email.</p>
                <br/>
                <p>Thanks,</p>
                <p>The Your App Name Team</p>
            </body>
        </html>
    `; // <<< Tùy chỉnh nội dung HTML

    sendSmtpEmail.sender = { name: senderName, email: senderEmail };
    sendSmtpEmail.to = [{ email: toEmail, name: firstName }];
    // sendSmtpEmail.cc = [{ email: "example2@example2.com", name: "Janice Doe" }];
    // sendSmtpEmail.bcc = [{ email: "example3@example2.com", name: "John Doe" }];
    // sendSmtpEmail.replyTo = { email: "replyto@domain.com", name: "Reply Name" };
    // sendSmtpEmail.headers = {"Some-Custom-Name": "unique-id-1234"};
    // sendSmtpEmail.params = {"parameter": "My param value", "subject": "New Subject"};

    try {
      // Sử dụng apiInstance đã được cấu hình ở trên
      const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
      // Log data trả về từ Brevo có thể hữu ích khi debug
    } catch (error: any) {
      // Log chi tiết lỗi từ Brevo nếu có
      console.error('Error sending verification email via Brevo:');
      if (error.response) {
        // Lỗi từ API Brevo (có response body)
        console.error('Status:', error.response.status);
        console.error('Body:', error.response.body || error.response.text); // Log body hoặc text
      } else {
        // Lỗi mạng hoặc lỗi khác
        console.error('Error Message:', error.message);
      }
      // Ném lỗi để controller biết việc gửi mail thất bại và xử lý phù hợp
      throw new Error('Failed to send verification email.');
    }
  }

  async sendPasswordResetEmail(
    toEmail: string,
    resetCode: string,
    firstName: string,
  ) {
    const sendSmtpEmail = new brevo.SendSmtpEmail();
    const { senderEmail, senderName } = await this.getSender();
    const apiInstance = this.brevoClient;
    const setting = await this.isExistsSetting();
    if (!setting) {
      this.logger.error('Brevo setting not found');
      throw new Error('Brevo setting not found');
    }
    apiInstance.setApiKey(
      brevo.TransactionalEmailsApiApiKeys.apiKey,
      setting.apiKey,
    );

    sendSmtpEmail.subject = 'Reset Your Password';
    sendSmtpEmail.htmlContent = `
        <html>
            <body>
                <h1>Hello ${firstName}!</h1>
                <p>We received a request to reset your password. Please use the following code to reset your password:</p>
                <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 20px 0; padding: 10px; background-color: #f0f0f0; display: inline-block;">
                    ${resetCode}
                </p>
                <p>This code will expire in 15 minutes.</p>
                <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
                <br/>
                <p>Thanks,</p>
                <p>The Your App Name Team</p>
            </body>
        </html>
    `;

    sendSmtpEmail.sender = { name: senderName, email: senderEmail };
    sendSmtpEmail.to = [{ email: toEmail, name: firstName }];

    try {
      const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    } catch (error: any) {
      console.error('Error sending password reset email via Brevo:');
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Body:', error.response.body || error.response.text);
      } else {
        console.error('Error Message:', error.message);
      }
      throw new Error('Failed to send password reset email.');
    }
  }
}
