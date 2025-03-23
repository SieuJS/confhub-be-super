import { Body, Controller, Get, HttpException, Post, Req, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { UserService } from "../services/user.service";
import { ApiBody, ApiTags } from "@nestjs/swagger";
import { UserInput, UserSigninInput } from "../models/user.input";
import * as crypto from 'crypto';
import { LocalAuthGuard } from "../../auth/guards/local.guard";
import { AuthGuard } from "@nestjs/passport";

@ApiTags('user')
@Controller('/user')
export class UserController {
    constructor(
        private userService : UserService
    ) {
        
    }
    @Get() 
    async getAllUsers() {
        return await this.userService.getAllUsers();
    }

    @UseGuards(AuthGuard('local'))
    @Post('/signin') 
    @ApiBody({
        type : UserSigninInput
    })
    async signin(@Req() req) {
        const user = req.user;
        const token = await this.userService.generateToken(user.id);    
        // If password is valid, return user or token
        return {
            message: "Login successful",
            user,
            token
        };
    }

    @Post('/signup')
    @UsePipes(new ValidationPipe({transform : true}))
    @ApiBody({
        type : UserInput
    })
    async signup(@Body() input : UserInput) {
        const user =  await this.userService.getUserByEmail(input.email);
        if(user) {
            return {
                message : "User already exists"
            }
        }
        const hashedPassword = crypto.createHash('sha256').update(input.password).digest('hex');
        const newUser = await this.userService.createUser({
            ...input,
            password : hashedPassword
        });

        const token = await this.userService.generateToken(newUser.id);
        
        return {
            message : "User created",
            user : newUser,
            token
        }
    }

    @UseGuards(LocalAuthGuard)
    @Post('/signout')
    async signout(@Req() req) {
        req.logout();
    }

    @UseGuards(LocalAuthGuard)
    @Get('/me')
    async me(@Req() req) {
        return req.user;
    }
}