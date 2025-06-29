import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Inject, Injectable } from '@nestjs/common';
import { Service } from 'src/modules/tokens';
import { Config } from 'src/modules/common';

interface GoogleProfile {
  id: string;
  name: {
    givenName: string;
    familyName: string;
  };
  emails: Array<{ value: string }>;
  photos: Array<{ value: string }>;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @Inject(Service.CONFIG)
    private readonly config: Config,
  ) {
    super({
      clientID: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
      callbackURL: config.GOOGLE_CALLBACK_URL,
      scope: ['email', 'profile'],
      state: true, // Enable state parameter for security and data passing
      passReqToCallback: true, // Pass request to callback to access state
    });
  }

  validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    profile: GoogleProfile,
    done: VerifyCallback,
  ): void {
    const { name, emails, photos } = profile;
    const state = req.query?.state as string; // Get state from callback request
    const user = {
      id: profile.id || emails[0].value, // Use profile ID or email as fallback
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      picture: photos[0].value,
      accessToken,
      refreshToken,
      oauthState: state || '', // Pass state to user object
    };
    done(null, user);
  }
}
