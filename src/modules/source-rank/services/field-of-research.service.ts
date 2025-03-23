import { LoggerService, PrismaService } from "../../common";

import { Injectable } from "@nestjs/common";
import { FOR_DATA } from "../data/field-of-researchs";

@Injectable()
export class FieldOfResearchService {
    constructor(
        private prismaService: PrismaService,
        private logService: LoggerService
    ) {
        this.initFieldOfResearch();
    }
    public async initFieldOfResearch(): Promise<void> {
        // Check if data exists in the table
        const count = await this.prismaService.fieldOfResearchs.count();

        if (count === 0) {
            // If no data exists, import from JSON file
            const fieldsOfResearch =FOR_DATA ;

            // Insert all fields of research
            await this.prismaService.fieldOfResearchs.createMany({
                data: fieldsOfResearch.map((field: any) => ({
                    name: field.name,
                    code: field.code || "UNDEFINED",
                })),
                skipDuplicates: true,
            });

            this.logService.info(
                `Imported ${fieldsOfResearch.length} fields of research.`
            );
        }
        else {
            this.logService.info(
                'Field of research data already exists. Skipping import.'
            )
        }
    }

    public async getFieldOfResearchByCode (forCode : string) {
        if(!forCode) {
            return null;
        }
        return await this.prismaService.fieldOfResearchs.findFirst({
            where : {
                code : forCode
            }
        });
    }

    

}
