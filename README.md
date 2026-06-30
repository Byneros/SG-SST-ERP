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

2. Levantar el entorno:

```bash
docker compose up --build
```

3. Abrir:

- Web: `http://localhost:5173`
- API: `http://localhost:3001/api/v1`
- Health: `http://localhost:3001/api/v1/health`
- Swagger: `http://localhost:3001/docs`
- Archivos subidos: `http://localhost:3001/uploads`
- Redis: `localhost:6379`

## Verificacion local sin Docker

```bash
cd sgsst-api
npx prisma generate
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
- `docs/backups-postgresql.md`
- `docs/correo-transaccional.md`
- `docs/fase-2-inventario-modulos-sgsst.md`
- `docs/reportes-exportaciones.md`
- `docs/storage-externo.md`
- `docs/whatsapp-alertas.md`
- `docs/schema-sgsst-postgresql.sql`
- `docs/backend-sgsst-nestjs.md`

## Roadmap tecnico inmediato

1. Pipeline de despliegue por ambiente.
2. Sincronizacion externa de backups a bucket cifrado.
3. Observabilidad con logs estructurados y metricas.
4. SSO OIDC/SAML para clientes empresariales.
5. Consola administrativa para consultar entregas externas y reintentar casos puntuales.
