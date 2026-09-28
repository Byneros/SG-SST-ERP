# Evidencia de implementacion S10 (issues #25-#27) y actualizacion de issues S9

> Pegar cada bloque como comentario en el issue correspondiente. La aceptacion
> formal (checkboxes de la matriz #43) queda pendiente de validacion con BD dev
> real y UI, segun el flujo Codigo -> Prueba -> Evidencia -> Checkbox -> Cierre.

## S10.1 - Issue #25 (Profesiograma visible en UI)

**Estado implementacion:** completa en backend y frontend.

- Modelos `MedicalProfile` y `MedicalExamRequirement` (`sgsst-api/prisma/schema.prisma`, migracion `20260925170000_s10_medicine_work_health`): cargo, descripcion, empresa y requisitos de examen con tipo (`INGRESO|PERIODICO|RETIRO|POSTINCAPACIDAD|CAMBIO_CARGO`) y periodicidad en meses. Unico por (empresa, cargo) - 409 en duplicado.
- API `/api/v1/medical/profiles` (GET list, POST create) con scope companyId y RBAC estricto (sin EMPLOYEE; 404 en vez de 403 para no revelar el recurso).
- UI: pestana "Profesiograma" en la vista Medicina laboral (`#/medical`) con la matriz cargo -> requisitos visible.

## S10.2 - Issue #26 (Historia medica ocupacional por trabajador)

**Estado implementacion:** completa en backend y frontend (concepto operativo, sin diagnosticos).

- Modelo `MedicalExam`: trabajador, tipo de examen, fecha programada/realizada, **concepto ocupacional operativo** (`PENDIENTE|APTO|APTO_RESTRICCION|NO_APTO`), proxima fecha, proveedor.
- API `/api/v1/medical/exams` (GET, POST programar, PATCH registrar resultado, DELETE hard + AuditLog).
- `DELETE` de examenes solo para ADMIN (regla de datos sensibles).
- UI: pestana "Examenes ocupacionales" con filtro por trabajador, registro de resultado y proxima fecha.
- El expediente del trabajador queda consultable por el filtro de la pestana; datos sensibles excluidos de EMPLOYEE.

## S10.3 - Issue #27 (Restricciones: vigencia, responsable, seguimiento, levantamiento)

**Estado implementacion:** completa en backend y frontend.

- Modelo `MedicalRestriction`: descripcion, trabajador, vigencia (`startDate`/`endDate`), estado (`ACTIVE|LIFTED`), `liftedBy` y `liftedAt` trazados.
- API `/api/v1/medical/restrictions` (GET, POST, PATCH `/:id/lift` con responsable y fecha - idempotente).
- UI: pestana "Restricciones" con chip Activa/Levantada, autor del levantamiento y boton Levantar (solo gestion).

## RBAC estricto S10 (criterio transversal)

- `assertMedicalRole()`: **EMPLOYEE queda excluido de todo el modulo con 404** (sin revelar existencia). Acceso: SUPER_ADMIN (todas las empresas), ADMIN/SST (gestion), AUDITOR (consulta).
- Cobertura de prueba: `medical.service.spec.ts` - 8 pruebas (RBAC, scope cross-tenant 404, 409 duplicado, levantamiento idempotente con responsable, auditoria).

## Verificacion global

- Tests backend: **206/206** (33 suites, +8 de medicina laboral).
- `prisma validate` OK; migracion `20260925170000_s10_medicine_work_health` lista para `prisma migrate deploy`.
- `tsc --noEmit` limpio (API y Web); ESLint limpio; builds `nest build` y `vite build` OK.

## Pendiente de aceptacion formal (matriz #43)

1. ~~`prisma migrate deploy` en BD dev.~~ VERIFICADO 2026-09-28 (ver `evidencia-smoke-s8-s10.md`).
2. Smoke test API del flujo: VERIFICADO 24/24 (profesiograma, examen con concepto, restriccion y levantamiento; ver `evidencia-smoke-s8-s10.md`). Smoke UI (incluido menu invisible para EMPLOYEE) pendiente de aceptacion humana.
3. Marcar checkboxes y cerrar issues #25-#27.

---

## Actualizacion de issues S9 (#21-#24) - referencias

La evidencia de implementacion completa de S9 esta en `docs/evidencia-implementacion-s9.md`:
- S9.1 Inspecciones planeadas (#21): modelos PlannedInspection/InspectionItem/InspectionFinding, CRUD, checklist, hallazgos -> acciones correctivas.
- S9.2 Inspecciones no planeadas (#22): UnplannedInspection, riesgo GTC-45 opcional, integracion dashboard (KPI por sede) y reporte annual-plan.
- S9.3 Actos/condiciones inseguras (#23): UnsafeReport con reporte anonimo, hallazgos de seguimiento y acciones.
- S9.4 EPP (#24): PpeItem/PpeDelivery con descuento transaccional de stock, reposicion por vida util y expediente por trabajador.

Estado comun: implementacion completa en backend+UI, 206/206 tests, pendiente de
migracion a BD dev y smoke test UI para los checkboxes de la matriz #43.
