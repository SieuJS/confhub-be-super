import { Injectable } from "@nestjs/common";
import { PaginationDTO } from "../model";

@Injectable()
export class PaginationService<T> {
    constructor() {

    }
    paginate(
        items : T[],
        curPage : number = 1,
        perPage : number = 10
    ) : {
        payload : T[],
        meta : PaginationDTO
    }{
        perPage = isNaN(perPage) ? 10 : perPage;
        const start = (curPage - 1) * perPage;
        const end = start + perPage;
        const payload = items.slice(start, end);
        const totalPage = Math.ceil(items.length / perPage);
        const prevPage = curPage > 1 ? curPage - 1 : null;
        const nextPage = curPage < totalPage ? curPage + 1 : null;
        const totalItems = items.length;
        const meta : PaginationDTO = {
            curPage,
            perPage,
            totalPage,
            prevPage,
            nextPage,
            totalItems
        }
        return {
            payload,
            meta
        }
    }

}