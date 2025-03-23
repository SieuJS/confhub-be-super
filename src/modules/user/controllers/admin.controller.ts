import { Controller, Get } from "@nestjs/common";
import { AdminService } from "../services/admin.service";
import { ApiTags } from "@nestjs/swagger";

@Controller('admin') 
@ApiTags('admin')
export class AdminController {

    constructor(
        private adminService : AdminService
    ) {
        
    }

    @Get('/')
    async getAdmin() {
        return await this.adminService.getAdmin();
    }

}