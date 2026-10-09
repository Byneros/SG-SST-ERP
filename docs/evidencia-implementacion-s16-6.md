# Evidencia S16.6 — Fase L: frontend (entry points contextuales del asistente)

Fecha: **2026-10-09** · Continuacion del commit `51d25c8` (S16.5, fases
J1/J2/J3) y del plan `docs/plan-s16-framework-asistentes.md` (section 9,
"Frontend (Fase L, diseno)"). Implementa la Fase L minima viable: el chat
consume los asistentes del registro via `capabilities.assistants` y los
modulos exponen entry points contextuales con `?assistant=`.

## 1. Lo implementado

### AssistantChatPage (`sgsst-web/src/pages/ai-assistant/AssistantChatPage.tsx`)

- Props nuevas: `assistantId?` (asistente especializado activo) y
  `onClearAssistant?` (vuelve al asistente central).
- `capabilities` ampliado en el tipo: `assistants?: Array<{id, name, module,
  description}>` (ya existia en el backend desde la Fase C; la UI ahora lo
  consume). La lista ya viene filtrada por rol del usuario: la UI solo
  muestra/asistentes permitidos.
- Con `?assistant=` valido y permitido: banner/cabecera con nombre y
  descripcion del asistente, mensaje de bienvenida contextual (welcomeFor),
  prompts constantes adaptados al modulo y el `POST /ai-assistant/ask` envia
  `assistantId` (el backend usa `askAssistant` -> orquestador con las
  herramientas READ del registro). El badge de uso muestra
  `assistant:tool` (`usedTools` de la respuesta).
- `assistantId` invalido o no permitido para el rol => degradacion al
  asistente central (sin fuga: la lista de capabilities del rol nunca lo
  contiene). Cambiar de asistente reinicia conversacion (conversationId y
  historial nuevos; el contexto de dominio es distinto).
- El flujo clasico queda intacto: prefijo `@datos`, historial saneado,
  limites de `capabilities.limits`, alerta de proveedor no configurado y
  errores acotados del backend (503) sin romper el chat.

### URL reflect (`sgsst-web/src/App.tsx`)

- `readHashLocation()` ahora parsea `?assistant=` (regex
  `/^[a-z][a-z0-9]{1,31}$/`; valor invalido => undefined).
- Estado `assistantId` global; el efecto de hash refleja
  `#/aiAssistant?assistant=<id>` (comportamiento reemplazo, sin historial).
- `selectView('aiAssistant')` desde el menu lateral limpia el asistente
  activo (entra al central).
- `openAssistant(view, assistant)` nuevo: entry point de modulo; bloquea
  EMPLOYEE y `!canUseAssistant` (defensa en profundidad: el backend sigue
  siendo la autoridad con 403).

### Componentes y entry points (Fase L section 9 del plan)

- `sgsst-web/src/components/ModuleAssistantButton.tsx` (nuevo): boton
  reutilizable "Preguntar al asistente" (Tooltip + SmartToy) que llama
  `onOpen('aiAssistant', assistantId)`.
- `TableHeader` (`components/TablePieces.tsx`): slot opcional `assistant`
  para el entry point sin duplicar la cabecera en cada pagina.
- Entry points reales instalados (modulos con asistente desde fases H/E/F):
  - `RisksPage` -> assistantId `risks`.
  - `IncidentsPage` -> assistantId `incidents`.
  - `TrainingsPage` -> assistantId `trainings`.
- Los demas modulos del mapa (E§5: contractors, committees, emergency,
  sgsst-audits, indicators, documents, medical, ppe, findings) reciben el
  mismo patron pasando `onOpenAssistant` + el id correspondiente; se dejaron
  los tres citados como alcance de esta fase para acotar el diff (extension
  mecanica sin codigo nuevo).

## 2. Seguridad (invariantes del plan, replicados en UI)

- La UI nunca envia `companyId`; el backend lo resuelve con
  `resolveCompanyScope()` dentro del ToolContext.
- `capabilities.assistants` ya filtrado por rol: la UI no puede ofrecer un
  asistente que el rol no tenga; y si el hash trae un id no permitido,
  degrada al central. El 403 del backend cubre el caso hostil.
- EMPLOYEE no navega la vista aiAssistant (employeeBlocked de selectView) y
  `openAssistant` lo bloquea explicitamente.

## 3. Verificacion

- `sgsst-web`: `npm run build` (tsc -b && vite build) => **OK, exit 0**.
- `sgsst-api`: sin cambios de codigo en esta fase; suite previa referida en
  el commit S16.5 (514 tests en verde).
- La web no tiene runner de tests (package.json: dev/build/preview); la
  verificacion de esta fase es el build de tsc + vite y el criterio de no
  regresion del API (difi de solo-frontend: `git status` muestra unicamente
  archivos de sgsst-web).

## 4. Pendiente (siguientes fases)

- e2e-db del asistente (section 11 del plan): empresa cruzada, EMPLOYEE 403
  por asistente, herramienta fuera de whitelist => 403.
- Smoke HTTP de `capabilities` por rol con los 13 asistentes del registro.
- Extender entry points al resto del mapa de modulos (extension mecanica).
- Linea futura del plan: escritura con confirmacion (section 7) y sus
  dialogos de doble confirmacion en UI.

---

# Anexo S16.6.1 — Entry points completos + e2e-db del asistente

Fecha: **2026-10-09** · Sesion posterior al commit `b3089eb` (S16.6).

## 1. Entry points en TODO el mapa de modulos (Fase L completa)

Extension mecanica del patron `ModuleAssistantButton` a las 9 paginas
restantes con asistente en el registro del backend:

| Pagina | assistantId |
|---|---|
| FindingsPage | `findings` |
| ContractorsPage | `contractors` |
| CommitteesPage | `committees` |
| EmergencyPage (tab Brigadas) | `emergency` |
| SgsstAuditsPage | `audit` |
| IndicatorsPage | `indicators` |
| DocumentsPage | `documents` |
| MedicalPage (tab Profesiograma) | `medical` |
| PpePage (tab Catalogo) | `ppe` |

`App.tsx` pasa `onOpenAssistant={openAssistant}` a los 12 modulos con
entry point (los 3 previos + estos 9). Los asistentes quedan asi disponibles
en todos los modulos del mapa E–J del plan, cada uno con el id estable del
registro (`assistant-registry.ts`), y la capa de seguridad no cambia:
`capabilities.assistants` filtrado por rol + 403 del backend como autoridad.

## 2. e2e-db del asistente (section 11 del plan, PostgreSQL real)

Cinco casos nuevos en `sgsst-api/test/prisma-integration.db-e2e-spec.ts`:

1. `risks:matrix_summary` auditada con `AI_ASSISTANT_DATA_QUERY` para el
   actor de la empresa A (503 acotado sin proveedor es valido).
2. Empresa B invoca el asistente especializado: toda query queda asociada a
   actores de la empresa B; verifico en BD que ningun actor de A aparece
   (el companyId lo resuelve `resolveCompanyScope` en el ToolContext).
3. EMPLOYEE 403 por asistente y por herramienta (el guard del controlador
   lo bloquea antes de llegar al registro).
4. `critical_without_actions` contra el asistente `central` => 403
   (whitelist cerrada: la herramienta pertenece al asistente de riesgos).
5. `assistantId: 'fantasma'` => 400.

### Verificacion del anexo

- `npm run test:e2e:db -- --testPathPatterns=prisma-integration` =>
  **12/12 PASS** (Postgres 16 efimero + migraciones deployadas).
- `npm test` (unidad, API) => **65 suites, 514 tests PASS**.
- `npm run lint` => **0 errores** (78 warnings pre-existentes).
- `sgsst-web`: `npm run build` => **OK, exit 0**.

## 5. Pendiente (siguientes fases)

- Smoke HTTP de `capabilities` por rol con los 13 asistentes del registro.
- Fase 2 del router elegible: `escalationLevel` en Task (P3 del plan,
  solo si el volumen lo exige).
- Linea futura del plan: escritura con confirmacion (section 7) y sus
  dialogos de doble confirmacion en UI.
