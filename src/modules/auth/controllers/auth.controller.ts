import { Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthService } from "../services/auth.service";
import { LocalAuthGuard } from "../guards/local.guard";
import { ApiBearerAuth, ApiBody, ApiHeader, ApiTags } from "@nestjs/swagger";
import { LoginInput } from "../models/login.input";
import { JWTGuardAdmin, JWTGuardUser } from "../guards/jwt.guard";

@ApiTags('auth')
@Controller('/auth') 
export class AuthController {
    constructor(
        private readonly authService : AuthService
    ){}

    @Post('/login')
    @ApiBody({
        type : LoginInput
    })
    @UseGuards(LocalAuthGuard)
    async login(@Req() req) {
        const user = req.user;
        return await this.authService.loginUser(user);
    }

    @Post('/logout')
    async logout() {
        return {
            message : "Logout successful"
        }
    }

    @Post('/admin/login')
    @ApiBody({
        type : LoginInput
    })
    @UseGuards(LocalAuthGuard)
    async loginAdmin(@Req() req) {
        const admin = req.user;
        return await this.authService.loginAdmin(admin);
    }

    @Post('/admin/logout')
    async logoutAdmin() {
        return {
            message : "Logout successful"
        }
    }

    @Get('/admin/me')
    @ApiBearerAuth('access-token'

    )
    @ApiHeader({
        name : 'Authorization',
        description : 'Bearer token'
    })
    @UseGuards(JWTGuardAdmin)
    async getMe(@Req() req) {
        const user = req.user;
        return user;
    }

    @Get('/me')
    @ApiBearerAuth('access-token')
    @ApiHeader({
        name : 'Authorization',
        description : 'Bearer token'
    })
    @UseGuards(JWTGuardUser)
    async getMeUser(@Req() req) {
        const user = req.user;
        return user;
    }
    
}