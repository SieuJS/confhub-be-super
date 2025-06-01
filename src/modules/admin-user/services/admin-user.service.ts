import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from 'src/modules/common';
import {
  AdminUserParams,
  CreateAdminDto,
  UpdateAdminStatusDto,
  BanUserDto,
} from '../models/admin-user.dto';
import { createHash } from 'crypto';
import { Prisma } from '../../../../generated/prisma_client';

@Injectable()
export class AdminUserService {
  constructor(private readonly prismaService: PrismaService) {}

  private hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex');
  }

  async getUsers(params: AdminUserParams, page: number, perPage: number) {
    const where: Prisma.UsersWhereInput = {
      ...(params.search && {
        OR: [
          {
            email: {
              contains: params.search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            firstName: {
              contains: params.search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            lastName: {
              contains: params.search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        ],
      }),
      ...(params.status && { isBanned: params.status === 'banned' }),
      ...(params.startDate && {
        createdAt: { gte: new Date(params.startDate) },
      }),
      ...(params.endDate && { createdAt: { lte: new Date(params.endDate) } }),
      ...(params.role && { role: params.role }),
    };

    const [users, total] = await Promise.all([
      this.prismaService.users.findMany({
        where,
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { createdAt: 'desc' },
      }),
      this.prismaService.users.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async getUserById(id: string) {
    const user = await this.prismaService.users.findUnique({
      where: { id },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    return user;
  }

  async banUser(userId: string, banUserDto: BanUserDto) {
    const user = await this.prismaService.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    return this.prismaService.users.update({
      where: { id: userId },
      data: { isBanned: banUserDto.isBanned },
    });
  }

  async getAdmins(params: AdminUserParams, page: number, perPage: number) {
    const where: Prisma.AdminsWhereInput = {
      ...(params.search && {
        OR: [
          {
            email: {
              contains: params.search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            fullName: {
              contains: params.search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        ],
      }),
      ...(params.status && { isActive: params.status === 'active' }),
    };

    const [admins, total] = await Promise.all([
      this.prismaService.admins.findMany({
        where,
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { createdAt: 'desc' },
      }),
      this.prismaService.admins.count({ where }),
    ]);

    return {
      data: admins,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async createAdmin(createAdminDto: CreateAdminDto) {
    const existingAdmin = await this.prismaService.admins.findUnique({
      where: { email: createAdminDto.email },
    });

    if (existingAdmin) {
      throw new HttpException('Admin already exists', HttpStatus.CONFLICT);
    }

    const hashedPassword = this.hashPassword(createAdminDto.password);

    return this.prismaService.admins.create({
      data: {
        email: createAdminDto.email,
        password: hashedPassword,
        fullName: createAdminDto.fullName,
      },
    });
  }

  async updateAdminStatus(
    adminId: string,
    updateAdminStatusDto: UpdateAdminStatusDto,
  ) {
    const admin = await this.prismaService.admins.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new HttpException('Admin not found', HttpStatus.NOT_FOUND);
    }

    return this.prismaService.admins.update({
      where: { id: adminId },
      data: { isActive: updateAdminStatusDto.isActive },
    });
  }
}
