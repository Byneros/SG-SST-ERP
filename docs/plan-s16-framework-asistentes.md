# Fase B — Diseño del framework de asistentes especializados (S16 extendido)

> Continuacion de `docs/sprint-16-asistente-inteligente.md` (fase 1 implementada
> y verificada: 42 tests + e2e-db). Este documento define la arquitectura de la
> capa de inteligencia operacional SIN modificar codigo aun. Diagnostico previo
> entregado en conversacion (Fase A, 2026-10-06).

## 1. Principios no negociables (heredados de la fase 1)

1. La IA nunca consulta PostgreSQL directamente ni genera SQL. Todo dato pasa
   por herramientas registradas que llaman repositorios del modulo.
2. El `companyId` SIEMPRE se resuelve en backend con `resolveCompanyScope()`
   (`src/common/pipes/company-scope.ts`). El cliente no puede influirlo.
3. RBAC declarativo por asistente y por herramienta. EMPLOYEE sigue fuera de
   las herramientas de datos en fase 2 (evaluacion granular posterior).
4. Toda consulta de datos y toda propuesta/ejecucion quedan en `AuditLog`
   via el `AuditService` existente (sin auditoria paralela).
5. READ + ANALYSIS + RECOMMENDATION primero. Escritura solo con el flujo de
   confirmacion explicita del §7.
6. Degradacion: si el proveedor falla, 503 acotado; el ERP sigue funcionando.

## 2. Contrato de asistente (nuevo: `ai-assistant.framework.ts`)

```ts
export type AssistantToolAccess = 'ALLOWED' | 'DENIED';

export interface AssistantToolDefinition {
  /** Nombre unico dentro del asistente. Ej: 'critical_risks_without_actions'. */
  name: string;
  description: string;
  /** Solo lectura en fase 2. La escritura usa el flujo del §7. */
  kind: 'READ';
  /** Roles con acceso; vacio = hereda los del asistente. */
  allowedRoles?: AssistantRole[];
  /** Ejecucion: recibe user autenticado y params validados. */
  run: (ctx: ToolContext, params: Record<string, unknown>) => Promise<Record<string, unknown>>;
  /** Schema de params (validacion class-validator o zod-like manual). */
  paramsSchema?: Record<string, 'string' | 'number' | 'boolean'>;
}

export interface ToolContext {
  /** companyId YA resuelto en backend; las herramientas no lo aceptan del cliente. */
  companyId: string;
  user: AuthenticatedUser;
  auditService: AuditService;
}

export interface AssistantDefinition {
  /** Identificador estable. Ej: 'risks'. Usado por el router y la auditoria. */
  id: string;
  name: string;              // "Asistente de Riesgos"
  module: string;            // vista del ERP: 'risks'
  description: string;       // texto del entry point contextual
  /** Prompt especializado que SE AÑADE al system prompt base. */
  systemPromptAddendum: string;
  /** Whitelist explicita: el asistente no puede invocar otra herramienta. */
  tools: AssistantToolDefinition[];
  /** Roles minimos para invocar el asistente (ademas de ASSISTANT_ALLOWED_ROLES). */
  allowedRoles: AssistantRole[];
  /** Keywords para el router (fase C) y matchTool retrocompatible. */
  keywords: string[];
  /** Consultas a otros asistentes permitidas; vacio en asistentes hoja. */
  delegateTo?: string[];
}
```

Reglas del contrato:

- `tools` es una whitelist cerrada: el orquestador rechaza (`ForbiddenException`)
  cualquier herramienta fuera de la lista del asistente activo.
- `AssistantDefinition` es dato, no clase: registrar un asistente nuevo = añadir
  un archivo de definicion y una linea en el registro (§3). No se toca el router.
- El `companyId` NO es parametro de herramienta: vive en `ToolContext` y solo el
  backend lo construye.

## 3. Registro de asistentes (nuevo: `assistant-registry.ts`)

```ts
// Registro declarativo, orden = orden de evaluacion del router.
export const ASSISTANT_REGISTRY: AssistantDefinition[] = [
  centralAssistant,   // id 'central': punto de entrada, delega a todos
  risksAssistant,     // Fase E
  incidentsAssistant, // Fase F
  findingsAssistant,  // Fase G
  // ... uno por modulo, agregados por fase sin tocar el router
];

export function getAssistant(id: string): AssistantDefinition | null;
export function assistantsForRole(role: AssistantRole): AssistantDefinition[];
```

## 4. Asistente central + orquestador (Fase K, diseño)

```text
POST /ai-assistant/ask { message, assistantId? }
   1. Si no hay assistantId => asistente 'central'.
   2. Central clasifica la intencion:
      a. ayuda conversacional  -> proveedor con knowledge.ts (como hoy)
      b. @datos <tool>         -> compatibilidad 1:1 con fase 1 (no se rompe)
      c. dominio detectado     -> ROUTER elige 1..N asistentes por keywords +
                                  score, validando allowedRoles del usuario
   3. Ejecuta las herramientas READ de cada asistente elegido (max 4
      asistentes por consulta, presupuesto de tokens: 700 * 2).
   4. Sintesis final: un solo prompt con los JSON etiquetados por modulo
      ("DATOS RIESGOS:", "DATOS INCIDENTES:") y regla de citar origen.
   5. Respuesta: { content, usedTools: [{assistant, tool}], sources? }
```

- Si el usuario no tiene permiso para un asistente requerido, el orquestador
  lo omite y la respuesta lo declara ("no tienes acceso al modulo X"), nunca
  filtra que la informacion existe en otra empresa.
- El router NO usa el LLM para elegir herramientas (determinista, auditable);
  el LLM solo redacta la sintesis.

## 5. Mapa de asistentes vs modulos reales del repo

Prioridad segun modulos ya implementados (verificado en `src/modules/`):

| Fase | Asistente (id) | Modulo fuente | Herramientas READ iniciales |
|------|----------------|---------------|------------------------------|
| E | `risks` | risks | `matrix_summary`, `critical_without_actions`, `oldest_open` |
| F | `incidents` | incidents + unsafe-reports | `stats_summary`, `recurrent_causes` |
| G | `findings` | findings + actions | `open_summary`, `overdue_actions`, `repeat_offenders` |
| H1 | `trainings` | trainings | `compliance_summary` (amplia el actual) |
| H2 | `pve` | medical | `population_summary` (solo ADMIN/SST/AUDITOR; sin datos clinicos) |
| H3 | `ppe` | ppe | `stock_summary`, `expiring_deliveries` |
| I1 | `contractors` | contractors | `docs_expiring`, `entry_flow_status` |
| I2 | `committees` | committees | `meetings_summary`, `overdue_commitments` |
| I3 | `emergency` | emergency | `brigades_summary`, `drills_findings` |
| J1 | `audit` | sgsst-audits | `audits_summary` |
| J2 | `indicators` | indicators + annual-work-plans | `plan_progress`, `indicator_snapshot` |
| J3 | `documents` | documents | `search_authorized` (solo metadata, no contenido binario) |

Exclusiones: `change-requests` y `tasks` quedan para fase posterior (el
asistente de riesgos cubre sus consultas mas frecuentes via acciones);
`medical` restringido por el mismo criterio de la fase 1 (datos sensibles).

## 6. Seguridad por capas (orden de evaluacion)

```text
JWT -> RolesGuard(controller, ASSISTANT_ALLOWED_ROLES)
     -> allowedRoles del asistente (registry lookup)
     -> allowedRoles de la herramienta (fallback al asistente)
     -> resolveCompanyScope() dentro de ToolContext
     -> repositorio del modulo (scoping por companyId en cada query)
     -> AuditService.log(assistant, tool, params-resumen)
```

Puntos fijos:

- Ninguna herramienta recibe `companyId` del cliente: se construye en
  `ToolContext` y las firmas del §2 lo impiden por tipos.
- Sin SQL dinámico: los repositorios ya parametrizan; las herramientas no
  exponen `prisma` en su interfaz.
- Params de herramienta validados contra `paramsSchema` antes de ejecutar;
  rechazo 400 sin llegar al repositorio.
- Rate-limit: reutilizar `RateLimitMiddleware` global + limite especifico del
  endpoint `ask` (propuesta: 30 req/min por usuario; constante de env).

## 7. Escritura con confirmacion (esqueleto, implementacion en fase posterior)

```text
1. Herramienta ANALYZE detecta necesidad de accion -> devuelve `proposal`:
   { kind: 'CREATE_ACTION_PLAN', payload: {...}, rationale }
2. La respuesta marca `requiresConfirmation: true` y la UI pide confirmacion.
3. POST /ai-assistant/confirm { conversationId, proposalId }  (nuevo endpoint)
4. Backend: re-valida roles + companyId + payload con los DTO del modulo
   (NUNCA confia en el payload del cliente para permisos).
5. Ejecuta el SERVICE normal del modulo (no Prisma directo).
6. Audita AI_PROPOSAL_ACCEPTED + la accion del modulo ya queda auditada
   por el propio servicio.
```

- `proposalId`: JWT corto de 5 min firmado con el secreto existente, contiene
  assistantId + tool + payload; si expira, se pide de nuevo. Sin estado en BD
  en fase 2 (estado en BD solo si el flujo lo exige).

## 8. Auditoria IA (eventos)

Reutilizar `AuditService.log` con entidad `AiAssistant`:

| Accion | Cuando | entityId |
|---|---|---|
| `AI_ASSISTANT_DATA_QUERY` (existente) | herramienta ejecutada | tool name |
| `AI_ASSISTANT_ORCHESTRATED` (nuevo) | router elige N>1 asistentes | asistentes usados (csv) |
| `AI_ASSISTANT_QUESTION` (nuevo, opcional) | pregunta sin datos, para telemetria | 'conversational' |
| `AI_PROPOSAL_CREATED` / `AI_PROPOSAL_ACCEPTED` (futuro) | flujo §7 | proposal kind |

El `before/after` de escrituras lo aporta el servicio del modulo (ya auditado).

## 9. Frontend (Fase L, diseño)

1. `AssistantChatPage` gana prop `assistantId?` y query param `?assistant=`;
   muestra nombre/descripcion del asistente activo y su entry point textual.
2. Entry points contextuales: componente `ModuleAssistantButton` reutilizable
   con icono + frase corta, colocado en el header de cada modulo con
   `assistantId` y sugerencias especificas.
3. `capabilities` ampliado: `assistants: [{id, name, description, module}]`
   filtrado por rol; la UI solo muestra los permitidos.
4. Confirmaciones de escritura (cuando existan): dialogo con diff del payload
   y doble confirmacion.

## 10. Plan de migracion de codigo (Fase C, estimacion de archivos)

Nuevos en `sgsst-api/src/modules/ai-assistant/`:

- `ai-assistant.framework.ts` (contratos del §2)
- `assistant-registry.ts` (§3)
- `assistants/central.assistant.ts` (extrae matchTool + toolsList actuales)
- `assistants/risks.assistant.ts` (Fase E)
- `ai-assistant.orchestrator.ts` (Fase K; en C se deja stub con 1 asistente)

Modificados (mínimos, aditivos):

- `ai-assistant.service.ts`: delega en registry/orquestador; conserva rutas
  `@datos` y conversacional identicas (los 42 tests no cambian de resultado).
- `ai-assistant.tools.ts`: las 6 herramientas actuales se reexpresan como
  definiciones del §2 (misma logica, misma firma de `run`), manteniendo el
  export `AssistantToolName` por compatibilidad.
- `ai-assistant.controller.ts`: `ask` acepta `assistantId?` opcional.
- `dto/assistant-query.dto.ts`: campo opcional `assistantId`.

No se tocan: knowledge.ts, provider.client.ts, AppLayout (hasta Fase L),
ningun modulo de dominio, ningun test existente.

## 11. Estrategia de pruebas por fase

- Unitarias nuevas: registry (whitelist/roles), orchestrator (delegacion y
  tope de asistentes), cada asistente especializado (mapeo + scoping).
- Los 42 tests actuales deben seguir pasando SIN cambios (criterio de no
  regresion de la Fase A/G).
- e2e-db: ampliar `prisma-integration.db-e2e-spec.ts` con: usuario Empresa A
  no puede invocar asistente con datos de Empresa B; EMPLOYEE 403 por
  asistente; herramienta fuera de whitelist => 403.
- HTTP: smoke de `capabilities` con asistentes por rol.
