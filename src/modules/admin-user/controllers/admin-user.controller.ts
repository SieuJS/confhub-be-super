import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  DefaultValuePipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminUserService } from '../services/admin-user.service';
import {
  AdminUserParams,
  CreateAdminDto,
  UpdateAdminStatusDto,
  BanUserDto,
} from '../models/admin-user.dto';
import { JWTGuardAdmin } from 'src/modules/auth/guards/jwt.guard';

@ApiTags('admin-user')
@Controller('admin/users')
@UseGuards(JWTGuardAdmin)
@ApiBearerAuth('access-token')
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) {}

  @Get()
  @ApiOperation({ summary: 'Get list of users with filters' })
  @ApiResponse({
    status: 200,
    description: 'List of users retrieved successfully',
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  async getUsers(
    @Query() params: AdminUserParams,
    @Query('page', new DefaultValuePipe(1)) page: number,
    @Query('perPage', new DefaultValuePipe(10)) perPage: number,
  ) {
    return this.adminUserService.getUsers(params, page, perPage);
  }

  @Patch(':id/ban')
  @ApiOperation({ summary: 'Ban/Unban a user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: BanUserDto })
  @ApiResponse({
    status: 200,
    description: 'User ban status updated successfully',
  })
  @UseGuards(JWTGuardAdmin)
  @ApiBearerAuth('access-token')
  @ApiResponse({ status: 404, description: 'User not found' })
  async banUser(@Param('id') id: string, @Body() data: BanUserDto) {
    return this.adminUserService.banUser(id, data);
  }

  @Get('admins')
  @ApiOperation({ summary: 'Get list of admins with filters' })
  @ApiResponse({
    status: 200,
    description: 'List of admins retrieved successfully',
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  async getAdmins(
    @Query() params: AdminUserParams,
    @Query('page', new DefaultValuePipe(1)) page: number,
    @Query('perPage', new DefaultValuePipe(10)) perPage: number,
  ) {
    return this.adminUserService.getAdmins(params, page, perPage);
  }

  @Post('admins')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new admin account' })
  @ApiBody({ type: CreateAdminDto })
  @ApiResponse({
    status: 201,
    description: 'Admin account created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Admin with this email already exists',
  })
  @UseGuards(JWTGuardAdmin)
  async createAdmin(@Body() data: CreateAdminDto) {
    return this.adminUserService.createAdmin(data);
  }

  @Patch('admins/:id/status')
  @ApiOperation({ summary: 'Update admin account status' })
  @ApiParam({ name: 'id', description: 'Admin ID' })
  @ApiBody({ type: UpdateAdminStatusDto })
  @ApiResponse({
    status: 200,
    description: 'Admin status updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  async updateAdminStatus(
    @Param('id') id: string,
    @Body() data: UpdateAdminStatusDto,
  ) {
    return this.adminUserService.updateAdminStatus(id, data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user details by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('id') id: string) {
    return this.adminUserService.getUserById(id);
  }
}
