import { ApiProperty } from '@nestjs/swagger';

class ConferenceData {
    @ApiProperty({ example: 'AAAI Conference on Human Computation and Crowdsourcing' })
    name: string;

    @ApiProperty({ example: 'HCOMP' })
    acronym: string;

    @ApiProperty({ example: '' })
    rank: string;

    @ApiProperty({ example: '' })
    rating: string;

    @ApiProperty({ example: '' })
    dblp: string;

    @ApiProperty({ example: '' })
    note: string;

    @ApiProperty({ example: '' })
    comments: string;

    @ApiProperty({ example: '' })
    fieldOfResearch: string;

    @ApiProperty({ example: '' })
    source: string;

    @ApiProperty({ example: 'https://www.humancomputation.com/' })
    link: string;

    @ApiProperty({ example: 'None' })
    cfpLink: string;

    @ApiProperty({ example: 'None' })
    impLink: string;

    @ApiProperty({ example: 'Conference dates: October 16–19, 2024\nYear: 2024\nLocation: Pittsburgh, Pennsylvania, USA\nCity-State-Province: Pittsburgh, Pennsylvania\nCountry: United States\nContinent: North America\nType: Offline\nAbstracts due: June 5, 2024\nFull papers due: June 12, 2024\nNotifications: July 31, 2024\nTopics: Human Computation, Crowdsourcing, Artificial Intelligence, Human-Computer Interaction, Social Computing, Artificial Intelligence Economics, Computational Social Science, Digital Humanities, Policy, Ethics' })
    information: string;

    @ApiProperty({ example: 'October 16–19, 2024' })
    conferenceDates: string;

    @ApiProperty({ example: '2024' })
    year: string;

    @ApiProperty({ example: 'Pittsburgh, Pennsylvania, USA' })
    location: string;

    @ApiProperty({ example: 'Pittsburgh, Pennsylvania' })
    cityStateProvince: string;

    @ApiProperty({ example: 'United States' })
    country: string;

    @ApiProperty({ example: 'North America' })
    continent: string;

    @ApiProperty({ example: 'Offline' })
    type: string;

    @ApiProperty({ type: Object })
    submissionDate: object;

    @ApiProperty({ type: Object })
    notificationDate: object;

    @ApiProperty({ example: {} })
    cameraReadyDate: object;

    @ApiProperty({ example: {} })
    registrationDate: object;

    @ApiProperty({ example: {} })
    otherDate: object;

    @ApiProperty({ example: 'Human Computation, Crowdsourcing, Artificial Intelligence, Human-Computer Interaction, Social Computing, Artificial Intelligence Economics, Computational Social Science, Digital Humanities, Policy, Ethics' })
    topics: string;

    @ApiProperty({ example: '' })
    publisher: string;

    @ApiProperty({ example: `'The 12th AAAI Conference on Human Computation and Crowdsourcing (HCOMP 2024) will be held October 16-19th in Pittsburgh, Pennsylvania, focusing on the theme of ''Responsible Crowd Work for Better AI.'' HCOMP is the premier venue for disseminating the latest research findings on human computation and crowdsourcing. It fosters interdisciplinary research, promoting the exchange of advances among researchers, engineers, and practitioners across various disciplines.'` })
    summary: string;

    @ApiProperty({ example: 'HCOMP 2024 invites submissions of research findings on human computation and crowdsourcing. The conference aims to promote broad, interdisciplinary research, welcoming contributions from human-centered qualitative studies and HCI design, social computing, artificial intelligence economics, computational social science, digital humanities, policy, and ethics.\n\n*   **Submission Deadlines:**\n    *   Abstracts due: June 5, 2024\n    *   Full papers due: June 12, 2024\n*   **Notifications:** July 31, 2024\n*   **Colocation:** HCOMP 2024 is colocated with ACM UIST 2024 (October 13-16, 2024).\n*   **Community:** The conference encourages participation through a Google Group mailing list, a Twitter hashtag (#HCOMP2024), and the HCOMP Slack Community.' })
    callForPapers: string;
}

export class ConferenceCrawlNewResponseDto {
    @ApiProperty({ example: 'Conference crawling completed successfully!' })
    message: string;

    @ApiProperty({ type: [ConferenceData] })
    data: ConferenceData[];

    @ApiProperty({ example: '8.30 s' })
    runtime: string;
}