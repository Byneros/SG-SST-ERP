# Evidencia implementación — S17: matriz GTC-45 estructurada (#57) y capacitaciones completas (#58)

Fecha: 2026-10-16 · Rama `main` · Commits:
- `dbed6a8` feat(risks): add GTC-45 risk matrix (sesión anterior).
- `354c4eb` fix(risk-matrix): migración correctiva del índice único `RiskValoracion.hazardId` y smoke #57.
- `dfd8695` feat(trainings): asistentes, evaluación, evidencia por trabajador y vencimiento (#58).

Cierra las dos features abiertas del handoff
(`docs/sesion-velocidad-2026-10-15.md` §4 pasos 1 y 2).

## 1. #57 — Matriz GTC-45 estructurada

Alcance (commit `dbed6a8`): jerarquía `RiskProcess → RiskActivity → RiskHazard`
con valoración 1:1 (`RiskValoracion`, score = probabilidad × severidad, nivel
I–IV derivado en el servicio), controles por fuente (numeral 5 GTC-45),
`Risk.hazardId` como resultado final (`Levels` mapeados: I→LOW, II→MEDIUM,
III→HIGH, IV→CRITICAL) y reporte `risks-matrix` CSV/PDF (cierre del criterio
suelto de #11 re-scoped en #57).

### Hallazgo y corrección (commit `354c4eb`)

El smoke end-to-end reveló un **500 en `PUT /risk-matrix/hazards/:id/valoracion`**:
`there is no unique or exclusion constraint matching the ON CONFLICT
specification`. Causa raíz: la migración `20261015160000` creó
`RiskValoracion_hazardId_idx` (índice simple) mientras el schema declara
`hazardId @unique`; el `upsert({ where: { hazardId } })` de Prisma exige el
índice único. No lo detectó la unitaria (Prisma mockeado) porque es un defecto
de DDL, no de código.

Corrección: migración nueva `20261016120000_risk_valoracion_hazard_unique`
(drop del índice simple + `CREATE UNIQUE INDEX ... _hazardId_key`), aplicada en
dev con `prisma migrate deploy`. Convención del repo respetada: no se retocó
la migración ya aplicada; el fix vive en una migración propia.

### Smoke `scripts/smoke-s57-risk-matrix.mjs` — 16/16 TODO PASS

```text
PASS GET /risk-matrix (arbol) | status 200
PASS POST processes crea proceso | status 201
PASS POST activities crea actividad | status 201
PASS POST hazards crea peligro FISICO | status 201
PASS PUT valoracion deriva nivel IV | status 200 nivel IV       (4×5=20)
PASS PUT valoracion re-upsert deriva nivel I | nivel I          (2×2=4)
PASS POST risk vinculado sigue valoracion (LOW/I) | status 201
PASS POST controls crea control EPP | status 201
PASS PATCH controls actualiza efectividad | status 200
PASS GET /risk-matrix refleja cadena completa | arbol ok
PASS POST risk duplicado rechazado (400/409) | status 400
PASS Aislamiento: empresa B no ve el proceso de A
PASS Aislamiento: empresa B no puede editar proceso de A (404)
PASS CSV risks-matrix entrega archivo
PASS PDF risks-matrix entrega PDF valido (%PDF)
PASS Limpieza: proceso eliminado del arbol
```

Validación GTC-45: umbral clásico (I ≤ 4 · II ≤ 9 · III ≤ 19 · IV ≥ 20) y
seguimiento 1:1 entre valoración vigente y nivel del riesgo vinculado
(al re-valorar, el riesgo ligado actualiza su nivel).

## 2. #58 — Capacitaciones: asistentes, evaluación, evidencia y vencimiento

Alcance (commit `dfd8695`):

- **Modelo `TrainingAttendee`** (migración `20261016130000_training_attendees`):
  evaluación (`score` 0–100, status `ATTENDED`/`PASSED`/`FAILED`), evidencia
  documental por trabajador (`evidenceId` → Document, `ON DELETE SET NULL`),
  `employeeId` opcional (asistentes externos solo con nombre; borrado del
  trabajador conserva la asistencia con nombre congelado) y `expiresAt`
  derivado al aprobar (fecha capacitación + `validityMonths`, meses de 30 días).
- **Training**: gana `instructor` y `validityMonths`; alta con asistentes
  inline (resuelve valores por defecto).
- **Endpoints**: `POST /trainings/:id/attendees`,
  `PATCH/DELETE /trainings/attendees/:id`,
  `GET /trainings/expirations?days=N` (dashboard con resumen
  vencidos/próximos-ventana + detalle). Nota de ruteo:
  `@Get('expirations')` se declara antes de `@Get(':id')` para que Nest no lo
  capture como UUID.
- **Guardas de negocio** (service): máximo 200 asistentes por capacitación,
  requerido employeeId o name, employee/Documento en scope de empresa
  (404 si es de otra empresa), sin regla de doble PASSED (re-evaluación
  actualiza score y expiry vía PATCH).

### Smoke `scripts/smoke-s58-trainings.mjs` — 15/15 TODO PASS

```text
PASS POST /trainings con asistentes inline | status 201
PASS Asistente interno congeló nombre del trabajador | QA Operario A
PASS Asistente externo por nombre | FAILED
PASS Vencimiento derivado de validityMonths | 2026-03-16T10:00:00.000Z
PASS PATCH attendee añade score/evidencia | status 200
PASS POST attendees por endpoint | status 201
PASS POST attendees sin employee/name rechazado | status 400
PASS POST attendees con employee inexistente rechazado (400/404) | status 404
PASS PATCH status PASSED deriva vencimiento | 2026-03-16T10:00:00.000Z
PASS GET /trainings/expirations lista certificados por vencer/vencidos | status 200
PASS Los asistentes de la smoke de capacitación aparecen en el dashboard | 2 items
PASS Aislamiento: empresa B no ve la capacitación de A | capacitaciones B: 3
PASS Aislamiento: empresa B no puede editar capacitación de A (404) | status 404
PASS Aislamiento: expirations de B no lista capacitaciones de A | status 200
PASS Limpieza: capacitación eliminada del listado | status 200
```

## 3. Suite al momento del cierre de los smokes

- Unitarias backend: **533/533** (`npm run test`) — incluye los 14 del spec
  nuevo de risk-matrix (`dbed6a8`).
- e2e (memoria): **67/67** (`npm run test:e2e`).
- e2e-db (Postgres efímero): **41/41** (`npm run test:e2e:db`) — valida las
  dos migraciones nuevas desde cero.
- Builds: `sgsst-api` (`nest build`) OK · smoke `scripts/smoke-s8-10.mjs`
  verde tras la copia de `dist` al contenedor.
