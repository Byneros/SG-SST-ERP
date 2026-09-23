-- Bloqueo temporal de cuentas por intentos fallidos de login (hardening auth).
-- Tras LOGIN_LOCKOUT_MAX_ATTEMPTS fallos la cuenta queda bloqueada por
-- LOGIN_LOCKOUT_MINUTES (defecto 15). Reset en login exitoso o password reset.
ALTER TABLE "User" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lockedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- Soporte para consultas de cuentas bloqueadas y desbloqueo expirado.
CREATE INDEX "User_lockedUntil_idx" ON "User"("lockedUntil");
