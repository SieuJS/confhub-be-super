export type ConferenceImportRow = {
    title : string ;
    acronym : string ;
    source : string ;
    rank : string ;
    researchFieldCodes : string[] ;
}

export type ConferenceEvaluationRow = {
    name: string;
    acronym: string;
    link: string;
    cfpLink: string;
    impLink: string;
    source: string;
    rank: string;
    rating: string;
    fieldOfResearch: string;
    information: string;
    conferenceDates: string;
    year: string;
    location: string;
    cityStateProvince: string;
    country: string;
    continent: string;
    type: string;
    submissionDate: Record<string, string>;
    notificationDate: Record<string, string>;
    cameraReadyDate: Record<string, string>;
    registrationDate: Record<string, string>;
    otherDate: Record<string, string>;
    topics: string;
    publisher: string;
    summary: string;
    callForPapers: string;
}