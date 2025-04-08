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
    submissionDate: object;
    notificationDate: object;
    cameraReadyDate: object;
    registrationDate: object;
    otherDate: object;
    topics: string;
    publisher: string;
    summary: string;
    callForPapers: string;
}