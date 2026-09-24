# ADR: estrategia de borrado por dominio (hard vs soft delete)

- **Estado:** Aceptado (2026-09-24)
- **Fecha:** 2026-09-24
- **Motivacion:** Issue #3; antecedente resuelto en Issue #2 (hard delete en evaluaciones e indicadores, commit `3c730b6`).

## Contexto

El modelo convive con dos semanticas de borrado sin criterio documentado:

| Dominio | Implementacion actual | Evidencia |
|---|---|---|
| `SgsstEvaluation`, `Indicator` | **Hard delete** con cascada (desde `3c730b6`) | `delete()` en sus servicios; cascada `onDelete: Cascade` en items/metas/mediciones |
| `Employee`, `Site`, `Document`, `User` | Soft delete (`isActive: false` + `deletedAt`) | `removeScoped` en sus repositorios |
| `Audit`, `AuditProgram` | Soft delete | `repository.remove` con `update` |
| `Company` | Desactivacion con traza de auditoria | `remove` → `AuditLog` accion `DEACTIVATE` |

El bug que motivo el cambio en evaluaciones/indicadores (borrados visibles en listados, `@@unique([companyId, code])` bloqueado por filas legacy) expone riesgos del patron mixto cuando no se acompana de filtros garantizados. El mismo riesgo de unique existe hoy en `Site` (`@@unique([companyId, code])`, linea 101 del schema): un site borrado logicamente impide reutilizar su `code`.

## Decision

Regla general: **el borrado es hard delete con traza de auditoria en `AuditLog`, salvo que el dominio requiera conservar el registro o suspenda cuentas.**

### 1. Hard delete + traza en `AuditLog` (cumplimiento normativo y metricos)

`SgsstEvaluation`, `Indicator`, `Audit`, `AuditProgram`, `Document`.

- Rationale: la trazabilidad que exige la norma es de la **eliminacion** (quien, cuando, que), no del cadaver en la tabla. La traza queda en `AuditLog` (con snapshot `before`), que es el mecanismo de auditoria transversal.
- `Indicator` y `SgsstEvaluation`: ya operan asi.
- `Audit`/`AuditProgram`: migrar de soft a hard + traza (cascada actual: findings y acciones; verificar que `AuditFinding`/acciones tengan `onDelete: Cascade` o eliminarlas en la misma transaccion).
- `Document`: ademas del row, eliminar el archivo en el storage (driver local o S3) en la misma operacion; es el unico dominio con artefacto fisico asociado.

### 2. Soft delete con filtros garantizados (operativos con historial)

`Employee`, `Site`.

- Rationale: historial laboral y operativo que otras entidades referencian; el "borrado" es una baja logica.
- Obligaciones transversales (mismas que recibio `3c730b6`):
  - Listados: `deletedAt: null` por defecto, con escape explicito para auditoria.
  - `findOne`: 404 para borrados.
  - Uniques: `Site` necesita resolver la reutilizacion de `code` (unique parcial en SQL via migracion, o validar en servicio contra filas activas). Es el unico `@@unique` del modelo afectado por soft-deletes activos.

### 3. Suspend (nunca fisico)

`User`, `Company`.

- Rationale: integridad referencial y de auditoria (`AuditLog.actorId` apunta a `User`), y el ciclo de vida de un cliente SaaS es la suspension, no el borrado.
- `Company` ya opera asi (DEACTIVATE con traza); formalizar `User` con el mismo action.

## Reglas transversales (aplican a todo dominio)

1. Todo DELETE de entidad de negocio registra traza en `AuditLog` (accion `DELETE`, entity, entityId, `before`).
2. Todo listado excluye registros de baja logica por defecto; el escape explicito queda documentado en el DTO (`isActive=false`).
3. Ningun `@@unique` puede quedar bloqueado por filas de baja logica.
4. Los contadores del dashboard cuentan solo registros activos.

## Consecuencias y fases

- **Fase 1 (sin migracion):** trazas `AuditLog` en evaluaciones/indicadores (hoy sin auditoria); migrar `Audit`/`AuditProgram` a hard+traza; documentar escape explicito en DTOs.
- **Fase 2 (con migracion):** unique parcial para `Site.code` (o refactor de unicidad a nivel de servicio); retirar columnas vestigiales `isActive`/`deletedAt` de `SgsstEvaluation` e `Indicator` (decision diferida en #2) una vez el patron quede formalizado.
- Las columnas de baja logica se conservan solo en los dominios soft/suspend; no se introducen en dominios hard.

## Referencias

- Issue #3 (este ADR), Issue #2 (hard delete + purga legacy, cerrado).
- Commits: `3c730b6` (hard delete evaluaciones/indicadores + unitarios), `7b1866d` (script de purga con dry-run).
- `docs/convivencia-dev-prod-local.md` (operacion), `sgsst-api/scripts/purge-soft-deletes.ts` (purga legacy reutilizable).
