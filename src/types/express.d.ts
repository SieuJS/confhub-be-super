// Type declarations for authentication
declare namespace Express {
  interface User {
    id: string;
    email?: string;
    role?: string;
    firstName?: string;
    lastName?: string;
  }

  interface Request {
    oauthState?: string;
  }
}

export {};
