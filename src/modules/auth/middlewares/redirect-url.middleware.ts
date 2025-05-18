import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

// Extend express-session Session interface to include our custom properties
declare module 'express-session' {
  interface Session {
    redirectUrl?: string;
  }
}

@Injectable()
export class RedirectUrlMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Get the redirectUrl from query parameters
    const redirectUrl = req.query.redirectUrl as string;
    console.log('input redirectUrl', redirectUrl);
    // If redirectUrl exists, store it in the session
    if (redirectUrl && req.session) {
      req.session.redirectUrl = redirectUrl;
    }

    next();
  }
}
