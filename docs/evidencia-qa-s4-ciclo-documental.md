# Evidencia QA S4 — ciclo documental e entregas externas (issues #8 y #9)

Fecha: 2026-10-13 · Rama `main` · Base: commit `d243f86` (workflow de aprobación
documental) · Entorno: API dev reconstruida (`docker compose up -d --build api`)
en `:3002` + `sgsst-web` dev (Vite, `VITE_API_URL` hacia la API) · Chrome
headless vía Playwright (`channel: 'chrome'`).

## 1. S4.1 — Ciclo de vida documental (#8)

Herramientas: `scripts/qa-s4-document-cycle.mjs` (recorrido UI completo) +
sondas enfocadas por transición (ver §2) + verificación API del ciclo.

### 1.1 Recorrido UI completo (navegador frío)

```text
PASS 0 login UI (navegador frio)
PASS 1 vista Documentos con boton Nuevo
PASS 2 archivo subido y reflejado en la UI
PASS 2b dialogo completado con vencimiento pasado
PASS 3 documento creado y visible en la tabla
PASS 3b estado inicial Borrador (v1)
PASS 3c documento localizado via API con companyId del scope
PASS 4 aprobar y publicar: chip Publicado + Aprobado (aprobador)
```

- Creación desde la UI con **upload real** (`POST /documents/upload` → el
  archivo queda en storage y el nombre se refleja en el diálogo).
- Aprobación desde la UI: botón de fila → **diálogo de confirmación** →
  `POST /documents/:id/approve` → la fila refresca con chip `Publicado` +
  chip `Aprobado` (con el aprobador, tooltip en el chip).

### 1.2 Transiciones "vencer" y "archivar" desde la UI (sondas con bitácora de red)

Preparadas por API (`create + approve` / `+ expire`) para enfocar el clic
real de esa transición en el navegador:

```text
VENCER (UI):    boton "Marcar vencido" visible → confirm →
                201 POST /documents/:id/expire → 200 GET /documents (reload) →
                chip "Vencido" presente → estado server EXPIRED
ARCHIVAR (UI):  boton "Archivar documento" visible → confirm →
                201 POST /documents/:id/archive → 200 GET /documents (reload) →
                chip "Archivado" presente → estado server ARCHIVED
```

### 1.3 Ciclo completo verificado también por API + AuditLog

```text
create: 201 · approve: 201 (PUBLISHED) · expire: 201 (EXPIRED) ·
archive: 201 (ARCHIVED)
audit acciones (entity=Document, entityId=<doc>): ["ARCHIVE","EXPIRE","APPROVE","CREATE"]
delete [SMOKE]: 200
```

Las cuatro transiciones del ciclo quedan en `AuditLog` con la entidad, id y
empresa del scope (verificado que las filas de auditoría del recorrido
pertenecen a la empresa del actor).

### 1.4 Aislamiento multiempresa

- **e2e-db con PostgreSQL real** (`npm run test:e2e`, 67/67 en el corte):
  `prisma-integration.db-e2e-spec.ts` incluye el caso "document workflow
  requires approval, resets on a new version, **and stays tenant scoped**";
  `multi-tenant-isolation.e2e-spec.ts` cubre el CRUD cruzado (404: el recurso
  ajeno no existe para el actor); `security.e2e-spec.ts` cubre RBAC por rol.
- **En vivo**: la lista del ADMIN (`GET /documents`) no devuelve documentos
  de empresas ajenas (check del QA script, `foreign=0`).

### 1.5 Hallazgo de QA (no defecto de producto)

El reload general de listas que la SPA dispara tras cada guardado puede
golpear el rate limit global (`RATE_LIMIT_MAX_REQUESTS=120/60s`) en una
sesión larga de QA y dejar la fila desactualizada (HTTP 429 en el refetch).
El estado del servidor resultó correcto en todos los casos; el artefacto de
prueba lo mitiga remontando el módulo (nueva carga) antes de asertar el chip.
Para sesiones de QA más largas se recomienda subir `RATE_LIMIT_MAX_REQUESTS`
en dev. Nota adicional: los `Tooltip` MUI no exponen `title` hasta el hover;
el accessible name real de los botones llega por `aria-label` (así lo usa el
script).

## 2. S4.2 — Entregas externas (#9)

1. **e2e-db enfocado** (`npx jest -c test/jest-e2e.json external-deliveries`):
   **17/17 PASS** (PostgreSQL real), incluyendo:
   - listado con scope de empresa y aislamiento A/B, `companyId` fuera de
     alcance → 403, EMPLOYEE 403 y token inválido 401;
   - reintento con backoff y marcado `FAILED` cuando el canal falla;
   - `SENT` con `deliveredAt` y auditoría cuando el canal entrega;
   - **SKIPPED cuando el canal está deshabilitado** (camino documentado del
     issue: no se exige proveedor real de WhatsApp/SMTP para la corrida);
   - reintento manual forzado de una entrega agotada; cross-tenant 403;
     procesado que salta lo no reintentable.
2. **En vivo (SKIPPED)**: durante el smoke de S16.1 de esta misma sesión, la
   entrega externa generada por el escalamiento quedó `status=SKIPPED` con
   canales externos apagados, sin afectar la notificación interna
   (`docs/evidencia-smoke-s16-1-escalamiento.md`).
3. Entrega **exitosa real** (SENT vía SMTP/WhatsApp real): no ejecutable en
   dev sin proveedor externo; queda documentado por el camino equivalente
   e2e (FAIL→retry→SENT con deliveredAt bajo el mock) y SKIPPED en vivo.
   Para producción, `#9` deja como operación pendiente la corrida con
   credenciales reales en staging (no bloquea el QA de aceptación documental).

## 3. Resumen del estado de los criterios

| Criterio | Evidencia |
|---|---|
| #8 ciclo completo desde la interfaz | QA script pasos 0–4 + sondas vencer/archivar desde UI (§1.1–1.2) |
| #8 versiones/aprobaciones asociadas al documento | `DocumentApproval` por versión (unique `documentId+version`), aprobador persistido; e2e "resets on a new version" |
| #8 AuditLog en transiciones críticas | 4 acciones verificadas por entityId (§1.3) |
| #8 aislamiento por empresa | e2e-db tenant scoped + lista sin empresas ajenas (§1.4) |
| #8 UI refleja el estado real | chips Borrador/Publicado/Vencido/Archivado sincronizados con el estado server en cada transición |
| #9 entrega exitosa registra intento+estado | e2e SENT + deliveredAt + auditoría (§2.1) |
| #9 reintento con backoff y límite→fallida | e2e FAILED con backoff; reintento manual agotado (§2.1) |
| #9 SKIPPED documentado | e2e SKIPPED + SKIPPED en vivo (§2.2) |
| #9 aislamiento por empresa | e2e listas A/B + cross-tenant 403 |
