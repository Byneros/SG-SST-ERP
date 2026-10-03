# Evidencia S3 — Aislamiento multiempresa (S3.1) y flujo empresa → sede → empleado → usuario (S3.2)

Fecha: 2026-10-01 · Entorno: stack dev local (API `sgsst_api` en 3002, web 5176, PostgreSQL del compose).
Issues: #6 (S3.1), #7 (S3.2) · Runbook: `docs/runbook-s3-1-prueba-multiempresa.md`.

## Datos de prueba

| Empresa | NIT | Usuario | Rol | Origen |
|---|---|---|---|---|
| Empresa A (seed) | — | `admin@sgsst.com` / `Admin12345` | ADMIN | seed |
| Constructora El Roble S.A.S. | `901947276-4` | `admin@elroble.com` / `RobleAdmin2026*` | ADMIN | corrida 2026-09-30 (`create-demo.mjs`) |
| Textiles UI SAS | `90609981-4` | `admin.ui.042022@textilesui.com` | ADMIN | creada **desde la UI** en esta corrida |

La empresa B (El Roble) quedó sembrada con 1 sede (`Obra Ciudadela`), 3 empleados y
2 incidencias por una corrida previa de `sgsst-api/create-demo.mjs` (2026-09-30); esta
corrida la reutilizó en lugar de duplicarla. Durante la auditoria se encontro que el
script no es idempotente (falla con P2002 si el admin ya existe); ver hallazgos.

## S3.1 — Las cuatro pruebas de aislamiento (criterios del issue #6)

Verificación automatizada: `sgsst-api/s31-isolation-check.mjs` (nuevo, transcribe el
runbook P1–P4 contra la API real con PostgreSQL). Resultado: **15/15 PASS**.

| # | Criterio | Verificación | Resultado |
|---|---|---|---|
| P1 | Usuario A no consulta empleados de B → 404 | `GET /employees/{id de B}` con token de A; inversa B→A | 404 · PASS |
| P1 | Listado con filtro ajeno | `GET /employees?companyId={B}` como A | 403 · PASS |
| P2 | Usuario A no consulta sedes de B → 404 | `GET /sites/{id de B}` como A | 404 · PASS |
| P2 | Mutación ajena no existe para el actor | `PATCH /sites/{id de B}` como A | 404 · PASS |
| P3 | Usuario A no modifica registros de B → 404 | `PATCH /incidents/{id de B}` como A; registro intacto verificado después | 404 · PASS |
| P4 | companyId manipulado no evade el scope → 403/404 | `POST /incidents` con companyId ajeno; `GET /incidents?companyId={B}` | 403 · PASS |
| + | Sin fugas en listados | listado de incidencias de A no contiene registros de B | PASS |
| + | Datos de B intactos tras la intrusión | GET como B tras los intentos | PASS |

Salida completa de la corrida (2026-10-01, API dev 3002):

```
PASS login admin empresa A (seed) :: status=201
PASS login admin empresa B (El Roble) :: status=201
PASS datos de B disponibles (sede, empleado, incidencia)
PASS datos de A disponibles (empleado)
PASS P1 GET /employees/{id de B} como A -> 404
PASS P1 GET /employees?companyId={B} como A -> 403/404 :: status=403
PASS P1+ GET /employees/{id de A} como B -> 404
PASS P2 GET /sites/{sede de B} como A -> 404
PASS P2 PATCH /sites/{sede de B} como A -> 404
PASS P3 PATCH /incidents/{id de B} como A -> 404
PASS P4 POST /incidents con companyId de B como A -> 403/404 :: status=403
PASS P4 GET /incidents?companyId={B} como A -> 403/404 :: status=403
PASS aislamiento en listado: A no ve incidencias de B :: leak=false
PASS registro de B intacto tras los intentos
PASS empleado de B intacto tras los intentos
```

Segundo nivel (suite e2e del repo, `sgsst-api/test/multi-tenant-isolation.e2e-spec.ts`):

```
Test Suites: 1 passed, 1 total
Tests:       35 passed, 35 total
Time:        5.634 s
```

## S3.2 — Flujo empresa → sede → empleado → usuario (criterios del issue #7)

Tres niveles de verificación:

1. **API** (`sgsst-api/s32-flow-check.mjs`, nuevo): 12/12 PASS — sede creada (201),
   empleado asociado a sede (201), usuario SST creado y asignado a la empresa correcta
   (201), login del nuevo usuario (201), solo ve sedes/empleados de su empresa, 404
   ante recursos de otra empresa, 403 ante companyId manipulado.
2. **UI real** (navegador headless contra la web 5176):
   - Login como ADMIN de B desde la pantalla de login → dashboard scopeado
     (4 empleados, 2 incidentes, 3 usuarios; sin datos de A).
   - Módulo **Sedes** → "Nuevo" → sede `Sede UI Norte` creada y visible en tabla.
   - Módulo **Empleados** → "Nuevo" → empleado `Andres UI Gomez` con sede
     `Sede UI Norte`, visible en la tabla con su sede.
   - Módulo **Usuarios** → "Nuevo" → usuario `Marta UI Suarez` rol SST creado y
     visible en tabla (campo Empresa preseleccionado con la empresa propia).
   - Logout → login con `ui.665634@elroble.com` → sesión `SST`, dashboard con datos
     solo de B; 0 errores de red en las operaciones del flujo.
   - Con **SUPER_ADMIN** (`super@sgsst.com`, creado en dev para la prueba): empresa
     `Textiles UI SAS` creada desde **Empresas → Nuevo** (NIT validado por el DTO),
     seleccionada como empresa activa, y su ADMIN creado desde **Usuarios → Nuevo**
     con el campo Empresa deshabilitado y fijado a la activa (comportamiento correcto).
   - Login con el ADMIN de la nueva empresa → `session: admin.ui.042022@textilesui.com - ADMIN`,
     ve únicamente Textiles UI SAS, cero datos de otras empresas.
3. **Base de datos**: `User.role`, `User.companyId` y `Company` verificados por SQL
   tras cada paso (sin recursos huérfanos ni asignaciones cruzadas).

## Hallazgos menores (no bloqueantes)

1. **Inconsistencia de formato de listados**: `GET /incidents` devolvía un array
   plano mientras `GET /employees` y `GET /sites` devuelven `{ data: [...] }`.
   **CORREGIDO el 2026-10-01**: `IncidentsRepository.findAll` ahora pagina y
   devuelve `{ data, meta: { page, pageSize, total, totalPages } }`, con busqueda
   por title/description y filtro por sede via nuevo `IncidentListQueryDto`
   (patrón de `EmployeeListQueryDto`). Actualizados: `ai-assistant.tools.ts`
   (desestructura `data`), mock en memoria del e2e y spec unitario del assistant.
   Verificación: 288 unitarias, 35 e2e, build, tsc API/web, y suite S3.1 15/15
   contra la API real reconstruida. El frontend ya consumía `Paginated<Incident>`.
2. **`create-demo.mjs` no era idempotente**: una segunda corrida creaba la empresa y
   fallaba con P2002 al crear el admin (quedaba empresa huérfana). **CORREGIDO el
   2026-10-03**: chequeo previo por email del admin y por nombre de la empresa
   (reutiliza la empresa huérfana de una corrida abortada antes de crear el admin),
   sede reutilizada por nombre y empleados/incidencias con match del lado del
   cliente sobre el listado paginado (el buscador del backend no cubre
   firstName+lastName combinados). Verificado con dos corridas consecutivas: 0
   FAIL y sin duplicados (El Roble se mantiene en sus 5 empleados).
3. **Ruido de UI con SUPER_ADMIN sin empresa activa**: el dashboard dispara ~26
   peticiones que el backend rechaza con 403 hasta seleccionar empresa activa. El
   backend protege bien; el frontend podría diferir esas cargas.
4. **Pantalla de empresas**: el diálogo muestra el mensaje crudo de validación del
   backend (`nit must use Colombian format...`) en inglés; candidato a i18n.
5. **Prerequisito operacional**: no existía ningún SUPER_ADMIN en dev, por lo que la
   creación de empresas solo era posible vía Prisma. Se creó `super@sgsst.com`
   (equivalente a seed; no versionado).

## Criterios de aceptación del issue #6 (S3.1) — estado

- [x] Usuario A no consulta empleados de B → 404
- [x] Usuario A no consulta sedes de B → 404
- [x] Usuario A no modifica B → 404
- [x] companyId manipulado no evade scope → 403/404

## Criterios de aceptación del issue #7 (S3.2) — estado

- [x] El flujo completo se ejecuta desde la UI (empresa → sede → empleado → usuario)
- [x] El usuario creado accede únicamente a su empresa

## Cómo reproducir

```bash
docker compose up -d --wait                       # stack dev
docker cp sgsst-api/s31-isolation-check.mjs sgsst_api:/app/   # o crear empresa B con create-demo.mjs
docker exec -w /app sgsst_api node s31-isolation-check.mjs
docker cp sgsst-api/s32-flow-check.mjs sgsst_api:/app/
docker exec -w /app sgsst_api node s32-flow-check.mjs
cd sgsst-api && npx jest --config test/jest-e2e.json multi-tenant-isolation
```
