# Despliegue por ambientes

El repositorio publica imagenes inmutables en GitHub Container Registry (GHCR). El proveedor cloud debe desplegar la misma etiqueta SHA para API y worker; el worker usa la imagen de API con el comando `node dist/src/worker.js`.

## Ambientes de GitHub

Crear los ambientes `staging` y `production` en GitHub. Configurar aprobacion obligatoria para `production` y limitarlo a la rama `main`.

Cada ambiente requiere estos secretos:

- `DATABASE_URL`: conexion de PostgreSQL del ambiente. Nunca debe apuntar a `localhost`.
- `VITE_API_URL`: URL publica base de la API usada al compilar el frontend, por ejemplo `https://api.staging.example.com/api/v1`.
- `API_BASE_URL`: URL publica de la API sin `/api/v1`, usada por el smoke test, por ejemplo `https://api.staging.example.com`.
- `METRICS_TOKEN`: token de scraping configurado en la API.

Para migrar por tunel SSH (Postgres sin exposicion publica, publicado solo en `127.0.0.1` de la VM), definir ademas la **variable** del ambiente `MIGRATE_VIA_SSH=ssh-tunnel` y los secretos `STAGING_SSH_HOST`, `STAGING_SSH_USER`, `STAGING_SSH_KEY` (opcionales: `STAGING_SSH_PORT` con defecto 22 y `STAGING_PG_TUNNEL_PORT` con defecto 5432). En el ambiente `production` los mismos secretos llevan el prefijo `PRODUCTION_`.

El proveedor de despliegue tambien debe configurar las variables de ejecucion de API y worker documentadas en `docs/operacion-produccion.md`, incluyendo `JWT_SECRET`, `METRICS_TOKEN`, `DATABASE_URL`, `REDIS_URL` y `CORS_ORIGINS`.

## Release controlado

1. Confirmar que CI esta verde en el commit de `main` que se va a liberar.
2. Ejecutar manualmente **Release artifacts and migrate** para `staging`. El input `migrate_mode` decide como el job `migrate` alcanza la base:
   - `auto` (defecto): lo decide la variable `MIGRATE_VIA_SSH` del ambiente (`ssh-tunnel` o conexion directa).
   - `direct`: fuerza conexion directa a `DATABASE_URL` (Postgres gestionado).
   - `ssh-tunnel`: fuerza el tunel SSH hacia la VM (exige los secretos `*_SSH_*`).
   - `disabled`: omite migraciones (primer release sin base configurada todavia).
3. El workflow publica `ghcr.io/<owner>/sgsst-api:sha-<commit>` y `ghcr.io/<owner>/sgsst-web:sha-<commit>`, y ejecuta `prisma migrate deploy` solo contra la base del ambiente seleccionado.
4. Configurar el proveedor cloud para desplegar esa etiqueta SHA en API, worker y web. No usar etiquetas `latest` como referencia de despliegue.
5. Ejecutar **Post-deploy smoke test** para comprobar `/health`, `/ready` y `/metrics` protegido.
6. Repetir el flujo para `production`; la aprobacion del ambiente debe ocurrir antes de exponer secretos o ejecutar migraciones.

## Compose de referencia para el servidor del ambiente

`docker-compose.prod.yml` (raiz del repo) es el compose de referencia que consume las imagenes publicadas en GHCR fijadas por etiqueta SHA, sin `build:`. Incluye API, worker (misma imagen de API con comando `node dist/src/worker.js`), web, PostgreSQL y Redis, con los healthchecks del compose local.

Guia paso a paso para levantar la pila en un servidor cloud (GHCR login, `.env` de referencia, TLS con reverse proxy, verificacion y checklist): `docs/despliegue-cloud.md`.

Requisitos en el servidor:

1. Copiar `docker-compose.prod.yml` y crear un `.env` junto a el. Variables obligatorias (el compose falla si faltan): `GHCR_OWNER`, `IMAGE_TAG` (formato `sha-<commit>`), `POSTGRES_PASSWORD`, `JWT_SECRET`, `METRICS_TOKEN`, `CORS_ORIGINS`, `PUBLIC_BASE_URL` y `WEB_BASE_URL`. `VITE_API_URL` ya viene compilada dentro de la imagen web y no se configura en runtime.
2. Autenticarse contra GHCR con un PAT con permiso `read:packages`.
3. `docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d`.
4. Las migraciones NO las ejecuta el compose: las aplica el job `migrate` del workflow de release contra la base del ambiente. Mantener ese orden: migrar primero, desplegar despues.

## Promocion entre ambientes

- **staging -> production**: ejecutar el workflow de release dos veces (una por ambiente). Cada ejecucion publica una etiqueta `sha-<commit>` inmutable. La "promocion" consiste en desplegar EN PRODUCCION la MISMA etiqueta `sha-<commit>` ya validada en staging, nunca reconstruir desde otra rama o commit.
- Verificar que la etiqueta desplegada coincide con `git rev-parse HEAD` del commit liberado: `docker inspect ghcr.io/<owner>/sgsst-api:sha-<commit>`.
- `latest` nunca se usa como referencia de despliegue.

## Reversion

1. Identificar la ultima etiqueta `sha-<commit>` sana (registro de despliegues del ambiente o `docker compose -f docker-compose.prod.yml images`).
2. Cambiar `IMAGE_TAG` en el `.env` del servidor a esa etiqueta y ejecutar `docker compose -f docker-compose.prod.yml up -d`. API, worker y web deben SIEMPRE rodar juntas la misma etiqueta.
3. `VITE_API_URL` esta compilada en la imagen web: si la URL de la API cambio entre versiones, la web se re-despliega con su etiqueta anterior correspondiente (misma pareja de etiquetas del release original).
4. Las migraciones Prisma no se revierten automaticamente: cualquier cambio de esquema debe seguir una estrategia compatible hacia atras (expand/contract) y contar con plan de restauracion probado (`docs/backups-postgresql.md`).

Revertir API, worker y web a la etiqueta SHA anterior conocida como sana. Las migraciones Prisma no se revierten automaticamente: cualquier cambio de esquema debe seguir una estrategia compatible hacia atras y contar con plan de restauracion probado.
