# Evidencia de implementacion S8 (issues #17-#20)

> Pegar cada bloque como comentario en el issue correspondiente. La aceptacion
> formal (checkboxes del issue #43) queda pendiente de validacion con BD dev
> real y UI, segun el flujo Codigo -> Prueba -> Evidencia -> Checkbox -> Cierre.

## S8.1 - Issue #17 (Plan Anual: modelo + CRUD + scope + roles + auditoria)

**Estado implementacion:** completa en backend.

- Modelo `AnnualWorkPlan` (`sgsst-api/prisma/schema.prisma`): `@@unique([companyId, year])`, aprobador opcional (User), sin columnas soft-delete (ADR de borrado: hard delete + traza).
- Migracion: `prisma/migrations/20260925120000_s81_annual_work_plan/migration.sql`.
- CRUD `/api/v1/annual-work-plans` (`sgsst-api/src/modules/annual-work-plans/`): controlador con RBAC (lectura ADMIN/SST/AUDITOR/EMPLOYEE; escritura ADMIN/SST), servicio con scope via `resolveCompanyScope` (403 companyId ajeno del cliente, 404 cross-tenant), 409 por anio duplicado, auditoria CREATE/UPDATE/DELETE con snapshots before/after en `AuditLog`.
- Tests: `annual-work-plans.service.spec.ts` (7 casos: scope, 403, 404 cross-tenant, 409, trazas).

## S8.2 - Issue #18 (Actividades: responsable, fecha, evidencia, % avance)

**Estado implementacion:** completa en backend + UI.

- Modelo `AnnualPlanActivity`: ciclo PHVA, frecuencia, `dueDate`, `progress` 0-100, `status`, presupuesto, `owner` (User), `evidence` -> `Document` con `onDelete: SetNull` (integracion con documents).
- Migracion: `prisma/migrations/20260925130000_s82_annual_plan_activity/migration.sql`.
- API anidada `/annual-work-plans/:planId/activities`: aislamiento doble (empresa + plan), evidencia validada contra documents de la misma empresa (404 si ajena), regla de consistencia DONE <=> 100%, listado devuelve `planProgress` (promedio no canceladas), auditoria completa, hard delete (ADR).
- UI: dialogo de Plan Anual (`sgsst-web/src/pages/annual-work-plans/`) con gestion de actividades inline, barra de % de avance y responsables/evidencia filtrados por empresa.

## S8.3 - Issue #19 (Alertas: proximas, vencidas, sin evidencia)

**Estado implementacion:** completa en backend.

- `generateDueAlertsForCompany()` (`sgsst-api/src/modules/notifications/notifications.service.ts`) ampliado con escaneo de `AnnualPlanActivity` (excluye DONE/CANCELLED):
  - Vencidas (`dueDate < now`) -> `TASK` prioridad CRITICAL (canal email/WhatsApp segun config de empresa).
  - Proximas (vencen en 30 dias) -> `TASK` HIGH.
  - Sin evidencia con vencimiento <= 30 dias -> mensaje explicito "aun no tiene evidencia".
- Corre por el worker existente (BullMQ, cron `NOTIFICATIONS_CRON`) y por `POST /api/v1/notifications/generate-due-alerts`.
- Tests: `notifications-due-alerts.spec.ts` (escaneo con OR de 3 condiciones, prioridades, mensajes).

## S8.4 - Issue #20 (Reportes: cumplimiento, avance, pendientes; export PDF/CSV)

**Estado implementacion:** completa en backend + UI (la parte de "integracion con documents" del S8.2 cubre la evidencia).

- Nuevo report kind `annual-plan` (`sgsst-api/src/modules/reports/reports.service.ts`): fila RESUMEN DEL PLAN (empresa, NIT, anio, estado, % avance agregado excluyendo canceladas) + una fila por actividad (ciclo, fecha compromiso, %, estado, responsable, evidencia Adjunta/Pendiente).
- Endpoints heredados sin cambios de controller: `GET /api/v1/reports/annual-plan.csv` y `GET /api/v1/reports/annual-plan.pdf` (con auditoria de export y scheduling por cola).
- UI: botones "Plan PDF" / "Plan CSV" en la pagina de Plan Anual.

## Verificacion global

- `npm test` (sgsst-api): 179/179 pruebas, 29 suites (incluye las 14 nuevas de S8/S9.1).
- `npx tsc --noEmit`: sin errores. `npm run build` (api y web): OK. ESLint: limpio.
- `npx prisma validate`: OK. Migraciones S8.1/S8.2 (y S9.1) listas para `prisma migrate deploy`.

## Pendiente para cierre formal (aceptacion)

1. Ejecutar `npx prisma migrate deploy` contra la BD dev.
2. Smoke test UI: crear plan 2026 -> agregar actividades -> responder avance -> disparar alertas -> descargar CSV/PDF.
3. Marcar checkboxes en los issues #17-#20 y en la matriz #43 con capturas.
