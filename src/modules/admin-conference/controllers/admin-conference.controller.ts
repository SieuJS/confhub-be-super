import {  Controller, DefaultValuePipe, Get, HttpException, Post, Query, UploadedFile, UseInterceptors, UsePipes } from "@nestjs/common";
import {  ApiTags } from "@nestjs/swagger";
import { AdminConferenceService } from "../services/admin-conference.service";
import { AdminConferenceParams } from "../models/admin-conference.dto";
import { AdminConferenceParamsPipe } from "../pipes/admin-conference-params.pipe";
import { FileInterceptor } from "@nestjs/platform-express";
import { FileSizeValidationPipe } from "../pipes/validation-file.pipe";
import { PrismaService } from "src/modules/common";

@Controller('admin-conference')
export class AdminConferenceController {

    constructor (
        private readonly adminConferenceService : AdminConferenceService,
        private readonly prismaService : PrismaService,
    ) {}

    @ApiTags('get') 
    @Get('get')
    getConferenceInstances(
        @Query(
            new AdminConferenceParamsPipe()
        ) params : AdminConferenceParams,
        @Query('page', new DefaultValuePipe(1)) page : number,
        @Query('perPage', new DefaultValuePipe(10)) perPage : number,
    ) {
        const where = this.adminConferenceService.convertToPrismaWhereInput({
            search : params.search,
            status : params.status,
            source : params.source,
            researchFields : params.researchFields,
            ranks : params.ranks,
        })
        return this.adminConferenceService.getConferenceInstances({
            where ,
            orderBy : {},
            include : {},
            page : page,
            perPage : perPage,
        })
    }

    @Post('/upload-file-csv')   
    @UseInterceptors(FileInterceptor('file'))
    async importCSVFile(
        @UploadedFile(new FileSizeValidationPipe()) file: Express.Multer.File
    ) {
        if (!file) {
            throw new HttpException({
                message: 'file is required'
            }, 400);
        }
        const admin = await this.prismaService.admins.findFirst();

        if(!admin) {
            throw new HttpException({
                message: 'admin not found'
            }, 400);
        }

        const data = await this.adminConferenceService.parseCSVFile(file);
        const imports = await this.adminConferenceService.importConference(data, admin.id);
        return {
            message: 'file is imported',
            data : imports  
        }
    }   

    @Post('/import-evaluate')
    @UsePipes(new FileSizeValidationPipe())
    async importConference(
        @UploadedFile(new FileSizeValidationPipe()) file: Express.Multer.File,
    ) {
        if (!file) {
            throw new HttpException({
                message: 'file is required'
            }, 400);
        }
        const admin = await this.prismaService.admins.findFirst();

        if(!admin) {
            throw new HttpException({
                message: 'admin not found'
            }, 400);
        }

        const data = await this.adminConferenceService.parsePartEvaluateCsv(file);
        const imports = data.map(async (item) => {
            return this.adminConferenceService.importEvaluateConference(item, admin.id);
        })

        const result = await Promise.all(imports);
        return {
            message: 'file is imported',
            data : result  
        }
    }
}