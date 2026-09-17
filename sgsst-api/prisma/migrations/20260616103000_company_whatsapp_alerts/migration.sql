ALTER TABLE "Company"
  ADD COLUMN "whatsappAlertsEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "whatsappAlertPhone" TEXT;
