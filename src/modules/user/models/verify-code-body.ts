import { ApiProperty } from "@nestjs/swagger";

export class VerifyCodeBody  {
    @ApiProperty()
    code: string;
}