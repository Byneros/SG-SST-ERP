# Smoke de revalidación post-S16 — ciclo S2–S14 (2026-10-15)

Corte: **2026-10-15** · Rama `main` · Base de commits: `4d947a6` (S5-S6) + `4ebe57a` (S15).
Cierre de la **deuda transversal #3** (`docs/analisis-avance-sprints-2026-10-14.md` §3): no existía una
corrida de humo formal desde los cambios de S15/S16; esta sesión la ejecuta y documenta.

> Convención del repo: los archivos de evidencia viven en `scripts/qa-artifacts/` (no versionados);
> este doc registra los resultados y el mapeo por sprint.

## 1. Metodología

1. Barrido de suites primero (valida los commits del día):
   - `npm run test` → **519/519** tests, 65 suites PASS (exit 0).
   - `npm run build` → exit 0.
   - `npm run test:e2e` → **67/67** tests PASS (security, sso-multi-tenant, multi-tenant-isolation, external-deliveries).
   - `npm run test:e2e:db` → **41/41** tests PASS sobre PostgreSQL efímero (prisma-integration, contractors, medical-surveillance, developer).
2. Barrido de smoke HTTP contra el stack dev (los 8 scripts `scripts/smoke-*.mjs`): 8/8 verdes, **148/148 pasos**.
3. Dos scripts estaban obsoletos frente al DTO endurecido de documentos
   (`CreateDocumentDto` rechaza ahora la propiedad `status`, con whitelist): `smoke-s14.mjs` y
   `smoke-s15-actions.mjs` fallaban en el `POST /documents`. **Fix del script** (se retiró el campo);
   no fue un bug de producto. Re-ejecutados: 19/19 y 25/25.

## 2. Resultados de smoke (exit code capturado en `scripts/qa-artifacts/smoke-post-s16-20261015.txt`)

| Script | Resultado | Cubre |
|---|---|---|
| `smoke-s8-10.mjs` | 24/24 OK (exit 0) | S8 plan anual (actividad PHVA al 100% + reporte annual-plan CSV), S9 profesiograma, S10 examen ocupacional APTO y restricción LEVANTADA |
| `smoke-s14.mjs` | 19/19 OK (exit 0) | S14 workflow completo con guardas (REQUESTED→…→CLOSED), sello de aprobador, rechazo de saltos y de avance sobre cerrado |
| `smoke-s8-10-cleanup.mjs` | 4 recursos [SMOKE] eliminados (exit 0) | higiene |
| `smoke-s15-findings.mjs` | 14/14 OK (exit 0) | S15.1 hallazgos unificados |
| `smoke-s15-actions.mjs` | 25/25 OK (exit 0) | S15.2 acciones correctivas con guardas |
| `smoke-s15-tasks.mjs` | 23/23 OK (exit 0) | S15.3 bandeja de tareas |
| `smoke-s16-capabilities.mjs` | 16/16 PASS (exit 0) | S16 capacidades del asistente por rol (con login SST/EMPLOYEE temporales y limpieza) |
| `smoke-tasks-escalation.mjs` | 9/9 OK (exit 0) | S16 escalamiento habilitado/deshabilitado |

Extras que refuerzan el corte del mismo día (sin re-corrida en esta sesión):
- S15 revalidado por la sesión QA que cerró **#40, #55 y #56** (aceptaciones TODO PASS y guardas 17/17, AuditLog con actor).
- S5/S6 con datos demo `[QA-S56]` vigentes en dev y su aceptación de 2026-10-14.

## 3. Cobertura por sprint (S2–S14)

| Sprint | Evidencia de la revalidación |
|---|---|
| S2 auth/RBAC | `test:e2e` security + `smoke-s16-capabilities` (login por rol) |
| S3 empresas/empleados/sedes | `e2e-db` prisma-integration + capabilities multi-tenant |
| S4 documentos/notificaciones | `e2e` external-deliveries + capabilities |
| S5 riesgos GTC-45 | capabilities + datos `[QA-S56]` en dev |
| S6 incidentes/capacitación | capabilities + datos `[QA-S56]` en dev |
| S7 hardening | `test:e2e` security (67 pruebas, incl. reglas de seguridad) |
| S8 plan anual de trabajo | `smoke-s8-10` 24/24 |
| S9 profesiogramas | `smoke-s8-10` 24/24 |
| S10 exámenes médicos | `smoke-s8-10` 24/24 + caps |
| S11 evaluaciones SG-SST | `e2e-db` prisma-integration + suite unitaria del módulo |
| S12 legales/comités | suite unitaria + capabilities |
| S13 contratistas | `e2e-db` contractors + capabilities |
| S14 gestión del cambio | `smoke-s14` 19/19 con guardas |
| extras S15/S16 | smoke 62/62 + 25/25, y S15 revalidado hoy por QA #40/#55/#56 |

## 4. Resultado global

**TODO PASS** — 8/8 smoke scripts verdes (148/148 pasos), unitaria 519/519,
e2e 67/67, e2e-db 41/41, build exit 0, en el mismo corte 2026-10-15.
La deuda #3 queda cerrada; no se detectó regresión funcional atribuible a S15/S16
sobre el ciclo S2–S14. Los dos únicos hallazgos fueron scripts de humo obsoletos
(campo `status` de documentos), corregidos en esta sesión.

Nota de higiene: los recursos `[SMOKE]` se limpian solos al final de cada script;
los datos demo de QA (`[QA-S56]`/`[QA-S15]`) siguen en dev por decisión de la
sesión, para soportar los issues #57/#58.
