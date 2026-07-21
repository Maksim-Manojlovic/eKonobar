-- CreateEnum
CREATE TYPE "StaffDepartment" AS ENUM ('FOH', 'BOH');

-- CreateEnum
CREATE TYPE "StaffPosition" AS ENUM ('WAITER', 'SENIOR_WAITER', 'HEAD_WAITER', 'BARTENDER', 'BARISTA', 'RUNNER', 'HOST', 'SOMMELIER', 'HEAD_CHEF', 'SOUS_CHEF', 'LINE_COOK', 'PREP_COOK', 'PASTRY_CHEF', 'GRILL_COOK', 'DISHWASHER');

-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ENDED');

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "department" "StaffDepartment";

-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "headChefId" TEXT,
ADD COLUMN     "kitchenEnabled" BOOLEAN;

-- CreateTable
CREATE TABLE "VenueStaff" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "waiterId" TEXT NOT NULL,
    "position" "StaffPosition" NOT NULL,
    "department" "StaffDepartment" NOT NULL,
    "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE',
    "employmentType" "EngagementType" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueStaff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VenueStaff_venueId_status_idx" ON "VenueStaff"("venueId", "status");

-- CreateIndex
CREATE INDEX "VenueStaff_venueId_department_status_idx" ON "VenueStaff"("venueId", "department", "status");

-- CreateIndex
CREATE INDEX "VenueStaff_waiterId_idx" ON "VenueStaff"("waiterId");

-- CreateIndex
CREATE UNIQUE INDEX "VenueStaff_venueId_waiterId_key" ON "VenueStaff"("venueId", "waiterId");

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_headChefId_fkey" FOREIGN KEY ("headChefId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueStaff" ADD CONSTRAINT "VenueStaff_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueStaff" ADD CONSTRAINT "VenueStaff_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

