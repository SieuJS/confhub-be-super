-- CreateTable
CREATE TABLE "Passenger" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,

    CONSTRAINT "Passenger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Locations" (
    "id" TEXT NOT NULL,
    "address" TEXT,
    "cityStateProvince" TEXT,
    "country" TEXT,
    "continent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isAvailable" BOOLEAN NOT NULL,
    "organizeId" TEXT NOT NULL,

    CONSTRAINT "Locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConferenceDates" (
    "id" TEXT NOT NULL,
    "organizedId" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isAvailable" BOOLEAN NOT NULL,

    CONSTRAINT "ConferenceDates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConferenceOrganizations" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "accessType" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL,
    "conferenceId" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "summerize" TEXT NOT NULL,
    "callForPaper" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "cfpLink" TEXT NOT NULL,
    "impLink" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConferenceOrganizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConferenceTopics" (
    "id" TEXT NOT NULL,
    "organizeId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConferenceTopics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conferences" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "acronym" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "Conferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConferenceRanks" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "conferenceId" TEXT NOT NULL,
    "fieldOfResearchId" TEXT NOT NULL,
    "rankId" TEXT NOT NULL,

    CONSTRAINT "ConferenceRanks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldOfResearchs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "FieldOfResearchs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ranks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "Ranks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "link" TEXT,

    CONSTRAINT "Sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalTopics" (
    "id" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,

    CONSTRAINT "JournalTopics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalRanks" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "journalId" TEXT NOT NULL,
    "fieldOfResearchId" TEXT NOT NULL,
    "rankId" TEXT NOT NULL,

    CONSTRAINT "JournalRanks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Journals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issn" TEXT NOT NULL,
    "hIndex" INTEGER NOT NULL,
    "publisher" TEXT NOT NULL,
    "nation" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "emailSubmission" TEXT NOT NULL,
    "creator" TEXT NOT NULL,

    CONSTRAINT "Journals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConferenceFollows" (
    "id" TEXT NOT NULL,
    "conferenceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConferenceFollows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConferenceLikes" (
    "id" TEXT NOT NULL,
    "conferenceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConferenceLikes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConferenceFeedbacks" (
    "id" TEXT NOT NULL,
    "conferenceId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "star" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConferenceFeedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConferenceCalendars" (
    "id" TEXT NOT NULL,
    "conferenceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConferenceCalendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLikes" (
    "id" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalLikes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalFollows" (
    "id" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalFollows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConferenceCrawlJobs" (
    "id" TEXT NOT NULL,
    "conferenceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "progress" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConferenceCrawlJobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalCrawlJobs" (
    "id" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "progress" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalCrawlJobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Passenger_firstName_key" ON "Passenger"("firstName");

-- CreateIndex
CREATE UNIQUE INDEX "Topics_name_key" ON "Topics"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Conferences_title_acronym_key" ON "Conferences"("title", "acronym");

-- CreateIndex
CREATE UNIQUE INDEX "Sources_name_key" ON "Sources"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ConferenceFollows_conferenceId_userId_key" ON "ConferenceFollows"("conferenceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConferenceLikes_conferenceId_userId_key" ON "ConferenceLikes"("conferenceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConferenceCalendars_conferenceId_userId_key" ON "ConferenceCalendars"("conferenceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Users_email_key" ON "Users"("email");

-- AddForeignKey
ALTER TABLE "Locations" ADD CONSTRAINT "Locations_organizeId_fkey" FOREIGN KEY ("organizeId") REFERENCES "ConferenceOrganizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenceDates" ADD CONSTRAINT "ConferenceDates_organizedId_fkey" FOREIGN KEY ("organizedId") REFERENCES "ConferenceOrganizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenceOrganizations" ADD CONSTRAINT "ConferenceOrganizations_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conferences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenceTopics" ADD CONSTRAINT "ConferenceTopics_organizeId_fkey" FOREIGN KEY ("organizeId") REFERENCES "ConferenceOrganizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenceTopics" ADD CONSTRAINT "ConferenceTopics_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conferences" ADD CONSTRAINT "Conferences_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenceRanks" ADD CONSTRAINT "ConferenceRanks_fieldOfResearchId_fkey" FOREIGN KEY ("fieldOfResearchId") REFERENCES "FieldOfResearchs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenceRanks" ADD CONSTRAINT "ConferenceRanks_rankId_fkey" FOREIGN KEY ("rankId") REFERENCES "Ranks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenceRanks" ADD CONSTRAINT "ConferenceRanks_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conferences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ranks" ADD CONSTRAINT "Ranks_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalTopics" ADD CONSTRAINT "JournalTopics_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalTopics" ADD CONSTRAINT "JournalTopics_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalRanks" ADD CONSTRAINT "JournalRanks_fieldOfResearchId_fkey" FOREIGN KEY ("fieldOfResearchId") REFERENCES "FieldOfResearchs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalRanks" ADD CONSTRAINT "JournalRanks_rankId_fkey" FOREIGN KEY ("rankId") REFERENCES "Ranks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalRanks" ADD CONSTRAINT "JournalRanks_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Journals" ADD CONSTRAINT "Journals_creator_fkey" FOREIGN KEY ("creator") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenceFollows" ADD CONSTRAINT "ConferenceFollows_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conferences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenceFollows" ADD CONSTRAINT "ConferenceFollows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenceLikes" ADD CONSTRAINT "ConferenceLikes_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conferences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenceLikes" ADD CONSTRAINT "ConferenceLikes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenceFeedbacks" ADD CONSTRAINT "ConferenceFeedbacks_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conferences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenceFeedbacks" ADD CONSTRAINT "ConferenceFeedbacks_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenceCalendars" ADD CONSTRAINT "ConferenceCalendars_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conferences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenceCalendars" ADD CONSTRAINT "ConferenceCalendars_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLikes" ADD CONSTRAINT "JournalLikes_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLikes" ADD CONSTRAINT "JournalLikes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalFollows" ADD CONSTRAINT "JournalFollows_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalFollows" ADD CONSTRAINT "JournalFollows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenceCrawlJobs" ADD CONSTRAINT "ConferenceCrawlJobs_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conferences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalCrawlJobs" ADD CONSTRAINT "JournalCrawlJobs_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
