ALTER TABLE "User"
  ADD COLUMN "refreshTokenHash" TEXT,
  ADD COLUMN "passwordResetTokenHash" TEXT,
  ADD COLUMN "passwordResetExpiresAt" TIMESTAMP(3);
