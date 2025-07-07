/* eslint-disable */
import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpException,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  Param,
  Body,
  Req,
  Patch,
  UseGuards,
  HttpStatus,
  HttpCode,
  Put,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { AdminConferenceService } from '../services/admin-conference.service';
import {
  AdminConferenceDTO,
  AdminConferenceParams,
  ConferenceHistoryDto,
} from '../models/admin-conference.dto';
import { ConferenceHistoryResponseDto } from '../models/conference-history-response.dto';
import { AdminConferenceParamsPipe } from '../pipes/admin-conference-params.pipe';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileSizeValidationPipe } from '../pipes/validation-file.pipe';
import { PrismaService } from 'src/modules/common';
import { Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { JWTGuardAdmin } from 'src/modules/auth/guards/jwt.guard';
import { ConferencePostRequestDTO, CreateConferencePostRequestDTO, UpdateConferencePostRequestDTO } from '../models/conference-request-post.dto';
import { ConferenceSaveDto } from '../models/conference-save.dto';
import { TransformDatePipe } from '../pipes/transform-date.pipe';
import { NotificationService } from 'src/modules/notify/services/notification.service';
import { DEFAULT_TYPE } from 'src/modules/notify/constants/default-type';
import { EmailService } from 'src/modules/email-verify/services/email.service';
import { RedisCacheService } from 'src/modules/common/services/redis-cache.service';
import { FollowConferenceService } from 'src/modules/follow-conference/services/follow-conference.service';

@ApiTags('admin-conference')
@Controller('admin/conferences')
// @UseGuards(JWTGuardAdmin)
@ApiBearerAuth()
export class AdminConferenceController {
  constructor(
    private readonly adminConferenceService: AdminConferenceService,
    private readonly prismaService: PrismaService,
    private readonly notificationService: NotificationService, // Inject NotificationService
    private readonly emailService : EmailService,
    private readonly cacheSearvice : RedisCacheService,
    private readonly followService : FollowConferenceService
  ) {}

  @ApiTags('get')
  @Get('get')
  getConferenceInstances(
    @Query(new AdminConferenceParamsPipe()) params: AdminConferenceParams,
    @Query('page', new DefaultValuePipe(1)) page: number,
    @Query('perPage', new DefaultValuePipe(10)) perPage: number,
  ) {
    const where = this.adminConferenceService.convertToPrismaWhereInput({
      search: params.search,
      status: params.status,
      source: params.source,
      researchFields: params.researchFields,
      ranks: params.ranks,
    });
    console.log('Where clause for Prisma:', JSON.stringify(where));
    return this.adminConferenceService.getConferenceInstances({
      where,
      orderBy: {
        updatedAt: 'desc'
      },
      include: {},
      page: page,
      perPage: perPage,
    });
  }

  @Post('/upload-file-csv')
  @Transactional<TransactionalAdapterPrisma>({
    timeout: 300000,
  })
  @UseInterceptors(FileInterceptor('file'))
  async importCSVFile(
    @UploadedFile(new FileSizeValidationPipe()) file: Express.Multer.File,
  ) {
    if (!file) {
      throw new HttpException(
        {
          message: 'file is required',
        },
        400,
      );
    }
    await this.cacheSearvice.removeAllCache();
    const admin = await this.prismaService.admins.findFirst();

    if (!admin) {
      throw new HttpException(
        {
          message: 'admin not found',
        },
        400,
      );
    }

    const data = await this.adminConferenceService.parseCSVFile(file);
    if (!data) {
      throw new HttpException(
        {
          message: 'file is empty',
        },
        400,
      );
    }
    const results: AdminConferenceDTO[] = [];
    for (const item of data) {
      const conference = await this.adminConferenceService
        .importConference(item, admin.id)
        .catch((err) => {
          console.log('error', err);
          throw new HttpException(
            {
              message: 'error when importing conference',
              error: err,
            },
            400,
          );
        });
      results.push(conference as AdminConferenceDTO);
    }

    return {
      message: 'file is imported',
      data: results,
    };
  }

  @Post('import-header-csv')

  @Transactional<TransactionalAdapterPrisma>({
    timeout: 300000,
  })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
      schema: {
        type: 'object',
        properties: {
          file: {
            type: 'string',
            format: 'binary',
            description: 'CSV file containing journal data',
          },
        },
      },
    })
  @UseInterceptors(FileInterceptor('file'))
  @UsePipes(new FileSizeValidationPipe())
  async importHeaderCSVFile(
    @UploadedFile(new FileSizeValidationPipe()) file: Express.Multer.File,
  ) {
    if (!file) {
      throw new HttpException(
        {
          message: 'file is required',
        },
        400,
      );
    }
    const admin = await this.prismaService.admins.findFirst();

    if (!admin) {
      throw new HttpException(
        {
          message: 'admin not found',
        },
        400,
      );
    }
    const data = await this.adminConferenceService.parseCSVFileWithHeader(file);
    if (!data) {
      throw new HttpException(
        {
          message: 'file is empty',
        },
        400,
      );
    }
    const results: AdminConferenceDTO[] = [];
    for (const item of data) {
      const conference = await this.adminConferenceService
        .importConference(item, admin.id)
        .catch((err) => {
          console.log('error', err);
          throw new HttpException(
            {
              message: 'error when importing conference',
              error: err,
            },
            400,
          );
        });
      results.push(conference as AdminConferenceDTO);
    }
    await this.cacheSearvice.removeAllCache();
    return {
      message: 'file is imported',
      data: results,
    };
  }

  @Post('/import-evaluate')
  @Transactional<TransactionalAdapterPrisma>({
    timeout: 300000,
  })
  @UseInterceptors(FileInterceptor('file'))
  @UsePipes(new FileSizeValidationPipe())
  async importConference(
    @UploadedFile(new FileSizeValidationPipe()) file: Express.Multer.File,
  ) {
    if (!file) {
      throw new HttpException(
        {
          message: 'file is required',
        },
        400,
      );
    }

    const data = await this.adminConferenceService.parsePartEvaluateCsv(file);
    const imports = data.map(async (item) => {
      return this.adminConferenceService.importEvaluateConference(item);
    });
    const result = await Promise.all(imports).catch((err) => {
      console.log('error', err);
    });

    await this.cacheSearvice.removeAllCache();
    return {
      message: 'file is imported',
      data: result,
    };
  }

  @Get('requests')
  @ApiOperation({ summary: 'Get all conference post requests' })
  @ApiResponse({
    status: 200,
    description: 'List of conference post requests',
    type: [ConferencePostRequestDTO],
  })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by request status' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter by start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter by end date (YYYY-MM-DD)' })
  @ApiQuery({ 
    name: 'sortBy', 
    required: false, 
    description: 'Sort by field',
    enum: ['createdAt', 'updatedAt'],
    default: 'createdAt'
  })
  @ApiQuery({ 
    name: 'sortOrder', 
    required: false, 
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc'
  })
  async getConferenceRequests(
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sortBy') sortBy: 'createdAt' | 'updatedAt' = 'createdAt',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    return this.adminConferenceService.getConferenceRequest({
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      sortBy,
      sortOrder,
    });
  }

  @Get('requests/:id')
  @ApiOperation({ summary: 'Get conference post request by ID' })
  @ApiParam({ name: 'id', description: 'Request ID' })
  @ApiResponse({
    status: 200,
    description: 'Conference post request details',
    type: ConferencePostRequestDTO,
  })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async getConferenceRequestById(@Param('id') id: string) {
    return this.adminConferenceService.getConferenceRequestById(id);
  }

  @Post('requests')
  @UseGuards(JWTGuardAdmin)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new conference post request' })
  @ApiResponse({
    status: 201,
    description: 'Conference post request created successfully',
    type: ConferencePostRequestDTO,
  })
  async createConferenceRequest(
    @Req() req: any,
    @Body() data: CreateConferencePostRequestDTO,
  ) {
    const request = await this.adminConferenceService.createConferenceRequest(
      req.user.id,
      req.user.id,
      data,
    );
    const isDisableEmail = await this.notificationService.isDisabledNotificationType(request.userId,  DEFAULT_TYPE.SEND_THROUGH_EMAIL);
            await this.notificationService.createConferenceNotification({
          userId: request.userId,
          conferenceId: request.conferenceId,
          message: `Your conference post request has been created successfully.`,
          isImportant: true,
          isDeleted: false,
          isRead: false,
          type: DEFAULT_TYPE.CONFERENCE_REQUEST_STATUS, // Ensure this type exists in your notification types
        });
    if (!isDisableEmail) {
      try {
        await this.emailService.sendConferenceRequestEmail(request)
      } catch (err) {
        console.error('Failed to send notification:', err);
      }
    }
  }

  @Patch('requests/:id/status')
  @UseGuards(JWTGuardAdmin)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update conference post request status' })
  @ApiParam({ name: 'id', description: 'Conference post request ID' })
  @ApiResponse({
    status: 200,
    description: 'Conference post request status updated successfully',
    type: ConferencePostRequestDTO,
  })
  async updateConferenceRequestStatus(
    @Param('id') id: string,
    @Req() req: any,
    @Body() data: UpdateConferencePostRequestDTO,
  ) {
    const result = await this.adminConferenceService.updateConferenceRequestStatus(
      id,
      req.user.id, // adminId is the same as the authenticated admin's id
      data,
    );

    // Send notification to the user who created the request
    const isDisableEmail = await this.notificationService.isDisabledNotificationType(result.userId, DEFAULT_TYPE.SEND_THROUGH_EMAIL);
    if (!isDisableEmail) {
      try {
        await this.emailService.sendConferenceRequestEmail(result);
      } catch (err) {
        console.error('Failed to send email notification:', err);
      }
    }
    try {
      await this.notificationService.createConferenceNotification({
        userId: result.userId,
        conferenceId: result.conferenceId,
        message: `Your conference request has been ${result.status.toLowerCase()}.`,
        isDeleted: false,
        isImportant: true,
        isRead: false,
        type: 'CONFERENCE_REQUEST_STATUS', // Make sure this type exists in your notification types
      });
    } catch (err) {
      // Optionally log or handle notification errors, but don't block the main response
      console.error('Failed to send notification:', err);
    }

    return result;
  }

  @Post('save')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create or update a conference' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The conference has been successfully created/updated',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid conference data',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async createConference(@Body() conferenceData: ConferenceSaveDto) {
    return await this.adminConferenceService.saveConference(conferenceData);
  }

  @Post('import')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Import multiple conferences' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The conferences have been successfully imported',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid conference data',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  @ApiBody({ type: [ConferenceSaveDto] })
  async importConferences(@Body() conferencesData: ConferenceSaveDto[]) {
    const data = await this.adminConferenceService.importConferences(conferencesData);
    return {
      success: true,
      data: data,
    };
  }

  @Get('filter-options/status')
  @ApiOperation({ summary: 'Get all available conference statuses' })
  @ApiResponse({
    status: 200,
    description: 'List of available conference statuses',
    type: [String],
  })
  async getStatusOptions() {
    const statuses = await this.prismaService.conferences.findMany({
      select: {
        status: true
      },
      distinct: ['status']
    });
    return statuses.map(s => s.status);
  }

  @Get('filter-options/sources')
  @ApiOperation({ summary: 'Get all available conference sources' })
  @ApiResponse({
    status: 200,
    description: 'List of available conference sources',
    type: [String],
  })
  async getSourceOptions() {
    const sources = await this.prismaService.sources.findMany({
      select: {
        name: true
      },
      distinct : ['name'],
    });
    return sources.map(s => s.name);
  }

  @Get('filter-options/research-fields')
  @ApiOperation({ summary: 'Get all available research fields' })
  @ApiResponse({
    status: 200,
    description: 'List of available research fields',
    type: [String],
  })
  async getResearchFieldOptions() {
    const fields = await this.prismaService.fieldOfResearchs.findMany({
      select: {
        name: true
      }
    });
    return fields.map(f => f.name);
  }

  @Get('filter-options/ranks/:source')
  @ApiOperation({ summary: 'Get available ranks for a specific source' })
  @ApiParam({ name: 'source', description: 'Conference source (e.g., IEEE, ACM)' })
  @ApiResponse({
    status: 200,
    description: 'List of available ranks for the specified source',
    type: [String],
  })
  async getRankOptionsBySource(@Param('source') source: string) {
    const ranks = await this.prismaService.ranks.findMany({
      where: {
        belongsToSource: {
          name: source
        }
      },
      select: {
        name: true
      },
      orderBy: {
        value: 'asc'
      },
      distinct: ['name']
    });
    return ranks.map(r => r.name);
  }

  @Get('filter-options/ranks')
  @ApiOperation({ summary: 'Get all available ranks across all sources' })
  @ApiResponse({
    status: 200,
    description: 'List of all available ranks',
    type: [String],
  })
  async getAllRankOptions() {
    const ranks = await this.prismaService.ranks.findMany({
      select: {
        name: true
      },
      distinct: ['name'],
      orderBy: {
        value: 'asc'
      }
    });
    return ranks.map(r => r.name);
  }

  @Put('update-history')
  @ApiOperation({ summary: 'Update conference history' })
  @ApiResponse({
    status: 200,
    description: 'Conference history updated successfully',
  })
  @Transactional<TransactionalAdapterPrisma>({
    isolationLevel: 'Serializable',
  })
  async updateConferenceHistory(@Body(new TransformDatePipe()) data: ConferenceHistoryDto) {
    console.log(data)
    await this.cacheSearvice.removeAllCache();
    const update = await this.adminConferenceService.updateConferenceHistory(data);
    if (!update) {
      throw new HttpException(
        {
          message: 'Conference history not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }
    await this.followService.notifyFollowersAboutConferenceUpdate(update.id);
    return {
      message: 'Conference history updated successfully',
      data: update,
    };
  }

  @Get('history/:id')
  @ApiOperation({ summary: 'Get conference history by ID' })
  @ApiParam({ name: 'id', description: 'Organization history ID' })
  @ApiResponse({
    status: 200,
    description: 'Conference history details',
    type: ConferenceHistoryResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Organization history not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getConferenceHistoryById(@Param('id') id: string): Promise<ConferenceHistoryResponseDto> {
    return this.adminConferenceService.getOrganizationHistoryById(id);
  }

  @Delete('history/:id')
  @ApiOperation({ summary: 'Delete conference organization history' })
  @ApiParam({ name: 'id', description: 'Organization history ID' })
  @ApiResponse({
    status: 200,
    description: 'Conference organization history deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Organization history not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  @Transactional<TransactionalAdapterPrisma>()
  async deleteConferenceHistory(@Param('id') id: string) {
    return this.adminConferenceService.deleteConferenceHistory(id);
  }

  @Get('conference/:conferenceId/history')
  @ApiOperation({ summary: 'Get all history entries for a conference' })
  @ApiParam({ name: 'conferenceId', description: 'Conference ID' })
  @ApiResponse({
    status: 200,
    description: 'List of conference history entries',
    type: [ConferenceHistoryResponseDto],
  })
  @ApiResponse({
    status: 404,
    description: 'Conference not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getConferenceHistoryByConferenceId(
    @Param('conferenceId') conferenceId: string,
  ): Promise<ConferenceHistoryResponseDto[]> {
    return this.adminConferenceService.getConferenceHistoryByConferenceId(conferenceId);
  }

  @Delete('remove/:id')
  @ApiOperation({ summary: 'Delete a conference by ID' })
  @ApiParam({ name: 'id', description: 'Conference ID' })
  @ApiResponse({
    status: 200,
    description: 'Conference deleted successfully',
  })
  async deleteConference(@Param('id') id: string) {
    const conference = await this.prismaService.conferences.findUnique({
      where: { id },
    });

    if (!conference) {
      throw new HttpException(
        {
          message: 'Conference not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.adminConferenceService.removeConference(id);
    return {
      message: 'Conference deleted successfully',
    };
  }

  @Get('remove-empty-date')
  @ApiOperation({ summary: 'Remove conferences with empty date' })
  @ApiResponse({
    status: 200,
    description: 'Conferences with empty date removed successfully',
  })
  async removeConferencesWithEmptyDate() {
    const conferences = await this.adminConferenceService.removeConferenceWithNoDate();
    return {
      message: 'Conferences with empty date removed successfully',
    };
  }

  @Get('remove-trash-topics')
  @ApiOperation({ summary: 'Remove conferences with empty source' })  
  @ApiResponse({
    status: 200,
    description: 'Conferences with empty source removed successfully',
  })
  async removeConferencesWithEmptySource() {
    const conferences = await this.adminConferenceService.removeTrashTopics();
    return {
      message: 'Conferences with empty source removed successfully',
    };
  }

  @Get('update-conference-status')
  @ApiOperation({ summary: 'Update conference status' })
  @ApiResponse({
    status: 200,
    description: 'Conference status updated successfully',
  })
  async updateConferenceStatus() {
    const updatedConferences = await this.adminConferenceService.updateConferenceStatus();
    return {
      message: 'Conference status updated successfully',
      data: updatedConferences,
    };
  }

  @Delete('delete/source/:sourceName')
  @ApiOperation({ summary: 'Delete all conferences from a specific source' })
  @ApiParam({ name: 'sourceName', description: 'Source name' , required: false })
  @ApiResponse({
    status: 200,
    description: 'All conferences from the specified source deleted successfully',
  })
  async deleteConferencesBySource(@Param('sourceName') sourceName: string | undefined) {
    const deletedCount = await this.adminConferenceService.removeSource(sourceName?.trim() || '');
    return {
      message: `All conferences from source ${sourceName} deleted successfully`,
      deletedCount,
    };
  }
  
}
