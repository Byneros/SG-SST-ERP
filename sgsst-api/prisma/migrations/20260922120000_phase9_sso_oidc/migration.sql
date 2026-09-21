-- FASE 9.4: SSO OIDC por empresa.
-- Company.ssoProviderId + unique index (la tabla es nueva, siempre es unique).
ALTER TABLE "Company" ADD COLUMN "ssoProviderId" TEXT;
CREATE UNIQUE INDEX "Company_ssoProviderId_key" ON "Company"("ssoProviderId");

-- Identidad federada: sujeto del IdP (sub) unico por usuario.
ALTER TABLE "User" ADD COLUMN "ssoSubject" TEXT;
CREATE UNIQUE INDEX "User_ssoSubject_key" ON "User"("ssoSubject");

-- Configuracion OIDC por empresa (1:1 con Company).
CREATE TABLE "SsoProvider" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "issuer" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "clientSecret" TEXT NOT NULL,
  "authorizationEndpoint" TEXT NOT NULL,
  "tokenEndpoint" TEXT NOT NULL,
  "userinfoEndpoint" TEXT,
  "scopes" TEXT NOT NULL DEFAULT 'openid email profile',
  "defaultRole" "Role" NOT NULL DEFAULT 'EMPLOYEE',
  "jwksUri" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SsoProvider_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SsoProvider_issuer_idx" ON "SsoProvider"("issuer");

ALTER TABLE "SsoProvider" ADD CONSTRAINT "SsoProvider_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Company" ADD CONSTRAINT "Company_ssoProviderId_fkey"
  FOREIGN KEY ("ssoProviderId") REFERENCES "SsoProvider"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- States de autorizacion: robusto a multiples replicas/instancias.
CREATE TABLE "SsoState" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "redirect" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SsoState_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SsoState_expiresAt_idx" ON "SsoState"("expiresAt");
