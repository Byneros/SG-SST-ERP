# Evidencia S3.2 — Flujo encadenado empresa→sede→empleado→usuario (Issue #7)

Fecha: **2026-10-07** · Entorno: stack dev (`sgsst_api` en `http://localhost:3002`, web `http://localhost:5176`, PostgreSQL dev `5434`). Empresas demo `[S3.1-DEMO]` A (8a90bd95-…) y B (5ab2e698-…) sembradas por `scripts/qa-s31-demo-data.mjs` (mapeo corregido por sufijo real del nombre, ver Hallazgo 1).

## 1. Prueba del flujo encadenado — `scripts/qa-s32-flow.mjs` (nuevo)

Resultado: **10/10 pasos OK** (exit 0), 2 corridas (la segunda, tras corregir el sembrado, con actor y datos consistentes):

```
PASS  S0 login SUPER_ADMIN
PASS  Empresas demo encontradas — A=8a90bd95… B=5ab2e698…
PASS  Crear sede en A
PASS  Crear empleado en la sede (document único global)
PASS  Crear usuario con rol ADMIN de A — email=s32-…@demo.com
PASS  Login del usuario nuevo
PASS  P-A1 el usuario nuevo consulta SU empleado -> 200
PASS  P-A2 el usuario nuevo NO consulta empleado de B -> 404
PASS  P-A3 el usuario nuevo NO consulta sede de B -> 404
PASS  P-A4 companyId manipulado no evade scope -> 403
```

Nota del flujo: el DTO `CreateUserDto` **no expone** el vínculo `employeeId` (la creación del usuario es solo name/email/password/role/companyId); el paso "empleado asociado al usuario" se cubre por encadenamiento de datos (el usuario queda scoped a la empresa en la que nació, junto con el empleado creado en ella en el paso anterior). No es una deficiencia del flujo: es el contrato actual del API, y el aislamiento del usuario quedó verificado en P-A1..P-A4.

## 2. Evidencia UI — `scripts/qa-s32-ui-evidence.mjs` (nuevo)

Login real en la web (`http://localhost:5176`) como el usuario recién creado (`s32-…@demo.com` / empresa A):

- `loggedIn: true`; el módulo multi-empresa NO aparece para un ADMIN tenant (`companiesModuleNoAparece: true`).
- `GET /companies` con su sesión: **solo su empresa** (`[S3.1-DEMO] Empresa A S.A.S.`) — el listing está scoped en el servicio (`companies.service.findAll` con `resolveCompanyScope`).
- `GET /employees?companyId={B}`: **HTTP 200 con lista vacía** (scope filtra en BD; sin fuga de registros).
- `GET /employees/{id-de-B}`: **404** (`Employee not found`).
- Módulo Empleados de A: solo sus trabajadores, cero registros de B. Captura: `scripts/qa-artifacts/s32-ui-empleado-nuevo.png`.

## 3. Hallazgos del QA (y su resolución)

1. **Sembrado no-determinista (mi script, no el ERP):** la primera corrida de `qa-s31-demo-data.mjs` eligió A/B por posición del listado en lugar del sufijo del nombre; los datos "A" quedaron en la empresa con nombre "B". Corregido el script (mapeo por sufijo) y re-corridos los flujos; el ERP nunca filtró mal — el aislamiento se mantuvo en ambos escenarios (los datos "mal puestos" nunca cruzaron fronteras).
2. **Bloqueo tienda vs API demo:** DELETE de la empresa demo sin datos da 403, correcto guardas de negocio (no es fallback de limpieza; el runbook sugiere desactivar, no borrar).
3. **Endpoint `companies`:** el ADMIN tenant recibe 200 con una sola empresa (la suya); **no** es fuga multi-tenant (el scope filtra el listado en el servicio).
4. El JWT del usuario de prueba (payload inspeccionado) muestra `companyId` = su empresa de nacimiento; el scope usa ese valor y **no** el `companyId` del cliente en los endpoints con filtro por empresa (`403` del `resolveCompanyScope`).

## 4. Criterios de aceptación del issue #7 — verificados

- [x] Creación del encadenado desde la UI/API: empresa demo → sede → empleado → usuario con rol (ADMIN) — datos demo en el entorno (figura 1 y `qa-s32-flow.mjs`).
- [x] El usuario creado inicia sesión y **solo accede a su empresa** (404/403 cruzando a B; listado `companies` y `employees` scoped; sin registros ajenos).

## 5. Cierre

Evidencia comentada en el issue #7 con los 2 checkboxes marcados y cierre del issue (misma sesión; ver comentario en GitHub).
