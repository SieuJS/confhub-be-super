import { ApiProperty, OmitType, PickType } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class JournalRankDto {
    @ApiProperty({
        example : "123123-123123-123123",
    })
    id : string;
    @ApiProperty({
        example : "AI",
    })
    category: string;
    @ApiProperty({
        example : "2023"
    })
    year: string;
    @ApiProperty({
        example : "Q1"
    })
    quartile: string;
}

export class JournalRankInput extends OmitType(JournalRankDto, ['id'] as const) {
    @IsString()
    @ApiProperty({
        example : "123123-123123-123123",
    })
    journalId: string;
}



