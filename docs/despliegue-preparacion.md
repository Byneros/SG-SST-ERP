# Preparación del despliegue cloud (paso 0 del release)

Estado de la preparación para ejecutar el punto 1 del roadmap: desplegar
`docker-compose.prod.yml` con las imágenes GHCR por etiqueta SHA. Las guías
operativas completas están en `docs/despliegue-cloud.md` y
`docs/despliegue-por-ambientes.md`; este documento solo lista lo que falta
decidir/configurar antes de tocar un servidor.

Última revisión: 2026-09-23 (commit `1128f91`).

## Lo que ya está listo (verificado)

- [x] `deploy/staging.env.example`: `.env` de referencia para staging con todos
      los secretos/URLs como placeholders y los binds loopback por defecto.
- [x] `deploy/caddy/Caddyfile`: TLS de referencia (api. + app. del host de
      staging, reenvía a los binds loopback del compose).
- [x] `deploy/bootstrap-vm.sh`: bootstrap idempotente de la VM (Docker +
      compose v2, Caddy, ufw con solo 22/80/443, `/opt/sgsst` con compose y
      `.env` de referencia; instala el Caddyfile si se pasan los hostnames via
      `SGSST_APP_HOST`/`SGSST_API_HOST`).
- [x] `docker-compose.prod.yml`: API y web ahora publican SOLO en
      `127.0.0.1` (defaults `API_HOST_PORT`/`WEB_HOST_PORT`), validado con
      `docker compose config`; Postgres sigue sin exponer puertos al host.

- [x] `.github/workflows/release.yml`: publica `sgsst-api` y `sgsst-web` a GHCR
      con tags `sha-<commit>` + `{staging|production}-latest`, valida
      `VITE_API_URL` y aplica migraciones con job separado (`migrate`).
- [x] `docker-compose.prod.yml` validado con `docker compose config` usando
      las variables obligatorias (`GHCR_OWNER=Byneros`, `IMAGE_TAG=sha-<commit>`,
      `POSTGRES_PASSWORD`, `JWT_SECRET`, `METRICS_TOKEN`, `CORS_ORIGINS`,
      `PUBLIC_BASE_URL`, `WEB_BASE_URL`).
- [x] Documentación de promoción/rollback por etiqueta SHA y de puesta en
      marcha del servidor (TLS con Caddy, backup cifrado, smoke tests).
- [x] CI del repo (build + tests API/web) en verde; repo privado en
      `github.com/Byneros/SG-SST-ERP`.

## Decisiones pendientes

0. **Creación de la VM**: aplazada (decisión 2026-09-23). Los archivos de
   deploy ya están preparados (`deploy/staging.env.example`,
   `deploy/caddy/Caddyfile`, `deploy/bootstrap-vm.sh`); crear la VM es el
   único paso manual restante cuando se disponga de cuenta/proveedor, y el
   bootstrap deja el servidor listo en un solo comando.
1. **Proveedor cloud** (VM 2 vCPU / 4 GB RAM con Docker 24+, Ubuntu 22.04/24.04).
   El catálogo evaluado no aporta IaaS para esta pila (PostgreSQL + Redis +
   worker de larga ejecución descartan serverless): se recomienda una VM
   sencilla y barata. Opciones comparadas:

   | Proveedor | Tamaño aprox. | Costo mensual aprox. | Notas |
   |---|---|---|---|
   | Hetzner Cloud | 2 vCPU / 4 GB | ~USD 6–8 | Mejor precio; regiones EU/US |
   | DigitalOcean Droplet | 2 vCPU / 4 GB | ~USD 24 | Muy documentado; regiones US/EU/SA |
   | AWS Lightsail | 2 vCPU / 4 GB | ~USD 24 | Si ya existe cuenta AWS; VPC/IAM extra |
   | GCP Compute Engine (e2-medium) | 2 vCPU / 4 GB | ~USD 25–30 | Útil si ya hay proyecto GCP |

2. **Dominio y TLS**: sin dominio por ahora. Opciones cuando se requiera HTTPS:
   registrar uno propio, o usar `sslip.io`/`nip.io` contra la IP pública
   (`app.<ip>.sslip.io`) con certificados Let's Encrypt vía Caddy igualmente.

## Checklist antes de lanzar el primer release (staging)

1. [ ] Crear VM del proveedor elegido y ejecutar el bootstrap:
      `sudo bash deploy/bootstrap-vm.sh` (instala Docker + Caddy, cierra el
      firewall a 22/80/443 y prepara `/opt/sgsst`; alternativa manual:
      `curl -fsSL https://get.docker.com | sh`).
2. [ ] Crear los **ambientes GitHub** `staging` y `production`
      (Settings → Environments): aprobación obligatoria y rama `main` solo para
      `production`.
3. [ ] Configurar secretos del ambiente `staging`:
   - `DATABASE_URL`: PostgreSQL del ambiente (jamás `localhost`; el workflow lo
     rechaza). Puede ser la del contenedor expuesta por túnel/VPN o un
     PostgreSQL gestionado.
   - `VITE_API_URL`: p. ej. `https://api.<host>/api/v1` (queda compilada dentro
     de la imagen web; cambiarla implica re-publicar el release).
   - `API_BASE_URL`: `https://api.<host>` (sin `/api/v1`), para el smoke test.
   - `METRICS_TOKEN`: igual al que se configure en la API del ambiente.
   - Para migrar por **túnel SSH** (Postgres sin exposición pública): variable
     del ambiente `MIGRATE_VIA_SSH=ssh-tunnel` y secretos `STAGING_SSH_HOST`,
     `STAGING_SSH_USER`, `STAGING_SSH_KEY` (PEM completo de una clave de
     despliegue con `ForceCommand` no necesario; recomendado usuario restringido
     solo a reenvío de puertos), opcionales `STAGING_SSH_PORT` (22) y
     `STAGING_PG_TUNNEL_PORT` (5432). Sin esa variable, el job `migrate`
     conecta directo a `DATABASE_URL` (Postgres gestionado).
   - La URL `DATABASE_URL` sigue sin poder decir `localhost` (se rechaza), pero
     con túnel el host real puede ser el de la VM: el job reescribe host/puerto
     a `127.0.0.1:15432` dentro del runner tras abrir el túnel.
4. [ ] Preparar el `.env` del servidor con las variables de
      `docs/despliegue-cloud.md` §4 (`JWT_SECRET`, `METRICS_TOKEN`,
      `CORS_ORIGINS`, `PUBLIC_BASE_URL`, `WEB_BASE_URL`, `POSTGRES_PASSWORD`,
      además de `GHCR_OWNER=Byneros` y `IMAGE_TAG`).
5. [ ] PAT de GitHub con `read:packages` para `docker login ghcr.io` en el servidor.
6. [ ] Ejecutar **Actions → Release artifacts and migrate → Run workflow**
      con `target: staging` y anotar el `sha-<commit>` publicado.
7. [ ] En el servidor: `docker compose -f docker-compose.prod.yml pull && up -d`
      y verificar `/health`, `/ready` y el smoke test de GitHub.

## Riesgos abiertos

- ~~`DATABASE_URL` del workflow debe alcanzar la base del ambiente desde
  GitHub Actions~~ **Resuelto (2026-09-23)**: el job `migrate` soporta túnel
  SSH nativo (`MIGRATE_VIA_SSH=ssh-tunnel` + secretos `STAGING_SSH_*`) hacia
  el PostgreSQL que el compose publica en `127.0.0.1:5432` de la VM, o
  conexión directa a un Postgres gestionado.
- `VITE_API_URL` se fija al compilar: definir el dominio/IP **antes** del
  primer release para no re-publicar.
- Sin dominio, `PUBLIC_BASE_URL`/`WEB_BASE_URL`/`CORS_ORIGINS` usarán la IP o
  el DNS dinámico elegido; cambiarlos luego solo toca el `.env` del servidor.
