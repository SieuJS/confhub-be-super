import { Controller, Post, Req, UseGuards } from "@nestjs/common";
import { AuthService } from "../services/auth.service";
import { LocalAuthGuard } from "../guards/local.guard";
import { ApiBody, ApiTags } from "@nestjs/swagger";
import { LoginInput } from "../models/login.input";

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
        return await this.authService.login(user);
    }

    @Post('/logout')
    async logout() {
        return {
            message : "Logout successful"
        }
    }
}