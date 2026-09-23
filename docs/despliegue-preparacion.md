# Preparación del despliegue cloud (paso 0 del release)

Estado de la preparación para ejecutar el punto 1 del roadmap: desplegar
`docker-compose.prod.yml` con las imágenes GHCR por etiqueta SHA. Las guías
operativas completas están en `docs/despliegue-cloud.md` y
`docs/despliegue-por-ambientes.md`; este documento solo lista lo que falta
decidir/configurar antes de tocar un servidor.

Última revisión: 2026-09-23 (commit `1128f91`).

## Lo que ya está listo (verificado)

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

1. [ ] Crear VM del proveedor elegido, instalar Docker (`curl -fsSL https://get.docker.com | sh`).
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

- `DATABASE_URL` del workflow (`prisma migrate deploy`) debe alcanzar la base
  del ambiente desde GitHub Actions: si la VM no expone PostgreSQL, pensar en
  un túnel (SSH action/Tailscale) o un PostgreSQL gestionado del proveedor.
- `VITE_API_URL` se fija al compilar: definir el dominio/IP **antes** del
  primer release para no re-publicar.
- Sin dominio, `PUBLIC_BASE_URL`/`WEB_BASE_URL`/`CORS_ORIGINS` usarán la IP o
  el DNS dinámico elegido; cambiarlos luego solo toca el `.env` del servidor.
