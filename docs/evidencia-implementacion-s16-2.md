# Evidencia S16.2 — Fases E/F/G: asistentes especializados de riesgos, incidentes y hallazgos

Fecha: **2026-10-08** · Continuacion de `docs/sprint-16-asistente-inteligente.md`
(fase 1) y del plan `docs/plan-s16-framework-asistentes.md` (Fase C, commit
`e47b759`). Esta sesion implementa las filas E, F y G del mapa de asistentes
(§5 del plan).

## 1. Lo implementado

### Fase E — Asistente de Riesgos (`risks`)

- `sgsst-api/src/modules/ai-assistant/assistants/risks.assistant.ts` (nuevo):
  definicion declarativa con 3 herramientas READ —
  `matrix_summary` (distribucion por nivel y sede), `critical_without_actions`
  (altos/criticos con hallazgos de inspeccion sin accion correctiva) y
  `oldest_open` (mas antiguos con tope `take<=20`).
- `sgsst-api/src/modules/risks/risks.repository.ts`: metodos READ nuevos
  `findWithoutCorrectiveAction()` y `findOldest()` (scoping por `companyId`,
  sin SQL dinamico).

### Fase F — Asistente de Incidentes (`incidents`)

- `sgsst-api/src/modules/ai-assistant/assistants/incidents.assistant.ts`
  (nuevo): 2 herramientas READ — `stats_summary` (por estado, Res. 1401/2007)
  y `recurrent_causes` (actos/condiciones inseguras por kind y severidad).
- `sgsst-api/src/modules/incidents/incidents.repository.ts`: metodo READ nuevo
  `findAllForAssistant()` (solo campos agregables, scoped).
- Fuente adicional: `UnsafeReportsRepository.findAll(companyId)` ya existente.

### Fase G — Asistente de Hallazgos (`findings`)

- `sgsst-api/src/modules/ai-assistant/assistants/findings.assistant.ts`
  (nuevo): 3 herramientas READ — `open_summary` (por severidad/tipo/origen,
  con y sin plan de accion, acciones vencidas derivadas), `overdue_actions`
  (planes vencidos sin cerrar, tope `take<=20`) y `repeat_offenders`
  (owners con mas hallazgos, `minCount` acotado a 50).
- `sgsst-api/src/modules/findings/findings.repository.ts`: metodos READ nuevos
  `findOpenForAssistant()` y `findRepeatOwners()` (groupBy con `having`).
- `sgsst-api/src/modules/actions/action-plans.repository.ts`: metodos READ
  nuevos `findOverdueForAssistant()` y `countForFindingsAsistente()`.
  Nota de diseño: `Finding` no tiene relacion directa con `ActionPlan`; el
  vinculo es trazable por origen (`sourceType='FINDING'`, `sourceId`), por lo
  que el conteo de acciones por hallazgo se deriva de esa tabla de origen.

### Integracion (sin tocar el router ni el controller)

- `assistant-registry.ts`: los 3 asistentes se registran condicionalmente si
  se inyectan sus repositorios (el central sigue solo con `AiAssistantTools`,
  retrocompatible con los tests que lo construyen a mano).
- `ai-assistant.module.ts`: se proveen `FindingsRepository` y
  `ActionPlansRepository` (patron existente: repositorios, no servicios).

## 2. Seguridad (invariante del §6 del plan, verificado por test)

Para cada asistente: `EMPLOYEE` fuera; whitelist cerrada (las herramientas de
un asistente no son invocables desde otro, y viceversa); params validados
contra `paramsSchema` antes de ejecutar (400/TypeError sin llegar al
repositorio); toda herramienta recibe el `companyId` del `ToolContext`
resuelto con `resolveCompanyScope()` en backend — ninguna herramienta lo
acepta del cliente.

## 3. Verificacion

- Unitarias del modulo: `npx jest src/modules/ai-assistant` →
  **9 suites, 84 tests OK** (incluye los 3 specs nuevos:
  `risks.assistant.spec.ts` 10 tests, `incidents.assistant.spec.ts` 7 tests,
  `findings.assistant.spec.ts` 8 tests).
- Suite completa del API: `npm test` → **55 suites, 452 tests OK**
  (los 42 tests de la fase 1 no cambiaron de resultado: criterio de no
  regresion del plan §11).
- Build: `npm run build` OK.

## 4. Pendiente (siguientes fases del plan)

- Fases H1–H3 (trainings/medical/ppe), I1–I3 (contractors/commitments/
  emergency), J1–J3 (audits/indicators/documents).
- Fase K completa: router por keywords (el orquestador actual ejecuta 1
  asistente por consulta) y sintesis multi-asistente con tope de 4.
- Fase L: frontend (`assistantId` en `AssistantChatPage`, entry points
  contextuales por modulo).
- e2e-db: casos multi-tenant del asistente (§11 del plan).
