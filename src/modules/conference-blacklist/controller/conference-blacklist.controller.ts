import {
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConferenceService } from "src/modules/conference/services/conference.service";
import { UserService } from "src/modules/user/services/user.service";
import { ApiBearerAuth, ApiBody, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JWTGuardUser } from "src/modules/auth/guards/jwt.guard";
import { ConferenceBlacklistInput } from 'src/modules/conference/models/conference-blacklist/conference-blacklist.input';
import { Transactional } from "@nestjs-cls/transactional";
import { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { DEFAULT_TYPE } from "src/modules/notify/constants/default-type";
import { NotificationService } from "src/modules/notify/services/notification.service";

@ApiTags('BlacklistConference')
@Controller('blacklist-conference')
export class ConferenceBlacklistController {
    constructor(
        private readonly conferenceService: ConferenceService,
        private readonly userService: UserService,
    ) {}

    @UseGuards(JWTGuardUser)
    @Post('/add')
    @ApiBearerAuth('access-token')
    @Transactional<TransactionalAdapterPrisma>({ timeout: 30000 })  
    @ApiBody({ type: ConferenceBlacklistInput })
    async addToBlacklist(
        @Body() input: { conferenceId: string }, @Req() req 
    ) {
        const conferenceIds = await this.userService.addToBlacklist(
            req.user.id,
            input.conferenceId,
        );
        return conferenceIds;
    }

    @UseGuards(JWTGuardUser)
    @Get('/added')
    @ApiBearerAuth('access-token')
    async getAddedBlacklistConferences(@Req() req) {
        const userId = req.user.id;
        const conferenceIds = await this.userService.getAddedBlacklistConferences(userId);
        const results = await Promise.all(
            conferenceIds.map(async (conferenceId) => {
                return await this.conferenceService.getConferenceById(
                    conferenceId.conferenceId,
                );
            }),
        );
        return results;
    }

    @Get('/:conferenceId')
    @ApiParam({ name: 'conferenceId' })
    async getAddedBlacklistByConferenceId(@Param('conferenceId') conferenceId: string) {
        return await this.conferenceService.getAddedBlacklistByConferenceId(conferenceId);
    }

}

