# Despliegue por ambientes

El repositorio publica imagenes inmutables en GitHub Container Registry (GHCR). El proveedor cloud debe desplegar la misma etiqueta SHA para API y worker; el worker usa la imagen de API con el comando `node dist/src/worker.js`.

## Ambientes de GitHub

Crear los ambientes `staging` y `production` en GitHub. Configurar aprobacion obligatoria para `production` y limitarlo a la rama `main`.

Cada ambiente requiere estos secretos:

- `DATABASE_URL`: conexion de PostgreSQL del ambiente. Nunca debe apuntar a `localhost`.
- `VITE_API_URL`: URL publica base de la API usada al compilar el frontend, por ejemplo `https://api.staging.example.com/api/v1`.
- `API_BASE_URL`: URL publica de la API sin `/api/v1`, usada por el smoke test, por ejemplo `https://api.staging.example.com`.
- `METRICS_TOKEN`: token de scraping configurado en la API.

El proveedor de despliegue tambien debe configurar las variables de ejecucion de API y worker documentadas en `docs/operacion-produccion.md`, incluyendo `JWT_SECRET`, `METRICS_TOKEN`, `DATABASE_URL`, `REDIS_URL` y `CORS_ORIGINS`.

## Release controlado

1. Confirmar que CI esta verde en el commit de `main` que se va a liberar.
2. Ejecutar manualmente **Release artifacts and migrate** para `staging`.
3. El workflow publica `ghcr.io/<owner>/sgsst-api:sha-<commit>` y `ghcr.io/<owner>/sgsst-web:sha-<commit>`, y ejecuta `prisma migrate deploy` solo contra la base del ambiente seleccionado.
4. Configurar el proveedor cloud para desplegar esa etiqueta SHA en API, worker y web. No usar etiquetas `latest` como referencia de despliegue.
5. Ejecutar **Post-deploy smoke test** para comprobar `/health`, `/ready` y `/metrics` protegido.
6. Repetir el flujo para `production`; la aprobacion del ambiente debe ocurrir antes de exponer secretos o ejecutar migraciones.

## Reversion

Revertir API, worker y web a la etiqueta SHA anterior conocida como sana. Las migraciones Prisma no se revierten automaticamente: cualquier cambio de esquema debe seguir una estrategia compatible hacia atras y contar con plan de restauracion probado.
