import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { UpdateUserDto } from '../models/update-user.dto';

interface UserDataObject {
  aboutme?: string;
  aboutMe?: string;
  dob?: string | Date;
  [key: string]: any;
}

@Injectable()
export class UserPropertyTransformPipe
  implements PipeTransform<UserDataObject, UpdateUserDto>
{
  transform(value: UserDataObject): UpdateUserDto {
    if (!value || typeof value !== 'object') {
      return value as UpdateUserDto;
    }

    const result = { ...value };

    // Transform aboutme to aboutMe
    if (
      'aboutme' in value &&
      value.aboutme !== undefined &&
      !('aboutMe' in value)
    ) {
      const { aboutme, ...rest } = value;
      Object.assign(result, { ...rest, aboutMe: aboutme });
    }

    // Transform dob to Date object if it's a string
    if ('dob' in value && value.dob !== undefined) {
      try {
        if (typeof value.dob === 'string') {
          // Try to parse the date - handles ISO format, simple date formats
          const parsedDate = new Date(value.dob);

          // Check if the date is valid
          if (!isNaN(parsedDate.getTime())) {
            result.dob = parsedDate;
          } else {
            throw new BadRequestException('Invalid date format for dob');
          }
        }
      } catch (error) {
        throw new BadRequestException('Invalid date format for dob');
      }
    }

    return result as UpdateUserDto;
  }
}
