import { Injectable } from "@nestjs/common";
import { PrismaService , LoggerService } from "../../common";

@Injectable() 
export class AdminService { 
    constructor(
        private readonly prismaService : PrismaService,
        private readonly logService : LoggerService
    ) {
        this.initializeAdmin();
    }

    async initializeAdmin () {
        const count = await this.prismaService.users.count();
        if(count > 0) {
            this.logService.info('Admin already exists');
            return;
        }
        await this.prismaService.users.create({
            data : {
                email : 'admin@admin.com',
                password : 'admin',
                role : 'admin',
                createdAt : new Date(),
                updatedAt : new Date(),
                firstName : 'Admin',
                lastName : 'Admin',
                dob : new Date(),
            }
        })
        this.logService.info('Admin created successfully');
    }

    async getAdmin() {
        return await this.prismaService.users.findFirst({
            where : {
                role : 'admin'
            }
        });
    }
}