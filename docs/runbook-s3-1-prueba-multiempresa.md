# Runbook S3.1 — Prueba integral multiempresa (Issue #6)

Procedimiento operativo para cerrar la historia **S3.1 (Issue #6)** de la matriz de
backlog (issue #43): crear dos empresas reales en el entorno dev, ejecutar las
cuatro pruebas de aislamiento desde la UI y dejar evidencia trazable para
marcar los checkboxes del issue.

> Complemento automatizado: `sgsst-api/test/multi-tenant-isolation.e2e-spec.ts`
> cubre esta matriz a nivel servicio (MemoryStore). Este runbook valida la capa
> completa: UI → API → Prisma → PostgreSQL.

## Precondiciones

1. Stack levantado y sano:
   ```bash
   docker compose up -d --wait
   bash scripts/check-env-health.sh 3001 5176 skip skip
   ```
2. Web accesible en `http://localhost:5176`, API en `http://localhost:3001/api/v1`.
3. Un usuario SUPER_ADMIN existente (para crear las dos empresas) o dos empresas
   ya provisionadas con un ADMIN cada una.

## Paso 1 — Empresas demo

Crear las dos empresas desde la UI (módulo Empresas) o vía API:

| Empresa | NIT | Usuario | Rol | Contraseña demo |
|---|---|---|---|---|
| Empresa A S.A.S. | `900000001-1` | `admin-a@demo.com` | ADMIN | `Admin12345` |
| Empresa B S.A.S. | `900000002-2` | `admin-b@demo.com` | ADMIN | `Admin12345` |

Para cada empresa registrar además:

- 1 sede (la empresa A puede tener 2 para el flujo S3.2).
- 2 empleados por sede (usar documentos distintos entre empresas, p. ej.
  `CC-1001A...` vs `CC-2001B...`): el modelo usa `document` único global, lo que
  también sirve para verificar que el dato maestro no se filtra entre tenants.
- 1 riesgo y 1 capacitación de relleno por empresa (para que el 404 de aislamiento
  sea observable con datos reales).

## Paso 2 — Las cuatro pruebas de aislamiento (criterios de aceptación)

Abrir dos navegadores (o perfiles) con sesión paralela: A = `admin-a`, B = `admin-b`.

### P1 — Usuario A no puede consultar empleados de B → 404

1. Como A, copiar de la barra de direcciones / red del navegador el UUID de un
   empleado de A.
2. Como B, capturar el UUID de un empleado de B (red → `GET /employees`).
3. Como A, llamar `GET /api/v1/employees/{id-de-B}` con el token de A
   (desde la consola del navegador o REST client).
   - **Esperado:** `404`, sin datos de B en el body.
4. Variante de listado con filtro: `GET /api/v1/employees?companyId={id-de-B}`
   como A.
   - **Esperado:** `403` (el scope rechaza el companyId ajeno antes de consultar).

### P2 — Usuario A no puede consultar sedes de B → 404

1. Como A: `GET /api/v1/sites/{sede-de-B}`.
   - **Esperado:** `404`.
2. Como A: `PATCH /api/v1/sites/{sede-de-B}` con `{"name": "intruso"}`.
   - **Esperado:** `404` (la mutación no debe existir para el actor).

### P3 — Usuario A no puede modificar recursos de B → 404

1. Como A: `PATCH /api/v1/employees/{empleado-de-B}` con `{"position": "hacked"}`.
   - **Esperado:** `404`, y verificar en la UI de B que el empleado no cambió.
2. Como A: `DELETE /api/v1/trainings/{capacitacion-de-B}`.
   - **Esperado:** `404`; en B el registro sigue presente.

### P4 — companyId manipulado no evade el scope → 403/404

1. Como A: cualquier `POST` operativa (p. ej. `POST /api/v1/risks`) enviando
   `companyId: {id-de-B}` en el body.
   - **Esperado:** `403` (`resolveCompanyScope` rechaza el companyId del cliente).
2. Como A: `GET /api/v1/incidents?companyId={id-de-B}`.
   - **Esperado:** `403`.
3. Verificar en el módulo Auditoría de A que los intentos quedaron trazados
   (los 403/404 no crean registros, pero las acciones legítimas sí deben
   aparecer con actor correcto).

## Paso 3 — Evidencias a adjuntar al Issue #6

- [ ] Captura de las dos empresas creadas (listado de Empresas, sesión SUPER_ADMIN).
- [ ] Captura por cada prueba P1–P4 mostrando el status HTTP (Network tab) y la
      respuesta sin datos de la otra empresa.
- [ ] Salida de la suite automatizada:
      ```bash
      cd sgsst-api && npm run test:e2e -- multi-tenant-isolation
      ```
      Adjuntar el resumen de Jest como segundo nivel de evidencia.
- [ ] En `Issue #43`: marcar el checkbox correspondiente de S3.1 y enlazar este
      runbook + capturas.

## Criterios de aceptación (transcritos del Issue #6)

- [ ] Usuario A no puede consultar empleados B → 404.
- [ ] Usuario A no puede consultar sedes B → 404.
- [ ] Usuario A no puede modificar B → 404.
- [ ] companyId manipulado no evade scope → 403/404.

## Limpieza

Las empresas demo pueden desactivarse (no borrarse) desde la UI al terminar, o
conservarse como datos semilla del entorno dev. Si se usó base de datos efímera,
`docker compose down -v` es suficiente.
