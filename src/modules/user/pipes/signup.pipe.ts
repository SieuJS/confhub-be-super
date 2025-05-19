import { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import parser from 'any-date-parser';
export class SignUpPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    const dbo = new Date(parser.fromString(value.dob)).toISOString();
    console.log('value wqe', dbo);
    return {
      ...value,
      dob: new Date(parser.fromString(value.dob)),
    };
  }
}
