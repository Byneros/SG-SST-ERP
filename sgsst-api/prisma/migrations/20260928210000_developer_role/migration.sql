-- S11.1: Rol tecnico de plataforma DEVELOPER (sin empresa, sin datos de tenants).
-- Alter en batch: PostgreSQL no permite ADD VALUE dentro de una transaccion,
-- Prisma lo ejecuta con su alternativa de batch para enums.
ALTER TYPE "Role" ADD VALUE 'DEVELOPER';
