# Convivencia de stacks dev y prod en la misma maquina

Guia para cuando el entorno de desarrollo (`docker compose`, contenedores `sgsst_*`) y el stack de produccion local (contenedores `sgsst_prod_*`) corren simultaneamente en el mismo host. Cada stack reserva puertos propios del host para no chocar; los valores reales viven en `.env` (no versionado).

## Mapa de puertos

| Stack | API | Web | Postgres host |
|---|---|---|---|
| Compose dev (`sgsst_*`) | `API_PORT` (p. ej. 3002) | `WEB_PORT` (5176) | 5433 |
| Prod (`sgsst_prod_*`) | 3001 | 8080 | interno (sin publicar) |

Referencia: `docker-compose.yml` (servicios `api`, `web`, `postgres`), `deploy/` para prod.

## Reglas operativas

### 3001 es de prod

El compose dev no debe publicar su API en 3001 cuando el stack de prod corre en el host. `API_PORT` en `.env` gobierna el puerto dev: compose inyecta `PORT=${API_PORT}` al contenedor y el healthcheck usa `process.env.PORT`, por lo que el cambio de puerto es consistente de extremo a extremo.

### `VITE_API_URL` se hornea en build

La web de compose llama a la API cuyo `VITE_API_URL` estaba seteado al construir la imagen (el frontend es estatico detras de nginx). Si cambias `API_PORT`, reconstruir:

```bash
docker compose build web
docker compose up -d web --no-deps --force-recreate
```

`--no-deps --force-recreate` recrea solo la web sin arrastrar `api` (que podria chocar con prod si `API_PORT` no se aplico todavia).

Sintoma de URL vieja horneada: la web carga pero el login falla con error de red/CORS hacia el puerto anterior. Verificar dentro del bundle:

```bash
docker exec sgsst_web sh -c "grep -rho 'http://localhost:[0-9]*/api/v1' /usr/share/nginx/html/assets 2>/dev/null | sort -u"
```

### CORS debe incluir el origen dev real

`CORS_ORIGINS` en `.env` debe contener la URL exacta de la web dev (p. ej. `http://localhost:5176,http://127.0.0.1:5176`), o el navegador bloqueara las llamadas. Verificacion del preflight:

```bash
curl -s -D - -o /dev/null -X OPTIONS \
  -H 'Origin: http://localhost:5176' \
  -H 'Access-Control-Request-Method: POST' \
  http://localhost:${API_PORT}/api/v1/auth/login | grep -i access-control
```

### Reinicios y perdida de red en el compose dev

Sintoma conocido: tras `docker stop sgsst_api` + `docker compose up -d api` (o un restart del daemon), la API arranca pero no resuelve `postgres`/`redis` por DNS (`getaddrinfo EAI_AGAIN`) y el healthcheck entra en loop. Diagnostico:

```bash
docker inspect sgsst_api --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
# vacio = el contenedor quedo fuera de sg-sst-erp_default, mientras que:
docker inspect sgsst_postgres --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
# sg-sst-erp_default
```

Recuperacion (los volumenes y datos se conservan; `down` no los borra):

```bash
docker compose down
docker compose up -d
```

El entrypoint de la API reintenta `prisma migrate deploy` en bucle hasta que la red vuelve, por lo que tras recrear la red el stack converge solo. Evitar mezclar `docker start` de contenedores individuales con `compose up` en este host: recrear siempre el proyecto completo con `down` + `up`.

### Levantar o detener un stack sin afectar al otro

- Detener la web dev sin tocar la API dev: `docker compose stop web` / `docker start sgsst_web` (este ultimo no arranca dependencias).
- Detener prod completo: `docker stop sgsst_prod_worker sgsst_prod_web sgsst_prod_api sgsst_prod_postgres sgsst_prod_redis`.
- Nunca usar `docker compose down` en el directorio del compose de prod salvo intencion explicita: recrea contenedores de prod.

## Verificacion rapida de ambos stacks

```bash
bash scripts/check-env-health.sh
```

Salida esperada: `OK` para API/web dev (3002/5176 por defecto) y API/web prod (3001/8080). Codigo de salida 1 si algun endpoint no responde. Los puertos se pueden pasar como argumentos para otros entornos.
