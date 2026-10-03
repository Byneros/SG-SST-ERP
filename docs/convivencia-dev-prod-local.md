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

### Quien corre la API dev en 3002: una sola dueña a la vez

El puerto lo fija `API_PORT` en `.env` (3002) y solo puede haber un proceso escuchando. Dos formas validas, nunca simultaneas:

- **Contenedor** (`sgsst_api`): `docker start sgsst_api` / `docker compose up -d api`. Sin usar.
- **Host** (dev con recarga): `npm run start:dev` (watch) o `npm start` dentro de `sgsst-api/`.

Sintoma de doble dueño: `Error: listen EADDRINUSE :::3002` al arrancar. Diagnostico y liberacion:

```bash
netstat -ano | grep ":3002" | grep LISTENING   # ultima columna = PID
taskkill //PID <pid> //F //T                   # mata el proceso y sus hijos
```

Convencion de trabajo con el agente (Codebuff): **si el usuario corre la API en su terminal, el agente no arranca ni mata el proceso**; solo lo consume via HTTP para pruebas. Si el agente la levanta (watch o start) para verificar, avisa y la deja identificable, y la baja al terminar si el usuario va a arrancar la suya. El contenedor `sgsst_api` queda en estado `Created` mientras la API del host use el puerto.

### Variables separadas: `.env.prod` para el stack de prod

El `.env` raiz es compartido y contiene valores de **dev** que rompen un recreate de prod si se filtran al compose de prod (ocurrio el 2026-09-29: `API_PORT=3002` hizo que `sgsst_prod_api` escuchara en 3002 mientras el compose publicaba 3001->3001, y una `POSTGRES_PASSWORD` desfasada dejo el API en loop de `P1000`).

Solucion: overrides de prod en `.env.prod` (no versionado, cubierto por `**/.env.*`), fusionado sobre el `.env` base:

```bash
# Levantar/actualizar prod (los archivos se fusionan en orden; .env.prod gana):
docker compose --env-file .env --env-file .env.prod -f docker-compose.prod.yml -p sgsst_smoke up -d

# Validar la interpolacion sin levantar nada:
docker compose --env-file .env --env-file .env.prod -f docker-compose.prod.yml config --quiet
```

Contenido esperado de `.env.prod` (solo lo propio de prod o lo que difiere de dev):

- `GHCR_OWNER` y `IMAGE_TAG=sha-<commit>` (regla: siempre etiqueta inmutable, nunca `latest`).
- `API_PORT=3001` (anula el 3002 de dev; el compose lo usa para `PORT` del contenedor y su healthcheck).
- `WEB_BASE_URL` y `CORS_ORIGINS` de prod (`http://localhost:8080` en local; el `.env` base trae la lista de orígenes dev).

Reglas:

- `POSTGRES_PASSWORD` vive en el `.env` base y **debe coincidir** con la del volumen `postgres_data` de prod. Si se cambia en `.env`, alinear la BD primero (`ALTER USER postgres WITH PASSWORD '...'` desde `sgsst_prod_postgres`) o el API entrara en loop de `P1000` al recrear.
- `AI_*`, `VITE_API_URL`, `POSTGRES_HOST_PORT` y `WEB_PORT` son exclusivos de dev: no van en `.env.prod` (el compose de prod ni los consume).
- Tras cambiar `IMAGE_TAG` en `.env.prod`, API/worker/web deben rotar juntos (misma etiqueta; ver `docs/despliegue-por-ambientes.md`).

## Verificacion rapida de ambos stacks

```bash
bash scripts/check-env-health.sh
```

Salida esperada: `OK` para API/web dev (3002/5176 por defecto) y API/web prod (3001/8080). Codigo de salida 1 si algun endpoint no responde. Cada puerto acepta el valor especial `skip` para omitir ese endpoint (util en CI, donde no hay prod local):

```bash
bash scripts/check-env-health.sh 3002 5176 skip skip
```

### Conflicto de puerto 5433 con un servicio PostgreSQL de Windows

Sintoma: el stack dev (`sgsst_postgres`) esta healthy y la API conecta, pero
desde el host `prisma migrate deploy` (u otra herramienta TCP a
`localhost:5433`) falla con `P1000: Authentication failed`.

Causa: un PostgreSQL instalado como servicio de Windows (`postgres.exe`, fuera
de Docker) escucha en el mismo host-port. El bind del servicio gana sobre el
proxy de Docker en Windows: `localhost:5433` responde el servicio local, no el
contenedor. `netstat -aon | findstr :5433` muestra dos PIDs de escucha
(`com.docker.backend.exe` y `postgres.exe`).

Opciones de resolucion (elegir una; **aplicada en este host: la primera**,
con `POSTGRES_HOST_PORT=5434` en `.env` desde 2026-09-28):
- Mover el puerto publicado del compose a uno libre: `POSTGRES_HOST_PORT` en
  `.env` (parametrizado en `docker-compose.yml`, default 5433 para CI).
- Cambiar el puerto del servicio Windows (postgresql.conf -> `port`).
- Detener el servicio Windows mientras se usa el stack dev.

Mientras tanto, operar la BD del compose sin pasar por el host-port:

```bash
# Migraciones y psql contra la BD dev, sin depender del 5433 del host:
docker exec sgsst_api npx prisma migrate deploy
docker exec sgsst_postgres psql -U postgres -d sgsst
```

Nota: `sgsst-api/.env` apunta su `DATABASE_URL` al servicio Windows (o a una
credencial distinta); los comandos Prisma locales usan esa URL via
`prisma.config.ts` y pueden ignorar un override en la linea de comando.

## Autocuracion programada (Windows)

El stack dev se autocura cada 5 minutos mediante la tarea programada `SG-SST dev stack recovery`, que ejecuta `scripts/dev-stack-recover.cmd` (wrapper que invoca `dev-stack-recover.sh` via Git Bash). Si detecta contenedores del compose corriendo fuera de la red del proyecto, recrea el stack automaticamente.

Recrear la tarea (equipo nuevo o tras borrarla):

```bash
schtasks //Create //TN "SG-SST dev stack recovery" //TR "\"<ruta-absoluta>\scripts\dev-stack-recover.cmd\"" //SC MINUTE //MO 5 //F
```

Consultar o eliminar:

```bash
schtasks //Query //TN "SG-SST dev stack recovery" //FO LIST
schtasks //Delete //TN "SG-SST dev stack recovery" //F
```

Notas:
- La tarea corre en modo interactivo: solo actua con la sesion iniciada. Es aceptable porque Docker Desktop tambien requiere sesion activa en este host.
- Requiere `bash` (Git Bash) en el PATH.
- La ruta del wrapper es absoluta: si se mueve el repositorio, recrear la tarea.

## Verificacion en CI

El job `docker` del workflow (`.github/workflows/ci.yml`) valida los puertos del compose en cada PR: prepara `.env` desde el ejemplo con secretos CI, levanta el stack con `docker compose up -d --build --wait`, ejecuta `scripts/check-env-health.sh 3001 5176 skip skip` (prod se omite: no existe en el runner), verifica la integridad de red con `scripts/dev-stack-recover.sh` y baja el stack con `down -v` (`if: always()`).
