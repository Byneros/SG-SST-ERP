# Sesión de velocidad — 2026-10-15 (para retomar el trabajo)

Doc de handoff de la sesión del **2026-10-15**. Complementa `docs/analisis-avance-sprints-2026-10-14.md`
(corte convertido al 15) y `docs/smoke-revalidacion-post-s16-2026-10-15.md`.

> **ANEXO 2026-10-16:** #57 quedó implementado, corregido y con smoke 16/16
> (`354c4eb`) y #58 quedó implementado con smoke 15/15 (`dfd8695`). La
> evidencia completa y los resultados están en
> `docs/evidencia-implementacion-s17-matriz-y-capacitaciones.md`. Queda el
> cierre formal en los issues (#57/#58 checkboxes + comentario en #43) y la
> deuda #1 (despliegue cloud) con su checklist en `docs/despliegue-preparacion.md`.
> Suite tras ambos: unitaria 533/533 · e2e 67/67 · e2e-db 41/41.

## 1. Estado del sprint al cierre de la sesión

- **Rama `main`**, working tree limpio. Commits del día (cabezas):
  - `087093e` docs: higiene de matriz #43 cerrada (22 cuerpos).
  - `cb87ff6` docs: smoke de revalidación post-S16 (deuda #3).
  - `4ebe57a` S15: QA de #40/#55/#56 — cerrados. S15 formal 100%.
  - `4d947a6` S5-S6: QA de aceptación (issues #10–#14 cerrados el 14).
- **Formal S2–S15: 38/38 = 100%**, derivable 1:1 de los checkboxes de los cuerpos.
- Abiertos: **#57** (matriz GTC-45 estructurada), **#58** (capacitaciones: asistentes/evaluación/evidencia)
  y **#43** (índice de gobernanza; su único criterio suelto, el reporte de matriz de riesgos de #11,
  quedó re-scoped dentro de #57).
- Deudas transversales: #2 (higiene) y #3 (smoke) **resueltas hoy**; #1 (decisión de negocio de despliegue)
  y #5–#9 (P2/P3) sin cambios.

## 2. Cómo levantar el entorno otra vez

```bash
# Docker Desktop -> docker compose
docker compose up -d --build           # postgres/redis/api/worker/web; API en API_PORT=3002
curl http://localhost:3002/api/v1      # 401 esperado cuando responde

# Validación rápida (sgsst-api)
cd sgsst-api && npm run test           # 519/519 PASS (65 suites) — EXIT 0 el 2026-10-15
npm run build                          # EXIT 0
npm run test:e2e                       # 67/67 (security, sso, multi-tenant, external-deliveries)
npm run test:e2e:db                    # 41/41 sobre Postgres efímero (docker necesario)

# Smoke post-S16 (8/8 verde el 15 — ver docs/smoke-revalidacion-post-s16-2026-10-15.md)
node scripts/smoke-s8-10.mjs http://localhost:3002/api/v1 admin@sgsst.com "$SEED_ADMIN_PASSWORD"
```

**Credenciales dev:** seed = `admin@sgsst.com` / `sst@sgsst.com` / `empleado@sgsst.com` con
`SEED_ADMIN_PASSWORD` de `.env`. OJO: `super@sgsst.com` **no existe** (los scripts de QA viejos con
`super@` fueron migrados a `admin@`). Demo multiempresa: `admin-a@demo.com` / `admin-b@demo.com`
con `Admin12345`. **Evidencia local:** `scripts/qa-artifacts/` está en `.gitignore` (convención del repo).

## 3. Datos demo vigentes en dev (decisión deliberada)

- `[QA-S56]` (riesgos, incidentes, capacitaciones), `[QA-S56-AUD]`
  (auditorías `[QA-S56-AUD]`, hallazgos unificados y acciones VERIFIED con guardas) y
  `[QA-S15]` (plan anual 2026 + 2 actividades PHVA).
- Sirven de base para el QA de #57/#58; borrables a mano si molestan (las auditorías ya están CERRADAS).

## 4. Próximos pasos (orden propuesto)

1. **#57 matriz GTC-45 estructurada** (feature, estimación 1–2 días): modelos
   `RiskProcess → RiskActivity → RiskHazard` (cadena GTC-45) + valoración/controles sobre
   `Risk`, reporte `risks-matrix` CSV/PDF y cierre de #11 (su único checkbox suelto).
2. **#58 capacitaciones** (asistentes, evaluación y evidencia por trabajador + vencimiento): ampliar
   `Training` con asistentes/evaluación/evidencia y dashboard de vencimientos.
3. Después de ambos: cerrar el ciclo marcando checkboxes en #57/#58 y comentando #43.
4. Pendiente transversal grande (decisión negocio): deuda #1 de despliegue cloud — checklist listo en
   `docs/despliegue-preparacion.md`.

## 5. Gotchas de la sesión (aprender rápido después)

- `POST /reports/:kind.:format/schedule` es el endpoint real (devuelve `exportId`, no `id`); el polling
  se hace por `GET /reports/exports` (no hay `GET /exports/:id`).
- `POST /indicators/:id/measurements` recibe `{ measurements: [{ period, value, notes }] }`.
- El `CreateDocumentDto` ya no acepta `status` (whitelist) — los smoke s14/s15-actions se corrigieron por eso.
- El endpoint anidado `PATCH /sgsst-audits/actions/:id` NO aplica guardas: el ciclo trazable oficial es el
  unificado (`/findings` + `/actions` con `advance`/`verify`).
- En Windows/Git Bash, un heredoc de código JS con CRLF rompe: usar `node scripts/*.mjs` desde archivos
  (convención ya extendida en `scripts/qa-*`).
