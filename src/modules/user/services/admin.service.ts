import { Injectable } from '@nestjs/common';
import { PrismaService, LoggerService } from '../../common';
import * as crypto from 'crypto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly logService: LoggerService,
  ) {
    this.initializeAdmin();
  }

  async initializeAdmin() {
    const count = await this.prismaService.users.count();
    if (count > 0) {
      this.logService.info('Admin already exists');
      return;
    }
    const hashedPassword = crypto
      .createHash('sha256')
      .update('adminpassword')
      .digest('hex');
    await this.prismaService.admins.create({
      data: {
        email: 'admin@admin.com',
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
        fullName: 'Admin',
      },
    });
    this.logService.info('Admin created successfully');
  }

  async getAdmin() {
    return await this.prismaService.admins.findFirst({});
  }

  async getAdminById(id: string) {
    return await this.prismaService.admins.findUnique({
      where: {
        id,
      },
    });
  }

  async getAdminByEmail(email: string) {
    return await this.prismaService.admins.findUnique({
      where: {
        email,
      },
    });
  }
  async loginAdmin() {}

  async registerAdmin() {}
}
