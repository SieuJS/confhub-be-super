import { ArgumentMetadata, PipeTransform } from "@nestjs/common";
import parser from "any-date-parser";
export class SignUpPipe implements PipeTransform {
    transform(value: any, metadata: ArgumentMetadata) {
        const dbo = new Date (parser.fromString(value.dob as any)).toISOString();
        console.log('value', dbo);
        return {
            ...value,
            dob: new Date(parser.fromString(value.dob as any)),
        }
    }
} 