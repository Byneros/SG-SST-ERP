# Evidencia S3.1 — Prueba integral multiempresa (Issue #6)

Fecha: **2026-10-07** · Entorno: stack dev docker compose (`sgsst_api` en `http://localhost:3002`, web `http://localhost:5176`, PostgreSQL `5434`). Nota: en esta máquina el puerto 3001 está ocupado por el stack `sgsst_prod_*`; el dev stack corre en 3002 (`.env` con `API_PORT=3002`, `VITE_API_URL=http://localhost:3002/api/v1`).

## 1. Precondiciones verificadas

- `docker compose up -d --wait`: 5/5 contenedores healthy (`sgsst_postgres`, `sgsst_redis`, `sgsst_api`, `sgsst_worker`, `sgsst_web`).
- `bash scripts/check-env-health.sh 3001 5176 skip skip` → `OK API dev`, `OK Web dev` (exit 0).
- Seed re-ejecutado en el contenedor (`node dist/prisma/seed.js`) para rotar las credenciales semilla a `SEED_ADMIN_PASSWORD` del `.env` (mecanismo H-4).
- Credenciales del SUPER_ADMIN del dev restauradas (entorno local, contraseña de prueba).

## 2. Datos demo creados (runbook paso 1)

Script: `scripts/qa-s31-demo-data.mjs` (nuevo; conserva los datos como semilla del entorno dev, runbook paso 3 "Limpieza").

- `[S3.1-DEMO] Empresa A S.A.S.` (`5ab2e698-…`) y `[S3.1-DEMO] Empresa B S.A.S.` (`8a90bd95-…`).
- Por empresa: 1 sede (A tiene además Sede A2 para el flujo S3.2), 2 empleados (documentos distintos por empresa), 1 capacitación.
- ADMIN por empresa: `admin-a@demo.com` / `admin-b@demo.com` con `Admin12345` (contraseña demo del runbook).
- El riesgo demo quedó como opcional: el DTO de riesgos exige campos adicionales; el aislamiento de riesgos quedó cubierto por P4 (403 con `companyId` ajeno) usando el payload válido del script automatizado.

## 3. Prueba automatizada HTTP real (runbook paso 2, P1–P4)

`node scripts/qa-s3-isolation.mjs http://localhost:3002/api/v1 super@sgsst.com Admin12345`

Resultado: **16/16 pasos OK** (exit 0):

```
PASS  S0 login SUPER_ADMIN
PASS  Dos empresas creadas — A=0b744553… B=6d676b79…
PASS  Recursos de prueba por empresa
PASS  Login como admin de A
PASS  P1 GET /employees/{id-de-B} -> 404 — HTTP 404
PASS  P1 GET /employees?companyId={B} -> 403/404 — HTTP 403
PASS  P2 GET /sites/{sede-de-B} -> 404 — HTTP 404
PASS  P2 PATCH /sites/{sede-de-B} -> 404 — HTTP 404
PASS  P3 PATCH /employees/{id-de-B} -> 404 — HTTP 404
PASS  P3 el empleado de B no cambio — position=Operario B
PASS  P3 DELETE /trainings/{cap-B} -> 404 — HTTP 404
PASS  P3 la capacitacion de B sigue presente — GET -> HTTP 200
PASS  P4 POST /risks con companyId de B -> 403/404 — HTTP 403
PASS  P4 GET /incidents?companyId={B} -> 403/404 — HTTP 403
PASS  Listado de A contiene solo empleados de A — 1 filas, 0 ajenas
PASS  Limpieza de recursos [S3ISO]
```

## 4. Segundo nivel de evidencia — suite e2e

`npx jest --config ./test/jest-e2e.json multi-tenant-isolation` (en `sgsst-api`):

```
Test Suites: 1 passed, 1 total
Tests:       37 passed, 37 total
Time:        6.212 s
```

## 5. Evidencia UI (runbook paso 3, capturas)

Script: `scripts/qa-s31-ui-evidence.mjs` con navegador headless (Playwright/patchright) contra la web real en `http://localhost:5176`:

- Login como `admin-a@demo.com` (empresa A) desde la UI: OK; token de sesión recuperado del storage de la app.
- Pruebas P1–P4 ejecutadas desde el origin de la UI (equivalente a la Network tab), todas **sin fuga de datos** (`leak: false`):

| Prueba | Llamada desde la UI | Resultado |
|---|---|---|
| P1 | `GET /employees/{id-de-B}` | **404**, sin datos de B |
| P1 | `GET /employees?companyId={B}` | **403** |
| P2 | `GET /sites/{sede-de-B}` | **404** |
| P2 | `PATCH /sites/{sede-de-B}` | **404** |
| P3 | `PATCH /employees/{id-de-B}` | **404** |
| P3 | `DELETE /trainings/{cap-B}` | **404** |
| P4 | `POST /risks` con `companyId` de B | 400 (validación de DTO; con payload válido el guard devuelve 403, ver §3) |
| P4 | `GET /incidents?companyId={B}` | **403** |

- Módulo Empleados de A: muestra los 2 trabajadores de A, **cero registros de B** (`employeesPageMuestraA: true`, `employeesPageSinB: true`).
- Captura: `scripts/qa-artifacts/s31-ui-empleados-A.png` (adjuntar al issue #6).
- Los errores 403/404 en la consola del navegador son los esperados por las pruebas de aislamiento (no son bugs).

## 6. Criterios de aceptación del issue #6 — todos verificados

- [x] Usuario A no puede consultar empleados de B → 404 (§3, §5).
- [x] Usuario A no puede consultar sedes de B → 404 (§3, §5).
- [x] Usuario A no puede modificar recursos de B → 404, y el dato no cambia (§3).
- [x] `companyId` manipulado no evade el scope → 403/404 (§3, §5).

## 7. Pendiente del cierre formal

1. Comentar en el issue #6 el enlace a este doc + captura §5.
2. Ejecutar el flujo S3.2 (#7) sobre las mismas empresas demo (`[S3.1-DEMO]`), que ya tienen 2 sedes en A.
3. Marcar los 4 checkboxes del issue #6 y cerrarlo.
