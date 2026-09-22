-- FASE 9.4 (iteracion 2): SAML por empresa sobre el mismo SsoProvider.
-- protocol distingue el flujo; los campos OIDC quedan NOT NULL pero vacios
-- cuando el proveedor es SAML (una fila solo usa los campos de su protocolo).
ALTER TABLE "SsoProvider" ADD COLUMN "protocol" TEXT NOT NULL DEFAULT 'OIDC';
ALTER TABLE "SsoProvider" ADD COLUMN "idpMetadata" TEXT;
ALTER TABLE "SsoProvider" ADD COLUMN "idpEntityId" TEXT;
ALTER TABLE "SsoProvider" ADD COLUMN "idpSsoUrl" TEXT;
ALTER TABLE "SsoProvider" ADD COLUMN "idpCertificate" TEXT;
ALTER TABLE "SsoProvider" ADD COLUMN "spEntityId" TEXT;

-- Un solo proveedor activo por empresa (FK de Company ya es unique).
CREATE INDEX "SsoProvider_protocol_idx" ON "SsoProvider"("protocol");
