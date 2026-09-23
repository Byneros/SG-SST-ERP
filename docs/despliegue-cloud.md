# Despliegue en el proveedor cloud con docker-compose.prod.yml

Guia operativa para levantar SG-SST ERP en un servidor cloud (VM con Docker:
EC2, Lightsail, Compute Engine, DigitalOcean Droplet, Hetzner, etc.) usando el
compose de referencia `docker-compose.prod.yml`, que consume las imagenes
inmutables publicadas en GHCR por `.github/workflows/release.yml`.

Responsabilidad de este compose: la **capa de aplicacion** (API, worker, web,
PostgreSQL, Redis y backup opcional). El TLS/HTTPS terminarlo un reverse proxy
delante (Caddy o Nginx) o el balanceador del proveedor.

## 1. Requisitos del servidor

- Ubuntu 22.04/24.04 (o cualquier Linux con Docker Engine 24+ y compose v2).
- 2 vCPU / 4 GB RAM minimo para la pila completa.
- Dominios apuntando al servidor, por ejemplo:
  - `app.example.com` -> web
  - `api.example.com` -> API
- Puertos abiertos: 80 y 443. **Los puertos de API y web del compose no deben
  exponerse a Internet directamente** (ver reverse proxy del paso 6).

La forma rapida de preparar un servidor nuevo es el bootstrap idempotente
`deploy/bootstrap-vm.sh`, que hace los pasos 1 (Docker), 6 (Caddy + Caddyfile
con hostnames) y el firewall en un solo comando:

```bash
sudo bash deploy/bootstrap-vm.sh
# con hostnames listos (deben resolver a la IP de la VM antes):
sudo SGSST_APP_HOST=app.example.com SGSST_API_HOST=api.example.com \
     bash deploy/bootstrap-vm.sh
# flags: --skip-caddy (balanceador gestionado) y --skip-firewall (ufw en el panel)
```

Si prefieres hacerlo a mano, los pasos manuales equivalentes son los que
siguen.

```bash
curl -fsSL https://get.docker.com | sh
docker compose version   # v2.x
```

## 2. Publicar las imagenes (desde tu maquina, no del servidor)

1. Confirmar CI verde en el commit a liberar de `main`.
2. En GitHub: **Actions -> Release artifacts and migrate -> Run workflow** con
   `target: staging` (despues `production`, con su aprobacion). El input
   `migrate_mode` (defecto `auto`) controla como el job `migrate` alcanza la
   base: `auto` respeta `MIGRATE_VIA_SSH` del ambiente, `direct` fuerza
   conexion directa, `ssh-tunnel` fuerza el tunel SSH (exige `*_SSH_*`) y
   `disabled` omite migraciones (primer release sin base aun).
3. El workflow genera:
   - `ghcr.io/<owner>/sgsst-api:sha-<commit>`
   - `ghcr.io/<owner>/sgsst-web:sha-<commit>`
   - y ejecuta `prisma migrate deploy` contra la base del ambiente.

Tomar nota del SHA: `git rev-parse HEAD` del commit liberado. Esa etiqueta
`sha-<commit>` es la que se fija en el servidor.

## 3. Autenticarse contra GHCR en el servidor

Crear un PAT de GitHub con permiso `read:packages` y en el servidor:

```bash
echo "<PAT>" | docker login ghcr.io -u <usuario-github> --password-stdin
```

## 4. Archivos y variables en el servidor

```bash
mkdir -p /opt/sgsst && cd /opt/sgsst
# copiar docker-compose.prod.yml (scp o git clone del repo)
```

Crear `/opt/sgsst/.env` (el compose falla si falta una obligatoria):

```env
# --- Imagenes (obligatorias) ---
GHCR_OWNER=byneros                 # dueno del repo en GitHub
IMAGE_TAG=sha-<commit>             # etiqueta inmutable del release

# --- Base de datos (obligatoria) ---
POSTGRES_PASSWORD=<secreto-largo>
POSTGRES_DB=sgsst

# --- Seguridad (obligatorias) ---
JWT_SECRET=<secreto-largo-min-32>
METRICS_TOKEN=<secreto-largo-min-32>

# --- URLs (obligatorias) ---
CORS_ORIGINS=https://app.example.com
PUBLIC_BASE_URL=https://api.example.com
WEB_BASE_URL=https://app.example.com

# --- Opcionales con valor por defecto sano ---
# API y web publican SOLO en 127.0.0.1 (bind loopback); Caddy delante es la
# unica puerta 80/443. Sobrescribir API_HOST_PORT/WEB_HOST_PORT solo si el
# proveedor usa un balanceador privado que necesite otro bind.
API_HOST_PORT=127.0.0.1
WEB_HOST_PORT=127.0.0.1
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d
REDIS_URL=redis://redis:6379
DOCUMENT_STORAGE_DRIVER=local

# --- Backup cifrado (perfil backup, recomendado en produccion) ---
BACKUP_ENCRYPTION_PUBLIC_KEY=age1...
BACKUP_ALERT_EMAIL_ENABLED=true
BACKUP_ALERT_EMAIL_TO=sst@example.com
BACKUP_RESTORE_CHECK_DAYS=30
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=usuario
SMTP_PASSWORD=<clave>
SMTP_FROM="SG-SST ERP <notificaciones@example.com>"
BACKUP_S3_ENDPOINT=                # vacio = backup solo local
BACKUP_S3_BUCKET=
BACKUP_S3_ACCESS_KEY_ID=
BACKUP_S3_SECRET_ACCESS_KEY=
```

Notas:

- El job `migrate` del workflow aplica las migraciones desde GitHub Actions.
  Por defecto espera un `DATABASE_URL` directo (Postgres gestionado); si la
  base vive en la VM, publicar postgres solo en `127.0.0.1:5432` (default del
  compose) y activar en el ambiente GitHub `MIGRATE_VIA_SSH=ssh-tunnel` con
  los secretos `STAGING_SSH_HOST/USER/KEY` (y opcionales `STAGING_SSH_PORT`,
  `STAGING_PG_TUNNEL_PORT`): el job abre `ssh -L 15432:127.0.0.1:5432` y
  migra por el túnel. Ver `docs/despliegue-preparacion.md` §checklist.
- `VITE_API_URL` **no** se configura en runtime: ya viene compilada dentro de
  la imagen web (build-arg del workflow). Cambiarla implica publicar otro
  release.
- `WEB_BASE_URL` es a donde el callback SSO redirige al navegador; debe ser la
  URL publica de la web. `PUBLIC_BASE_URL` es la de la API (redirect_uri que
  ve el IdP).
- Si se configuro SSO con un IdP externo, agregar la URL de callback
  `https://api.example.com/api/v1/auth/sso/callback` en la consola del IdP.

## 5. Levantar la pila

```bash
cd /opt/sgsst
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

Orden garantizado por healthchecks: postgres/redis -> API -> worker/web. Las
migraciones NO corre este compose: ya las aplico el job `migrate` del workflow
(migrar primero, desplegar despues).

## 6. TLS con reverse proxy (Caddy, recomendado)

Opcion A: Caddy en el host o como servicio extra, con `Caddyfile` de referencia
en `deploy/caddy/Caddyfile` (apunta a `127.0.0.1:8080` web y `127.0.0.1:3001` API):

```caddyfile
app.example.com {
    reverse_proxy 127.0.0.1:8080
}
api.example.com {
    reverse_proxy 127.0.0.1:3001
}
```

```bash
sudo apt install -y caddy   # o el binario oficial; emite y renueva certificados solo
```

Opcion B: balanceador gestionado del proveedor (ALB, Cloud Load Balancer) con
certificado administrado; apuntar los targets a `WEB_PORT` y `API_PORT`
publicados solo en la red privada o via `127.0.0.1` con SSH tunnel.

Verificar que el firewall (security group) NO exponga 3001/8080
directamente: todo debe entrar por 80/443 del proxy.

## 7. Verificacion post-despliegue

```bash
# Salud local del servidor
curl -fsS https://api.example.com/api/v1/health
curl -fsS https://api.example.com/api/v1/ready
curl -fsS -H "X-Metrics-Token: $METRICS_TOKEN" https://api.example.com/api/v1/metrics | head
curl -fsSI https://app.example.com/
```

Ejecutar ademas en GitHub: **Actions -> Post-deploy smoke test** con el target
correspondiente (usa los secretos `API_BASE_URL` y `METRICS_TOKEN` del
ambiente). Primer login funcional: crear/verificar el usuario admin y un flujo
autenticado de lectura.

## 8. Backup cifrado (recomendado)

```bash
# clave age: la publica al servidor, la privada al gestor de secretos (NUNCA al servidor)
docker compose -f docker-compose.prod.yml --profile backup run --rm --entrypoint sh postgres-backup \
  -c "age-keygen -o /backups/key.txt && age-keygen -y /backups/key.txt"
# configurar BACKUP_ENCRYPTION_PUBLIC_KEY en .env y luego:
docker compose -f docker-compose.prod.yml --profile backup up -d postgres-backup
```

Procedimiento completo, alertas por email y prueba de restauracion automatica:
`docs/backups-postgresql.md`.

## 9. Operacion diaria

| Tarea | Comando |
|---|---|
| Estado | `docker compose -f docker-compose.prod.yml ps` |
| Logs | `docker compose -f docker-compose.prod.yml logs -f api` |
| Nueva version | actualizar `IMAGE_TAG` en `.env` -> `pull` -> `up -d` |
| Rollback | fijar `IMAGE_TAG` anterior -> `up -d` (API/worker/web misma etiqueta) |
| Migraciones | solo via workflow de release, nunca manual en el servidor |

Monitoreo: scraper de `/api/v1/metrics` con `METRICS_TOKEN` y alertas para
`ready=503`, reinicios frecuentes y 5xx (ver `docs/operacion-produccion.md`).

## 10. Checklist de puesta en marcha

- [ ] CI verde en el commit liberado y workflow de release ejecutado.
- [ ] `IMAGE_TAG` = `sha-<commit>` en el `.env` del servidor (nunca `latest`).
- [ ] `docker login ghcr.io` con PAT `read:packages`.
- [ ] `.env` con todas las obligatorias y secretos desde gestor, no versionados.
- [ ] Pila arriba y healthchecks en `healthy`.
- [ ] TLS activo en app y API via Caddy/balanceador; 3001/8080 no expuestos.
- [ ] Smoke test de GitHub en verde + primer login funcional.
- [ ] Backup con age activado y alerta de email probada.
- [ ] URL de callback SSO registrada en el IdP (si aplica).
