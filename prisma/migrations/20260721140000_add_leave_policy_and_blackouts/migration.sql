-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'SICK', 'UNPAID', 'PARENTAL', 'SPECIAL');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "LeavePolicy" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "department" "StaffDepartment" NOT NULL,
    "annualDays" INTEGER NOT NULL DEFAULT 26,
    "maxConcurrentOff" INTEGER NOT NULL DEFAULT 2,
    "minNoticeDays" INTEGER NOT NULL DEFAULT 14,
    "autoApprove" BOOLEAN NOT NULL DEFAULT true,
    "countWeekends" BOOLEAN NOT NULL DEFAULT true,
    "allowCarryOver" BOOLEAN NOT NULL DEFAULT true,
    "carryOverDays" INTEGER NOT NULL DEFAULT 5,
    "carryOverDeadline" TEXT NOT NULL DEFAULT '06-30',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueBlackoutDate" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "department" "StaffDepartment" NOT NULL,
    "date" DATE NOT NULL,
    "maxOff" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueBlackoutDate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeavePolicy_venueId_department_key" ON "LeavePolicy"("venueId", "department");

-- CreateIndex
CREATE INDEX "VenueBlackoutDate_venueId_date_idx" ON "VenueBlackoutDate"("venueId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "VenueBlackoutDate_venueId_department_date_key" ON "VenueBlackoutDate"("venueId", "department", "date");

-- AddForeignKey
ALTER TABLE "LeavePolicy" ADD CONSTRAINT "LeavePolicy_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueBlackoutDate" ADD CONSTRAINT "VenueBlackoutDate_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

