import { AuthGuard } from "@nestjs/passport";

export class JWTGuardAdmin extends AuthGuard('jwt-admin') {}
export class JWTGuardUser extends AuthGuard('jwt-user') {}