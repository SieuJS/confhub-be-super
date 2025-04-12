import { Module } from "@nestjs/common";
import { UserModule } from "../user/user.module";
import { PassportModule } from "@nestjs/passport";
import { AuthService } from "./services/auth.service";
import { LocalStrategy } from "./strategies/local.strategy";
import { LocalAuthGuard } from "./guards/local.guard";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./controllers/auth.controller";
import { JwtAdminStrategy } from "./strategies/jwt-admin.strategy";
import { JwtUserStrategy } from "./strategies/jwt-user.strategy";

@Module({
    imports: [
        UserModule,
        PassportModule,
        JwtModule.register({
            secret: process.env.JWT_SECRET,
            signOptions: {
                expiresIn: '3600s',
            },
        })
    ],
    controllers : [AuthController],
    providers: [AuthService, LocalStrategy, LocalAuthGuard, JwtAdminStrategy,JwtUserStrategy ],
})
export class AuthModule {}
