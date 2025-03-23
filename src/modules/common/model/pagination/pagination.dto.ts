import { ApiProperty } from "@nestjs/swagger";

export class PaginationDTO {
    @ApiProperty({description : "Page number", example : 1})
    curPage : number

    @ApiProperty({description : "Items per page", example : 10})
    perPage : number

    @ApiProperty({description : "Total page", example : 10})
    totalPage : number

    @ApiProperty({description : "Previous page", example : 1})
    prevPage : number | null

    @ApiProperty({description : "Next page", example : 2})
    nextPage : number | null

    @ApiProperty({description : "Total items", example : 100})
    totalItems : number

}