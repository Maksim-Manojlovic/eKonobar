-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('WAITER', 'VENUE_OWNER', 'HEADHUNTER', 'ADMIN', 'GUEST');

-- CreateEnum
CREATE TYPE "VerificationTier" AS ENUM ('UNVERIFIED', 'SILVER', 'GOLD', 'ID_VERIFIED');

-- CreateEnum
CREATE TYPE "VenueType" AS ENUM ('RESTAURANT', 'CAFE', 'BAR', 'CATERING', 'HOTEL', 'EVENT');

-- CreateEnum
CREATE TYPE "EngagementType" AS ENUM ('FULL_TIME', 'SEASONAL', 'WEEKEND', 'CELEBRATION');

-- CreateEnum
CREATE TYPE "TipSystem" AS ENUM ('INDIVIDUAL', 'SHARED', 'VENUE_POLICY');

-- CreateEnum
CREATE TYPE "JobPostStatus" AS ENUM ('ACTIVE', 'PAUSED', 'FILLED', 'EXPIRED', 'DELETED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'SHORTLISTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ReviewDirection" AS ENUM ('WAITER_TO_VENUE', 'VENUE_TO_WAITER', 'GUEST_TO_WAITER', 'GUEST_TO_VENUE');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'PUBLISHED', 'DISPUTED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ZoneType" AS ENUM ('FESTIVAL_ZONE', 'TRANSIT_HUB', 'DEVELOPMENT', 'NIGHTLIFE', 'TOURIST_AREA', 'STUDENT_AREA', 'RESIDENTIAL');

-- CreateEnum
CREATE TYPE "SanitaryStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'ASSIGNED', 'PENDING_SWAP', 'LOCKED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClockInMethod" AS ENUM ('GPS', 'GPS_GRACE', 'QR', 'MANUAL');

-- CreateEnum
CREATE TYPE "SwapRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('APPLICATION_RECEIVED', 'APPLICATION_STATUS_CHANGED', 'SWAP_REQUESTED', 'SWAP_RESOLVED', 'SHIFT_CLAIMED', 'SHIFT_ASSIGNED', 'REVIEW_RECEIVED', 'REVIEW_PUBLISHED', 'CLOCKIN_APPROVAL_REQUESTED', 'CLOCKIN_RESOLVED');

-- CreateEnum
CREATE TYPE "PassportTier" AS ENUM ('FREE', 'PRO', 'PRO_PLUS');

-- CreateEnum
CREATE TYPE "InviteType" AS ENUM ('VERIFICATION', 'JOB_INVITE');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "hashedPassword" TEXT,
    "role" "Role" NOT NULL DEFAULT 'WAITER',
    "verificationTier" "VerificationTier" NOT NULL DEFAULT 'UNVERIFIED',
    "jmbgHash" TEXT,
    "idVerifiedAt" TIMESTAMP(3),
    "rememberMe" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "tourCompleted" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "smsOptIn" BOOLEAN NOT NULL DEFAULT false,
    "waOptIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "headWaiterId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT NOT NULL,
    "municipality" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Beograd',
    "venueType" "VenueType" NOT NULL,
    "cuisineTypes" TEXT[],
    "capacity" INTEGER,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "reviewRadiusKm" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "geofenceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "priceRangeMin" DOUBLE PRECISION,
    "priceRangeMax" DOUBLE PRECISION,
    "images" TEXT[],
    "logo" TEXT,
    "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "venueInsights" JSONB,
    "website" TEXT,
    "phone" TEXT,
    "instagram" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPost" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "engagementType" "EngagementType" NOT NULL,
    "salaryMin" DOUBLE PRECISION,
    "salaryMax" DOUBLE PRECISION,
    "tipSystem" "TipSystem" NOT NULL,
    "tipDescription" TEXT,
    "sanitaryRequired" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "applicationDeadline" TIMESTAMP(3),
    "redAlert" BOOLEAN NOT NULL DEFAULT false,
    "redAlertNote" TEXT,
    "inviteCode" TEXT,
    "status" "JobPostStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "JobPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "jobPostId" TEXT NOT NULL,
    "waiterId" TEXT NOT NULL,
    "coverNote" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "authorId" TEXT,
    "guestHandle" TEXT,
    "subjectId" TEXT,
    "venueId" TEXT,
    "direction" "ReviewDirection" NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "overallRating" INTEGER NOT NULL,
    "comment" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "ratingAtmosphere" INTEGER,
    "ratingOrganization" INTEGER,
    "ratingPay" INTEGER,
    "ratingTips" INTEGER,
    "ratingHygieneWork" INTEGER,
    "ratingManagement" INTEGER,
    "ratingPunctuality" INTEGER,
    "ratingSkill" INTEGER,
    "ratingGuestCommunication" INTEGER,
    "ratingPersonalHygiene" INTEGER,
    "ratingTeamwork" INTEGER,
    "ratingSpeed" INTEGER,
    "ratingFriendliness" INTEGER,
    "ratingGuestSpeed" INTEGER,
    "ratingAttentiveness" INTEGER,
    "guestLatitude" DOUBLE PRECISION,
    "guestLongitude" DOUBLE PRECISION,
    "geolocationHash" TEXT,
    "pendingUntil" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "disputedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaiterPassport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "badges" TEXT[],
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "totalEngagements" INTEGER NOT NULL DEFAULT 0,
    "avgEngagementMonths" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "skills" TEXT[],
    "languages" TEXT[],
    "yearsExperience" INTEGER NOT NULL DEFAULT 0,
    "sanitaryBookValid" BOOLEAN NOT NULL DEFAULT false,
    "sanitaryExpiry" TIMESTAMP(3),
    "currentlyAvailable" BOOLEAN NOT NULL DEFAULT true,
    "shareToken" TEXT,
    "shareTokenExpiry" TIMESTAMP(3),
    "bio" TEXT,
    "profilePhoto" TEXT,
    "galleryPhotos" TEXT[],
    "venueTypePreferences" TEXT[],
    "avgRedAlertResponseMinutes" DOUBLE PRECISION,
    "redAlertResponseCount" INTEGER NOT NULL DEFAULT 0,
    "lastAvailableDate" TIMESTAMP(3),
    "passportTier" "PassportTier" NOT NULL DEFAULT 'FREE',
    "subscriptionExpiresAt" TIMESTAMP(3),
    "monriPanToken" TEXT,
    "tierRank" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaiterPassport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassportTrustScore" (
    "id" TEXT NOT NULL,
    "passportId" TEXT NOT NULL,
    "punctuality" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "skill" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "guestCommunication" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "personalHygiene" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "teamwork" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "speed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "composite" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PassportTrustScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueTrustScore" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "atmosphere" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "organization" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tips" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hygieneStandards" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "management" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "composite" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueTrustScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngagementRecord" (
    "id" TEXT NOT NULL,
    "waiterId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "jobPostId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "engagementType" "EngagementType" NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SanitaryBook" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "status" "SanitaryStatus" NOT NULL DEFAULT 'PENDING',
    "expiryDate" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SanitaryBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT,
    "code" TEXT NOT NULL,
    "venueId" TEXT,
    "jobPostId" TEXT,
    "type" "InviteType" NOT NULL DEFAULT 'VERIFICATION',
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zoneType" "ZoneType" NOT NULL,
    "description" TEXT,
    "geoJson" JSONB NOT NULL,
    "centerLat" DOUBLE PRECISION NOT NULL,
    "centerLng" DOUBLE PRECISION NOT NULL,
    "radiusKm" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "projectedGrowthPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "operatorTip" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueZoneRelation" (
    "venueId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,

    CONSTRAINT "VenueZoneRelation_pkey" PRIMARY KEY ("venueId","zoneId")
);

-- CreateTable
CREATE TABLE "SavedProfile" (
    "id" TEXT NOT NULL,
    "headhunterId" TEXT NOT NULL,
    "savedWaiterId" TEXT NOT NULL,
    "notes" TEXT,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "scheduledStart" TIMESTAMP(3),
    "role" TEXT,
    "requiredCount" INTEGER NOT NULL DEFAULT 1,
    "tipEstimate" DOUBLE PRECISION,
    "pay" INTEGER,
    "briefingNote" TEXT,
    "notes" TEXT,
    "templateId" TEXT,
    "status" "ShiftStatus" NOT NULL DEFAULT 'OPEN',
    "swapLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftAssignment" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "waiterId" TEXT NOT NULL,
    "clockInAt" TIMESTAMP(3),
    "clockOutAt" TIMESTAMP(3),
    "clockInMethod" "ClockInMethod",
    "clockInLat" DOUBLE PRECISION,
    "clockInLng" DOUBLE PRECISION,
    "earlyExitAt" TIMESTAMP(3),
    "lateMinutes" INTEGER,
    "cancelledLate" BOOLEAN NOT NULL DEFAULT false,
    "pendingClockIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftSwapRequest" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "fromAssignmentId" TEXT NOT NULL,
    "toWaiterId" TEXT NOT NULL,
    "status" "SwapRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ShiftSwapRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftTemplate" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dayOfWeek" INTEGER,
    "weekdaysOnly" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "requiredCount" INTEGER NOT NULL DEFAULT 1,
    "role" TEXT,
    "pay" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "windowStart" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "pushSent" BOOLEAN NOT NULL DEFAULT false,
    "waSent" BOOLEAN NOT NULL DEFAULT false,
    "smsSent" BOOLEAN NOT NULL DEFAULT false,
    "waRetries" INTEGER NOT NULL DEFAULT 0,
    "smsRetries" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassportPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "tier" "PassportTier" NOT NULL,
    "amountRsd" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "monriApprovalCode" TEXT,
    "monriPanToken" TEXT,
    "callbackReceivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PassportPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnonRateLimit" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AnonRateLimit_pkey" PRIMARY KEY ("key","windowStart")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenRevocation" (
    "userId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenRevocation_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_jmbgHash_key" ON "User"("jmbgHash");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_verificationTier_idx" ON "User"("verificationTier");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Venue_municipality_idx" ON "Venue"("municipality");

-- CreateIndex
CREATE INDEX "Venue_venueType_idx" ON "Venue"("venueType");

-- CreateIndex
CREATE INDEX "Venue_latitude_longitude_idx" ON "Venue"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "Venue_deletedAt_idx" ON "Venue"("deletedAt");

-- CreateIndex
CREATE INDEX "Venue_trustScore_idx" ON "Venue"("trustScore");

-- CreateIndex
CREATE UNIQUE INDEX "JobPost_inviteCode_key" ON "JobPost"("inviteCode");

-- CreateIndex
CREATE INDEX "JobPost_venueId_status_idx" ON "JobPost"("venueId", "status");

-- CreateIndex
CREATE INDEX "JobPost_engagementType_idx" ON "JobPost"("engagementType");

-- CreateIndex
CREATE INDEX "JobPost_redAlert_idx" ON "JobPost"("redAlert");

-- CreateIndex
CREATE INDEX "JobPost_sanitaryRequired_idx" ON "JobPost"("sanitaryRequired");

-- CreateIndex
CREATE INDEX "JobPost_deletedAt_idx" ON "JobPost"("deletedAt");

-- CreateIndex
CREATE INDEX "JobApplication_waiterId_idx" ON "JobApplication"("waiterId");

-- CreateIndex
CREATE INDEX "JobApplication_status_idx" ON "JobApplication"("status");

-- CreateIndex
CREATE INDEX "JobApplication_jobPostId_status_idx" ON "JobApplication"("jobPostId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_jobPostId_waiterId_key" ON "JobApplication"("jobPostId", "waiterId");

-- CreateIndex
CREATE INDEX "Review_subjectId_direction_status_idx" ON "Review"("subjectId", "direction", "status");

-- CreateIndex
CREATE INDEX "Review_venueId_direction_status_idx" ON "Review"("venueId", "direction", "status");

-- CreateIndex
CREATE INDEX "Review_status_idx" ON "Review"("status");

-- CreateIndex
CREATE INDEX "Review_pendingUntil_idx" ON "Review"("pendingUntil");

-- CreateIndex
CREATE UNIQUE INDEX "WaiterPassport_userId_key" ON "WaiterPassport"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WaiterPassport_shareToken_key" ON "WaiterPassport"("shareToken");

-- CreateIndex
CREATE INDEX "WaiterPassport_passportTier_idx" ON "WaiterPassport"("passportTier");

-- CreateIndex
CREATE INDEX "WaiterPassport_tierRank_score_idx" ON "WaiterPassport"("tierRank", "score");

-- CreateIndex
CREATE UNIQUE INDEX "PassportTrustScore_passportId_key" ON "PassportTrustScore"("passportId");

-- CreateIndex
CREATE UNIQUE INDEX "VenueTrustScore_venueId_key" ON "VenueTrustScore"("venueId");

-- CreateIndex
CREATE INDEX "EngagementRecord_waiterId_idx" ON "EngagementRecord"("waiterId");

-- CreateIndex
CREATE INDEX "EngagementRecord_venueId_idx" ON "EngagementRecord"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "SanitaryBook_userId_key" ON "SanitaryBook"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_code_key" ON "Invite"("code");

-- CreateIndex
CREATE INDEX "Invite_code_idx" ON "Invite"("code");

-- CreateIndex
CREATE INDEX "Invite_senderId_idx" ON "Invite"("senderId");

-- CreateIndex
CREATE INDEX "Invite_recipientId_idx" ON "Invite"("recipientId");

-- CreateIndex
CREATE INDEX "VenueZone_zoneType_idx" ON "VenueZone"("zoneType");

-- CreateIndex
CREATE INDEX "SavedProfile_headhunterId_idx" ON "SavedProfile"("headhunterId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedProfile_headhunterId_savedWaiterId_key" ON "SavedProfile"("headhunterId", "savedWaiterId");

-- CreateIndex
CREATE INDEX "Shift_venueId_idx" ON "Shift"("venueId");

-- CreateIndex
CREATE INDEX "Shift_date_idx" ON "Shift"("date");

-- CreateIndex
CREATE INDEX "Shift_scheduledStart_idx" ON "Shift"("scheduledStart");

-- CreateIndex
CREATE INDEX "Shift_status_idx" ON "Shift"("status");

-- CreateIndex
CREATE INDEX "Shift_templateId_date_idx" ON "Shift"("templateId", "date");

-- CreateIndex
CREATE INDEX "ShiftAssignment_waiterId_idx" ON "ShiftAssignment"("waiterId");

-- CreateIndex
CREATE INDEX "ShiftAssignment_shiftId_idx" ON "ShiftAssignment"("shiftId");

-- CreateIndex
CREATE INDEX "ShiftAssignment_pendingClockIn_idx" ON "ShiftAssignment"("pendingClockIn");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftAssignment_shiftId_waiterId_key" ON "ShiftAssignment"("shiftId", "waiterId");

-- CreateIndex
CREATE INDEX "ShiftSwapRequest_shiftId_idx" ON "ShiftSwapRequest"("shiftId");

-- CreateIndex
CREATE INDEX "ShiftSwapRequest_toWaiterId_idx" ON "ShiftSwapRequest"("toWaiterId");

-- CreateIndex
CREATE INDEX "ShiftSwapRequest_status_idx" ON "ShiftSwapRequest"("status");

-- CreateIndex
CREATE INDEX "ShiftTemplate_venueId_idx" ON "ShiftTemplate"("venueId");

-- CreateIndex
CREATE INDEX "RateLimit_userId_action_idx" ON "RateLimit"("userId", "action");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_userId_action_windowStart_key" ON "RateLimit"("userId", "action", "windowStart");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PassportPayment_orderNumber_key" ON "PassportPayment"("orderNumber");

-- CreateIndex
CREATE INDEX "PassportPayment_userId_idx" ON "PassportPayment"("userId");

-- CreateIndex
CREATE INDEX "PassportPayment_orderNumber_idx" ON "PassportPayment"("orderNumber");

-- CreateIndex
CREATE INDEX "PassportPayment_status_idx" ON "PassportPayment"("status");

-- CreateIndex
CREATE INDEX "AnonRateLimit_key_idx" ON "AnonRateLimit"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_targetId_idx" ON "AuditLog"("targetId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_headWaiterId_fkey" FOREIGN KEY ("headWaiterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPost" ADD CONSTRAINT "JobPost_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPost" ADD CONSTRAINT "JobPost_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_jobPostId_fkey" FOREIGN KEY ("jobPostId") REFERENCES "JobPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiterPassport" ADD CONSTRAINT "WaiterPassport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassportTrustScore" ADD CONSTRAINT "PassportTrustScore_passportId_fkey" FOREIGN KEY ("passportId") REFERENCES "WaiterPassport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueTrustScore" ADD CONSTRAINT "VenueTrustScore_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementRecord" ADD CONSTRAINT "EngagementRecord_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementRecord" ADD CONSTRAINT "EngagementRecord_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementRecord" ADD CONSTRAINT "EngagementRecord_jobPostId_fkey" FOREIGN KEY ("jobPostId") REFERENCES "JobPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SanitaryBook" ADD CONSTRAINT "SanitaryBook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueZoneRelation" ADD CONSTRAINT "VenueZoneRelation_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueZoneRelation" ADD CONSTRAINT "VenueZoneRelation_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "VenueZone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedProfile" ADD CONSTRAINT "SavedProfile_headhunterId_fkey" FOREIGN KEY ("headhunterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedProfile" ADD CONSTRAINT "SavedProfile_savedWaiterId_fkey" FOREIGN KEY ("savedWaiterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ShiftTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSwapRequest" ADD CONSTRAINT "ShiftSwapRequest_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSwapRequest" ADD CONSTRAINT "ShiftSwapRequest_fromAssignmentId_fkey" FOREIGN KEY ("fromAssignmentId") REFERENCES "ShiftAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSwapRequest" ADD CONSTRAINT "ShiftSwapRequest_toWaiterId_fkey" FOREIGN KEY ("toWaiterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftTemplate" ADD CONSTRAINT "ShiftTemplate_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateLimit" ADD CONSTRAINT "RateLimit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassportPayment" ADD CONSTRAINT "PassportPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenRevocation" ADD CONSTRAINT "TokenRevocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

