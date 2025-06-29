import { Session, SessionData } from 'express-session';

declare module 'express-session' {
  interface SessionData {
    redirectUrl?: string;
  }
}

declare module 'express' {
  interface Request {
    session: Session & Partial<SessionData>;
    oauthState?: string;
  }
}
