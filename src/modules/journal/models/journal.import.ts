export interface JournalImport {
    "scimagoLink": string;
    "bioxbio": string | null;
    "Image": string;
    "Image_Context": string;
    "Rank": string;
    "Sourceid": string;
    "Title": string;
    "Type": string;
    "Issn": string;
    "SJR": string;
    "SJR Best Quartile": string;
    "H index": string;
    "Total Docs. (2023)": string;
    "Total Docs. (3years)": string;
    "Total Refs.": string;
    "Total Cites (3years)": string;
    "Citable Docs. (3years)": string;
    "Cites / Doc. (2years)": string;
    "Ref. / Doc.": string;
    "%Female": string;
    "Overton": string;
    "SDG": string;
    "Country": string;
    "Region": string;
    "Publisher": string;
    "Coverage": string;
    "Categories": string;
    "Areas": string;
    "title": string;
    "Subject Area and Category.Field of Research": string;
    "Subject Area and Category.Topics": string[];
    "ISSN": string;
    "Information.Homepage": string;
    "Information.How to publish in this journal": string;
    "Information.Mail": string | null;
    "Scope": string;
    "SupplementaryTable": Array<{
        "Category": string;
        "Year": string;
        "Quartile": string;
    }>;
    "Thumbnail": string;
}

export interface JournalRankImport {
    Category: string;
    Year: string;
    Quartile: string;
}