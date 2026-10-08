# Evidencia S16.3 — Fases H1/H2/H3 + K: capacitaciones, medicina laboral, EPP y orquestador multi-asistente

Fecha: **2026-10-08** · Continuacion de `docs/evidencia-implementacion-s16-2.md`
(fases E/F/G) y del plan `docs/plan-s16-framework-asistentes.md`. Esta sesion
implementa las filas H1, H2 y H3 del mapa de asistentes (§5 del plan) y la
**Fase K completa** (orquestador multi-asistente).

## 1. Lo implementado

### Fase H1 — Asistente de Capacitaciones (`trainings`)

- `sgsst-api/src/modules/ai-assistant/assistants/trainings.assistant.ts`
  (nuevo): 1 herramienta READ — `compliance_summary` (total, distribucion por
  anio y por sede, 10 mas recientes titulo/fecha).
- `sgsst-api/src/modules/trainings/trainings.repository.ts`: metodo READ nuevo
  `findAllForAssistant()` (solo campos agregables: titulo, descripcion, fecha,
  sede; scoped por `companyId`, orden por fecha desc).

### Fase H2 — Asistente de Medicina Laboral (`medical`)

- `sgsst-api/src/modules/medical/medical.repository.ts` (nuevo):
  repositorio de solo lectura `MedicalAssistantRepository` con
  `examSummary()` (examenes por concepto y tipo, proximos a vencer en 30 dias;
  SIN diagnostico ni historia clinica) y `pveSummary()` (casos por estado y
  programa, dias de ausentismo acumulados).
- `sgsst-api/src/modules/ai-assistant/assistants/medical.assistant.ts`
  (nuevo): 2 herramientas READ — `exam_summary` y `pve_summary`. Mismo
  criterio de datos sensibles de la fase 1: solo agregaciones; el addendum del
  prompt prohíbe consejos medicos e interpretacion de examenes.

### Fase H3 — Asistente de EPP (`ppe`)

- `sgsst-api/src/modules/ppe/ppe.repository.ts`: metodos READ nuevos
  `findStockSummary()` (catalogo activo con stock/stockMin) y
  `findExpiringDeliveries()` (reposicion vencida o en 30 dias, orden por
  urgencia, `take` acotado).
- `sgsst-api/src/modules/ai-assistant/assistants/ppe.assistant.ts` (nuevo):
  2 herramientas READ — `stock_summary` (items bajo minimo con top-15) y
  `expiring_deliveries` (vencidas/proximas, `paramsSchema: { take: 'number' }`
  con tope 20).

### Fase K — Orquestador multi-asistente (`ai-assistant.orchestrator.ts`, nuevo)

- Router **determinista sin LLM**: `routeAssistants()` puntua asistentes por
  keywords del mensaje (frase completa pesa 3, palabra 1), filtra por
  `allowedRoles` del usuario y aplica tope `MAX_ASSISTANTS = 4`. Si el usuario
  no tiene permiso para un asistente con score, se OMITE y la respuesta lo
  declara (`omittedAssistants`) sin revelar que el modulo existe en otra
  empresa (sin fuga de datos segun §4 del plan).
- `selectTools()`: elige hasta 2 herramientas READ por asistente usando las
  keywords del mensaje contra nombre/descripcion de la herramienta; sin
  coincidencias cae a la primera herramienta (resumen del modulo).
- Sintesis final: un solo prompt con los JSON etiquetados por modulo
  (`DATOS <MODULO> (<id>):`), regla de citar modulo de origen y prohibicion de
  inventar cifras.
- Integracion en `ai-assistant.service.ts`: `ask()` consulta el router DESPUES
  del prefijo `@datos` (que queda intacto) y ANTES del flujo conversacional;
  el evento de auditoria nuevo `AI_ASSISTANT_ORCHESTRATED` registra
  `asistente:herramienta` por cada asistente usado (§8 del plan). El asistente
  central y las 42 tests de la fase 1 conservan su comportamiento.
- `AiAssistantOrchestrator` lanza `ForbiddenException` si ninguna herramienta
  produjo datos (caso anomalo) y devuelve `NO_MATCH` para que el service texto
  de ayuda si el router no encontro dominio.

### Registro y modulos (sin tocar el router ni el controller)

- `assistant-registry.ts`: los asistentes H1/H2/H3 se registran
  condicionalmente si se inyectan sus repositorios (retrocompatible con los
  specs que construyen el registro a mano con solo las tools legacy).
- `ai-assistant.module.ts`: se proveen `TrainingsRepository`,
  `MedicalAssistantRepository` y `PpeRepository`.
- `ai-assistant.types.ts`: `AssistantResult` gana `usedTools?` y
  `omittedAssistants?` opcionales.

## 2. Seguridad (invariante del §6 del plan, verificado por tests)

- `EMPLOYEE` sigue fuera de todos los asistentes nuevos y del orquestador
  (si el router solo encuentra asistentes no permitidos, los omite todos y la
  respuesta decae a conversacional sin revelar modulos).
- Whitelist cerrada: herramientas de un asistente no invocables desde otro;
  el orquestador solo elige herramientas de la lista del asistente elegido.
- El `companyId` sigue resuelto en backend por `resolveCompanyScope()` dentro
  de `ToolContext`; ninguna herramienta del orquestador lo acepta del cliente.
- Toda ejecucion del router con herramientas queda auditada:
  `AI_ASSISTANT_DATA_QUERY` por herramienta (runTool) +
  `AI_ASSISTANT_ORCHESTRATED` por consulta orquestada.

## 3. Verificacion

- Specs nuevos: `trainings.assistant.spec.ts` y `medical.assistant.spec.ts` y
  `ppe.assistant.spec.ts` (mapeo, scoping por empresa, EMPLOYEE 403) +
  `ai-assistant.orchestrator.spec.ts` (router keywords/score/roles, tope de
  asistentes, selectTools, omitidos sin fuga).
- Suite completa del API: `npm test` → **59 suites, 478 tests OK** (los tests
  de fases 1 y E/F/G no cambiaron de resultado: criterio de no regresion del
  plan §11).
- Lint: `npm run lint` → **0 errores** (55 warnings pre-existentes de
  `no-unsafe-*` en specs de ai-assistant del commit anterior, sin cambios).
- Build: `npm run build` OK.

## 4. Pendiente (siguientes fases del plan)

- Fases I1–I3 (contractors/committees/emergency), J1–J3
  (audits/indicators/documents).
- Fase L: frontend (`assistantId` en `AssistantChatPage`, entry points
  contextuales por modulo con `?assistant=`).
- e2e-db: casos multi-tenant del asistente (§11 del plan): usuario de Empresa
  A no puede invocar asistente con datos de Empresa B; EMPLOYEE 403 por
  asistente; herramienta fuera de whitelist => 403.
- Smoke HTTP de `capabilities` por rol con los 7 asistentes del registro.
