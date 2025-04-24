export interface JournalImport {
    scimagoLink: string;
    bioxbio: string | null;
    Image: string;
    Image_Context: string;
    Rank: string;
    Sourceid: string;
    Title: string;
    Type: string;
    Issn: string;
    SJR: string;
    SJRBestQuartile: string;
    HIndex: string;
    TotalDocs2023: string;
    TotalDocs3Years: string;
    TotalRefs: string;
    TotalCites3Years: string;
    CitableDocs3Years: string;
    CitesPerDoc2Years: string;
    RefPerDoc: string;
    PercentFemale: string;
    Overton: string;
    SDG: string;
    Country: string;
    Region: string;
    Publisher: string;
    Coverage: string;
    Categories: string;
    Areas: string;
    title: string;
    SubjectAreaAndCategory: {
        FieldOfResearch: string;
        Topics: string[];
    };
    ISSN: string;
    Information: {
        Homepage: string;
        HowToPublish: string;
        Mail: string;
    };
    Scope: string;
    SupplementaryTable: Array<{
        Category: string;
        Year: string;
        Quartile: string;
    }>;
    Thumbnail: string;
}

export interface JournalRankImport {
    Category: string;
    Year: string;
    Quartile: string;
}