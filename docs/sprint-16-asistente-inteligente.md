# Sprint 16 — Asistente inteligente (diseño y fase 1 backend)

Estado: **backend + UI conversacional + ayuda extendida + normativa con fuentes implementadas** (Tareas 16.1 a 16.6 del plan).

## Arquitectura

```text
UI (chat) -> POST /api/v1/ai-assistant/ask
   -> JwtAuthGuard + RolesGuard (SUPER_ADMIN, ADMIN, SST, AUDITOR)
   -> AiAssistantService
        |- ayuda conversacional  -> AiProviderClient (OpenAI-compatible)
        |- "@datos <modulo>"     -> AiAssistantTools (repositorios existentes)
                                    => resolveCompanyScope(user)  [fuente unica del tenant]
                                    => datos ya filtrados por empresa al modelo
   -> AuditService.log(AI_ASSISTANT_DATA_QUERY)
```

Decisiones clave:

1. **El modelo nunca consulta la base de datos.** No hay SQL generado por el LLM. Las consultas de datos pasan por `AiAssistantTools`, que reutilizan los repositorios de los módulos y resuelven el alcance con `resolveCompanyScope()` (`src/common/pipes/company-scope.ts`), la misma fuente de verdad que el resto del ERP. El frontend no puede influir en el `companyId` consultado.
2. **Credenciales solo en backend.** `AI_API_KEY` vive en `env` del API; al navegador nunca llega. El cliente del proveedor (`ai-provider.client.ts`) usa timeout con `AbortController` y responde `503` acotado si el proveedor falla: el ERP sigue operando (criterio 16.3).
3. **Sin datos médicos ni documentos en fase 1.** Las herramientas habilitadas son: `company_summary`, `sites_summary`, `employees_summary`, `risks_summary`, `incidents_summary`, `trainings_summary`. Medicina laboral y documentos quedan excluidos hasta revisar permisos granulares (recomendación del plan y del informe de auditoría).
4. **Trazabilidad.** Cada consulta con datos registra `AuditLog` con acción `AI_ASSISTANT_DATA_QUERY`, entidad `AiAssistant` y `entityId` = herramienta usada.
5. **Anti-alucinación.** El prompt de sistema prohíbe inventar datos y exige citar norma (Decreto 1072/2015, Resolución 0312/2019, GTC 45) diferenciándola de recomendaciones; con `@datos`, el modelo solo puede usar el JSON entregado.

## Contrato de API

```text
GET  /api/v1/ai-assistant/capabilities   -> estado, roles, herramientas y limites
POST /api/v1/ai-assistant/ask            -> { message, conversationId?, history? }
```

- `message` normal: ayuda sobre el uso del ERP.
- `message` con prefijo `@datos`: consulta de datos autorizada. Ejemplos:
  `@datos resumen de riesgos`, `@datos sedes`, `@datos empleados`.
- Roles autorizados en fase 1: `SUPER_ADMIN`, `ADMIN`, `SST`, `AUDITOR`. `EMPLOYEE` queda fuera de las herramientas de datos.

## Variables de entorno (sgsst-api)

```env
AI_ENABLED=false                  # activar solo con proveedor configurado
AI_BASE_URL=                      # p. ej. https://api.openai.com/v1 (compatible OpenAI)
AI_API_KEY=                       # NUNCA en el frontend
AI_MODEL=gpt-4o-mini
AI_TEMPERATURE=0.2
AI_MAX_TOKENS=700
AI_REQUEST_TIMEOUT_MS=20000
AI_HISTORY_MAX_MESSAGES=8
```

En producción, `assertProductionEnv()` exige `AI_API_KEY` y `AI_BASE_URL` si `AI_ENABLED=true`.

## Pruebas (16.6)

- Unitarias: `ai-assistant.service.spec.ts` (enrutamiento `@datos`, auditoría, sanitización del historial, capabilities, fuentes normativas citables), `ai-assistant.tools.spec.ts` (rol EMPLOYEE fuera, scope por empresa con `resolveCompanyScope`, mapeo de cada herramienta), `ai-assistant.knowledge.spec.ts` (cobertura de temas, índice de normas con vigencia y secciones, `findNormSources`, anti-alucinación de módulos no implementados) y `ai-provider.client.spec.ts` (503 sin configuración, forma de la petición, degradación por error HTTP/red/timeout). Total: 42 pruebas.
- E2E de integración con PostgreSQL real: `test/prisma-integration.db-e2e-spec.ts` valida aislamiento multi-tenant del endpoint (auditoría de `@datos`, EMPLOYEE 403, capabilities) junto con el scoping Prisma de companies/sites/employees/risks. Correr con `npm run test:e2e:db` (job `api-integration-db` en CI).

## UI conversacional (16.2)

- Panel de chat en `sgsst-web/src/pages/ai-assistant/AssistantChatPage.tsx`, consumiendo `GET /ai-assistant/capabilities` y `POST /ai-assistant/ask` con el cliente API existente (`src/api/client.ts`), incluido el refresh de token del interceptor.
- Vista `aiAssistant` con hash routing (`#/aiAssistant`), lazy chunk propio y botón "Asistente IA" en el sidebar (visible para los roles autorizados; EMPLOYEE bloqueado en `selectView`).
- El historial lo mantiene la UI y viaja en cada petición (el backend lo sanea); los mensajes de error acotados (p. ej. 503 sin proveedor) no se reenvían en el historial. Banner informativo si el proveedor no está configurado; la UI nunca envía `companyId`.

## Ayuda extendida (16.4)

- Base de conocimiento curada en `ai-assistant.knowledge.ts`: 13 temas (uno por módulo real del ERP) con descripción funcional, vista donde aplica, palabras clave y normas de referencia. Fuente: `docs/modulos-funcionales-sgsst-colombia.md` y los módulos implementados; los módulos NO implementados (p. ej. emergencias, contratistas) se excluyen explícitamente para que el modelo no los ofrezca.
- Recuperación por palabras clave (`findHelpTopics`, tolerante a acentos/mayúsculas, con fallback a contexto general) e inyección en el prompt de sistema de cada consulta conversacional; también un índice cerrado de normas citables (evolucionado en 16.5 a `NORM_SOURCES` con vigencia y secciones) con la instrucción de no citar otras.
- El contexto es de solo lectura y sin datos de tenant (los datos solo viajan por `@datos`). `GET /capabilities` ahora expone `helpTopics` para que la UI los muestre.

## Normativa con fuentes (16.5)

- Índice de fuentes verificadas en `ai-assistant.knowledge.ts` (`NORM_SOURCES`): nombre, alcance, **estado de vigencia** (`vigente`/`derogada`), secciones citables y fecha de última verificación (`lastVerified`, 2026-09-28 contra funcionpublica.gov.co, alcaldiabogota.gov.co y fondoriesgoslaborales.gov.co).
- **Resolución 2346 de 2007 derogada** por la Resolución 1843 de 2025 (evaluaciones médicas ocupacionales, vigente desde mayo 2025): la medicina laboral del asistente cita la 1843 y la 2346 queda marcada como derogada para que el modelo no la use como vigente.
- Secciones verificadas citables: Decreto 1072 arts. 2.2.4.6.4, 2.2.4.6.8, 2.2.4.6.12, 2.2.4.6.13 y 2.2.4.6.15; Res. 0312 art. 4 y anexo (capítulos de estándares); Ley 1562 arts. 3, 4 y 10; Res. 1401 arts. 4 y 6; Res. 1843 arts. 4, 8–14 y 19; GTC 45 (metodología). El prompt solo permite citar lo listado.
- Recuperación de fuentes (`findNormSources`) por palabras clave con tolerancia a acentos; el servicio adjunta `sources` (solo normas vigentes) a las respuestas conversacionales normativas y la UI las muestra como chips; `@datos` nunca devuelve `sources`.
- Contexto del prompt: `buildHelpContext` ahora lista cada norma con sus secciones verificadas y marca las derogadas (`[DEROGADA por ...; no la cites como vigente]`).
- El seed de `legal-compliance` no referenciaba la 2346 (su matriz base usa Decreto 1072 y Res. 0312), por lo que no requirió cambios.

## Siguientes pasos

- Operar el asistente con un proveedor real y afinar prompts con casos de uso de campo.
