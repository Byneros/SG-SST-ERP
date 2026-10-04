-- CreateEnum
CREATE TYPE "CommitteeType" AS ENUM ('COPASST', 'CONVIVENCIA');

-- CreateEnum
CREATE TYPE "CommitteeStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "CommitteeMemberRole" AS ENUM ('PRESIDENT', 'SECRETARY', 'PRINCIPAL', 'SUPERNUMERARY');

-- CreateEnum
CREATE TYPE "CommitteeSeatType" AS ENUM ('PRINCIPAL', 'ALTERNATE');

-- CreateEnum
CREATE TYPE "CommitteeMeetingStatus" AS ENUM ('SCHEDULED', 'HELD', 'CANCELLED');

-- CreateTable
CREATE TABLE "Committee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CommitteeType" NOT NULL DEFAULT 'COPASST',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "CommitteeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "Committee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitteeMember" (
    "id" TEXT NOT NULL,
    "role" "CommitteeMemberRole" NOT NULL,
    "seatType" "CommitteeSeatType" NOT NULL DEFAULT 'PRINCIPAL',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "committeeId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "CommitteeMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitteeMeeting" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "meetingAt" TIMESTAMP(3) NOT NULL,
    "agenda" TEXT,
    "notes" TEXT,
    "status" "CommitteeMeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "committeeId" TEXT NOT NULL,
    "minutesDocumentId" TEXT,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "CommitteeMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitteeCommitment" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsibleEmployeeId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "meetingId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "CommitteeCommitment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Committee_companyId_type_idx" ON "Committee"("companyId", "type");

-- CreateIndex
CREATE INDEX "Committee_companyId_status_idx" ON "Committee"("companyId", "status");

-- CreateIndex
CREATE INDEX "CommitteeMember_companyId_idx" ON "CommitteeMember"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CommitteeMember_committeeId_employeeId_key" ON "CommitteeMember"("committeeId", "employeeId");

-- CreateIndex
CREATE INDEX "CommitteeMeeting_companyId_meetingAt_idx" ON "CommitteeMeeting"("companyId", "meetingAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommitteeMeeting_committeeId_number_key" ON "CommitteeMeeting"("committeeId", "number");

-- CreateIndex
CREATE INDEX "CommitteeCommitment_meetingId_idx" ON "CommitteeCommitment"("meetingId");

-- CreateIndex
CREATE INDEX "CommitteeCommitment_companyId_dueDate_idx" ON "CommitteeCommitment"("companyId", "dueDate");

-- AddForeignKey
ALTER TABLE "Committee" ADD CONSTRAINT "Committee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeMember" ADD CONSTRAINT "CommitteeMember_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeMember" ADD CONSTRAINT "CommitteeMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeMember" ADD CONSTRAINT "CommitteeMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeMeeting" ADD CONSTRAINT "CommitteeMeeting_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeMeeting" ADD CONSTRAINT "CommitteeMeeting_minutesDocumentId_fkey" FOREIGN KEY ("minutesDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeMeeting" ADD CONSTRAINT "CommitteeMeeting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeCommitment" ADD CONSTRAINT "CommitteeCommitment_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "CommitteeMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeCommitment" ADD CONSTRAINT "CommitteeCommitment_responsibleEmployeeId_fkey" FOREIGN KEY ("responsibleEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeCommitment" ADD CONSTRAINT "CommitteeCommitment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

