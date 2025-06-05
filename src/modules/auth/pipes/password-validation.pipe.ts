import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class PasswordValidationPipe implements PipeTransform {
  transform(value: string): string {
    if (!value || typeof value !== 'string') {
      throw new BadRequestException('Password must be a string');
    }

    if (value.length < 6 || value.length > 20) {
      throw new BadRequestException(
        'Password must be between 6 and 20 characters',
      );
    }

    const allowRegex = /^[a-zA-Z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]*$/;
    if (!allowRegex.test(value)) {
      throw new BadRequestException('Password contains invalid characters');
    }

    return value;
  }
}
