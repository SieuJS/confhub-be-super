import { Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthService } from "../services/auth.service";
import { LocalAuthGuard } from "../guards/local.guard";
import { ApiBearerAuth, ApiBody, ApiHeader, ApiTags } from "@nestjs/swagger";
import { LoginInput } from "../models/login.input";
import { JWTGuard } from "../guards/jwt.guard";
import { AuthGuard } from "@nestjs/passport";

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

    @Get('/me')
    @ApiBearerAuth('access-token'

    )
    @ApiHeader({
        name : 'Authorization',
        description : 'Bearer token'
    })
    @UseGuards(AuthGuard('jwt'))
    async getMe(@Req() req) {
        const user = req.user;
        return user;
    }
}