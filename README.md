# SG-SST ERP

SaaS empresarial para gestion SG-SST multiempresa. El proyecto esta organizado como un monolito modular con frontend React, backend NestJS, PostgreSQL y despliegue local con Docker Compose.

## Componentes

- `sgsst-web`: frontend React/Vite con MUI, login, sidebar, dashboard y CRUD operativo.
- `sgsst-api`: API REST NestJS con JWT, roles, alcance multiempresa, Prisma, Swagger y auditoria.
- `docs`: arquitectura, modelo de datos y documentacion funcional.
- `docker-compose.yml`: entorno local con PostgreSQL, API y web.

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
- `docs/schema-sgsst-postgresql.sql`
- `docs/backend-sgsst-nestjs.md`

## Roadmap tecnico inmediato

1. Cambiar el driver local de documentos por S3, Azure Blob o GCS.
2. MFA para roles criticos.
3. Redis para rate limit distribuido y cache de dashboard.
4. MFA para roles criticos.
5. CI/CD con pruebas, build, migraciones y despliegue por ambiente.
