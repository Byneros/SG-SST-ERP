# SG-SST ERP

SaaS empresarial para gestion SG-SST multiempresa. El proyecto esta organizado como un monolito modular con frontend React, backend NestJS, PostgreSQL y despliegue local con Docker Compose.

## Componentes

- `sgsst-web`: frontend React/Vite con MUI, login, sidebar, dashboard y CRUD operativo.
- `sgsst-api`: API REST NestJS con JWT, roles, alcance multiempresa, Prisma, Swagger y auditoria.
- `docs`: arquitectura, modelo de datos y documentacion funcional.
- `docker-compose.yml`: entorno local con PostgreSQL, API y web.
- `worker`: proceso separado para jobs de notificaciones con Redis/BullMQ.

## Inicio rapido

1. Crear variables locales desde los ejemplos:

```bash
cp .env.example .env
cp sgsst-api/.env.example sgsst-api/.env
cp sgsst-web/.env.example sgsst-web/.env
```

Antes de iniciar, reemplazar `JWT_SECRET` en `.env` por un secreto unico de al menos 32 caracteres. La API rechaza el valor de ejemplo cuando se ejecuta en produccion.

2. Levantar el entorno:

```bash
docker compose up --build
```

3. Abrir:

- Web: `http://localhost:5176`
- API: `http://localhost:3001/api/v1`
- Health: `http://localhost:3001/api/v1/health`
- Ready: `http://localhost:3001/api/v1/ready`
- Swagger: `http://localhost:3001/docs`
- Los documentos y exportaciones requieren autenticacion y autorizacion en la API.
- Redis: `localhost:6379`

## Convivencia de stacks en la misma maquina (dev y prod)

Cuando el compose dev (`sgsst_*`) y el stack de prod local (`sgsst_prod_*`) corren a la vez, cada stack usa puertos propios del host (dev: `API_PORT`/`WEB_PORT` en `.env`; prod: 3001/8080). Ver `docs/convivencia-dev-prod-local.md` para el mapa de puertos, la reconstruccion de la web al cambiar `API_PORT` (`VITE_API_URL` se hornea en build) y la recuperacion si la API del compose pierde la red al reiniciar.

Verificacion rapida de ambos stacks: `bash scripts/check-env-health.sh`.

## Verificacion local sin Docker

```bash
cd sgsst-api
npx prisma generate
npx prisma migrate status
npm run test
npm run test:e2e
npm run build
```

```bash
cd sgsst-web
npm run build
```

En PowerShell puede ser necesario usar `npm.cmd` por la politica de ejecucion local.

## Arquitectura

La arquitectura SaaS aplicada esta documentada en:

- `docs/arquitectura-sgsst.md`
- `docs/adr-estrategia-borrado.md`
- `docs/convivencia-dev-prod-local.md`
- `docs/backups-postgresql.md`
- `docs/operacion-produccion.md`
- `docs/despliegue-cloud.md`
- `docs/despliegue-por-ambientes.md`
- `docs/correo-transaccional.md`
- `docs/fase-2-inventario-modulos-sgsst.md`
- `docs/reportes-exportaciones.md`
- `docs/storage-externo.md`
- `docs/whatsapp-alertas.md`
- `docs/schema-sgsst-postgresql.sql`
- `docs/backend-sgsst-nestjs.md`
- `docs/permisos-rol-employee.md`
- `docs/sso-mapeo-grupos.md`
- `docs/despliegue-preparacion.md`

## Roadmap tecnico inmediato

1. Configurar el proveedor cloud para desplegar `docker-compose.prod.yml` con las imagenes GHCR por etiqueta SHA (ver `docs/despliegue-por-ambientes.md`). Estado de la preparacion y decisiones pendientes: `docs/despliegue-preparacion.md`.
2. SSO SAML para clientes empresariales (implementado: `docs/plan-fase-9-plataforma.md`, seccion 9.4; guia de administracion en `docs/sso-mapeo-grupos.md`).
3. Overrides de rol por grupo del IdP: implementado (`roleGroups` en SsoProvider; ver `docs/plan-fase-9-plataforma.md`, seccion 9.4). e2e de aislamiento SSO en el harness multi-tenant: implementado (`test/sso-multi-tenant.e2e-spec.ts`).
4. Hardening de observabilidad: alertas de backup ya viajan por email (`BACKUP_ALERT_EMAIL_*`) y restore check mensual automatico (`BACKUP_RESTORE_CHECK_DAYS`).
