import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class PasswordService {
  hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  comparePasswords(plainPassword: string, hashedPassword: string): boolean {
    const hashedInputPassword = this.hashPassword(plainPassword);
    return hashedInputPassword === hashedPassword;
  }
}
