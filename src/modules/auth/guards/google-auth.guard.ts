import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { ExecutionContext } from '@nestjs/common';

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  constructor() {
    super();
  }

  handleRequest(
    err: Error | null,
    user: any,
    info: any,
    context: ExecutionContext,
  ): any {
    const request = context.switchToHttp().getRequest<Request>();

    // If there's an error parameter in the query, let the controller handle it
    if (request.query.error) {
      return null;
    }

    // If there's an error or no user, throw UnauthorizedException
    if (err || !user) {
      throw new UnauthorizedException('Authentication failed');
    }

    return user;
  }
}
