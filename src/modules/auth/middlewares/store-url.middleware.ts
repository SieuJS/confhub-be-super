// redirect-cookie.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class StoreRedirectMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const redirect = req.query.redirect as string;
    console.log('Redirect URL:', redirect);
    if (redirect) {
      res.cookie('redirect', redirect, {
        httpOnly: true,
        secure: false, // Set to true if using HTTPS
        maxAge: 5 * 60 * 1000,
        path: '/',
      });
    }

    next();
  }
}
