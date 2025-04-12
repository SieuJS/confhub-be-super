import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class FileSizeValidationPipe implements PipeTransform {
  transform(value, metadata: ArgumentMetadata) {
    // "value" is an object containing the file's attributes and metadata
    return value.mimetype === 'text/csv' ? value : null
  
  }
}

