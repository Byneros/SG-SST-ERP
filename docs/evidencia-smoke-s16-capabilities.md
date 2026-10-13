# Evidencia smoke S16 — capabilities por rol (cierre en bloque)

Fecha: 2026-10-13 · Rama `main` · Último commit: `d243f86` (feat(documents): add approval workflow).
Cierra el **único trabajo técnico nuevo pendiente** del cierre en bloque S16
(`docs/pendientes-consolidados-2026-10-10.md`, plan de acción #3): smoke HTTP del
endpoint `capabilities` por rol con los 13 asistentes del registro.

## 1. Script nuevo

`scripts/smoke-s16-capabilities.mjs`, patrón idéntico a los smokes previos
(`scripts/smoke-s15-findings.mjs`): HTTP real contra la API dev, resultados
PASS/FAIL paso a paso y salida con código de estado.

- No usa datos preexistentes sensibles: crea vía `POST /users` dos usuarios
  de rol QA (`s16cap-sst-*@demo.com`, `s16cap-employee-*@demo.com`) con
  `companyId` resuelto del `/auth/me` del ADMIN (el scope multi-tenant
  exige `companyId` explícito para actores tenant-scoped), y los elimina
  al final con `DELETE /users/:id` (limpieza verificada HTTP 200).
- Password tomada de `SEED_ADMIN_PASSWORD` del contenedor (exige pasarla
  por argumento/env; el script no la imprime).

## 2. Preparación del entorno (hallazgo y corrección)

El contenedor `sgsst_api` corría la imagen `sg-sst-erp-api:local` de hace
~3 días (sin las fases E–L completas): `capabilities` devolvía el campo
`assistants` vacío. Se reconstruyó con `docker compose up -d --build api`
y tras el healthcheck el registro completo quedó servido por HTTP.

## 3. Resultado — 16/16 PASS

```text
PASS  S1 login ADMIN
PASS  S1 auth/me (companyId del scope) — company=1472d34f-...
PASS  S1 login SST (creado por corrida)
PASS  S1 login EMPLOYEE (creado por corrida)
PASS  S2 capabilities ADMIN -> 200
PASS  S2 ADMIN: 13 asistentes en orden del registro
PASS  S2 ADMIN: modulo de cada asistente
PASS  S2 ADMIN: contrato fase 1 intacto (enabled/roles/dataTools/helpTopics/limits)
PASS  S2 ADMIN: rol incluido en ASSISTANT_ALLOWED_ROLES
PASS  S2 capabilities SST -> 200
PASS  S2 SST: 13 asistentes en orden del registro
PASS  S2 SST: modulo de cada asistente
PASS  S2 SST: contrato fase 1 intacto (enabled/roles/dataTools/helpTopics/limits)
PASS  S2 SST: rol incluido en ASSISTANT_ALLOWED_ROLES
PASS  S3 capabilities EMPLOYEE -> 403
PASS  S4 capabilities sin token -> 401
LIMPIEZA DELETE /users/... (s16cap-sst-...)  -> HTTP 200
LIMPIEZA DELETE /users/... (s16cap-employee-...)  -> HTTP 200
```

Ids y orden verificados (idénticos para ADMIN y SST, en el orden del
registro `assistant-registry.ts`):

central(dashboard), risks, incidents, findings, trainings, medical, ppe,
contractors, committees, emergency, audit(sgsst-audits), indicators, documents.

## 4. Contenido de la validación

1. **Filtrado por rol**: ADMIN y SST ven exactamente los 13 asistentes del
   registro, ni más ni menos, en el orden del `ASSISTANT_REGISTRY`.
2. **Guard EMPLOYEE**: `GET /ai-assistant/capabilities` → 403 por el
   `RolesGuard` del controller (el listado nunca llega a filtrarse).
3. **JWT**: sin token → 401.
4. **Contrato fase 1 intacto** (no regresión): `enabled`, `roles`
   (incluye el rol consultado, sin EMPLOYEE), `dataTools`, `helpTopics`,
   `limits.maxMessageLength === 4000`, además del campo `assistants` de
   la Fase L.

## 5. QA UI en navegador frío (Fase L, issue #54)

`scripts/qa-s16-entry-point-ui.mjs` (Playwright headless, canal Chrome del
sistema) contra el dev server de Vite con `VITE_API_URL` apuntando a la API
de desarrollo — **6/6 PASS**:

```text
PASS 0 login UI (navegador frío)
PASS 1 entry point "Preguntar al asistente" visible en Riesgos
PASS 2 hash #/aiAssistant?assistant=risks tras el click
PASS 3 vista del chat con el asistente especializado activo
PASS 4 sin errores de consola en el flujo
PASS 5 sin requests fallidos (fuera del 503 sin proveedor IA)
```

Flujo verificado: login UI frío → módulo Riesgos via menú → click en el
entry point `ModuleAssistantButton` (`Preguntar al asistente`) → vista del
chat con `#/aiAssistant?assistant=risks` y el título del asistente
especializado activo, 0 errores de consola y 0 requests fallidos (el 503
acotado por ausencia de proveedor IA es degradación documentada del plan §1).
La llamada al backend (`POST /auth/login` 201 y los reads del módulo 200)
queda registrada en la captura del script.

## 6. Contexto de la suite al momento del smoke

- Unitarias backend: **519/519** (`npm run test`, incluye las nuevas del
  workflow de aprobación de documentos, commit `d243f86`).
- e2e-db: **67/67** (`npm run test:e2e`, incluye las 12 del asistente de
  `b0a07cb` + integración de `d243f86`).
- Builds: `sgsst-api` (`nest build`) y `sgsst-web` (`vite build`) OK.

Nota de entorno: la imagen `sg-sst-erp-api:local`/`web` del compose tenía
~3 días; el smoke y el QA UI corrieron tras `docker compose up -d --build api`
(migraciones + seed del arranque) y una instancia de `npm run dev` de
`sgsst-web` apuntando a la API reconstruida.
