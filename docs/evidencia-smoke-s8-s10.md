# Evidencia smoke test S8-S10 (cierre formal, pendientes 1 y 2)

Fecha: 2026-09-28. Entorno: stack dev del compose (`sgsst_*`) con PostgreSQL
16 real (`sgsst_postgres`), API en `http://localhost:3002/api/v1`
(`API_PORT=3002`), migraciones al dia (41 registros en `_prisma_migrations`,
"Ninguna migracion pendiente" via `prisma migrate deploy`).

Cierra los puntos 1 y 2 de "Pendiente para cierre formal" de
`evidencia-implementacion-s8.md`, `s9` y `s10` (queda el punto 3: marcar
checkboxes en los issues #17-#27 y la matriz #43, que es accion humana en
GitHub).

## 1. Migraciones (pendiente 1) — VERIFICADO

- `docker exec sgsst_api npx prisma migrate deploy` -> `No pending migrations to apply.`
- Incluye las migraciones de S8.1/S8.2 (`2026092512/13*`), S9.1/2/3/4
  (`2026092514/15/16*` + fixes `2026092518/19*`) y S10
  (`20260925170000_s10_medicine_work_health`).

## 2. Smoke test via HTTP real (pendiente 2) — 24/24 PASS

Script: `scripts/smoke-s8-10.mjs` (reproducible: `node scripts/smoke-s8-10.mjs`,
usa `admin@sgsst.com` del seed y limpia sus recursos `[SMOKE]`; limpieza
auxiliar `scripts/smoke-s8-10-cleanup.mjs`).
- S8: plan anual 2026 creado, actividad PHVA creada, avance respondido
  (DONE <=> 100%), reporte `annual-plan` CSV (200, contenido con la actividad)
  y PDF (200).
- S9: inspeccion planeada con checklist respondido in-place, hallazgo con
  accion correctiva, inspeccion no planeada cuyo hallazgo genero un Risk
  GTC-45 en la matriz, reporte inseguro anonimo creado y cerrado, item EPP
  creado (la entrega requiere un empleado real: se saltea en smoke y se
  valido la restriccion de stock/entrega en las 6 pruebas unitarias de EPP).
- S10: empleado de prueba, profesiograma creado, examen programado y con
  concepto APTO registrado, restriccion creada y levantada con responsable
  (`LIFTED`).
- Limpieza verificada por SQL: 0 residuos `[SMOKE]` en BD.

## 3. Smoke UI en navegador (pendiente 2, parte UI) — 8/8 PASS

Script: `scripts/qa-smoke-ui.mjs` (headless via skill browser-automation,
reproducible contra `http://localhost:5176`).

- Login real desde browser frio (`admin@sgsst.com`) y recorrido por clics del
  sidebar (hamburger + drawer) por: Plan Anual (S8), Inspecciones planeadas y
  no planeadas, Actos y condiciones, EPP (S9), Medicina laboral (S10) y
  Asistente IA (16.2).
- 8/8 pasos OK, marcador de contenido encontrado en cada vista, **0 errores de
  consola** y 0 requests fallidos.
- Observacion menor (no bug): la app no escucha `hashchange`; cambiar el hash
  via JS no navega (solo el sidebar). `readHashLocation()` corre al montar.

## Hallazgos ambientales (no bloquean, documentar)

1. **Conflicto de puerto 5433 — RESUELTO 2026-09-28**: habia un servicio
   PostgreSQL de Windows escuchando en el mismo host-port que el Postgres del
   compose (el bind especifico ganaba sobre el proxy de Docker y `prisma`
   local autenticaba contra el servicio equivocado). Solucion aplicada:
   host-port del Postgres dev movido a **5434** via `POSTGRES_HOST_PORT`
   (parametrizado en `docker-compose.yml` con default 5433 para CI, fijado en
   `.env`), `sgsst-api/.env` alineado, y `docker compose up -d postgres
   --force-recreate` (volumen y datos intactos). Verificado: `npx prisma
   migrate status` desde el host -> "Database schema is up to date!". Detalle
   del sintoma en `convivencia-dev-prod-local.md`.
2. **`prisma.config.ts` + dotenv**: los comandos Prisma locales cargan
   `sgsst-api/.env` (DATABASE_URL con la contraseña del servicio Windows) y
   puede anular un override de DATABASE_URL en la invocacion; para operar la
   BD del compose usar `docker exec sgsst_api npx prisma migrate ...` o
   ajustar `DATABASE_URL` del `.env` local al puerto/credenciales correctos.
