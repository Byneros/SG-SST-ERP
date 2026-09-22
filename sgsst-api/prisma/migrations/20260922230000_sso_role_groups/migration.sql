-- Overrides de rol por grupo del IdP (Fase 9.4, roadmap SSO).
-- JSON '{ "grupo-del-idp": "ROL", ... }' persistido en el provider.
-- Los usuarios cuyo assertion/token incluya un grupo mapeado entran con ese
-- rol (JIT) o se promovian/degradan al vincular; el resto usa defaultRole.
ALTER TABLE "SsoProvider" ADD COLUMN "roleGroups" JSONB;
