# AGENTS instructions for SG-SST ERP

## Purpose
This project is a modular SaaS ERP for SG-SST built with a React/Vite frontend and a NestJS backend. Use this file to help AI coding agents work effectively on the repo.

## Key areas
- `sgsst-api`: NestJS monolith with Prisma, JWT auth, RBAC, multi-company scope, Swagger and audit logging.
- `sgsst-web`: React + Vite + MUI frontend with login, dashboard, sidebar, CRUD modules and API integration.
- `docker-compose.yml`: local development environment with PostgreSQL, Redis, API, web and backup services.
- `docs/`: project architecture, backend conventions, database schema, backups, storage and email.

## When you are asked to make changes
- Prefer local conventions from `README.md` and `docs/*.md` rather than inventing new workflows.
- Keep frontend and backend responsibilities separated:
  - `sgsst-web` for UI, routes, pages, components and Vite config.
  - `sgsst-api` for controllers, services, DTOs, guards, Prisma models and routes under `/api/v1`.
- Respect multi-tenant scope: backend resources should be filtered by `companyId` and role guards must enforce access.
- Preserve existing module structure and naming patterns when adding new domain features.

## Local development commands
### Root
- `docker compose up --build` to run the full local stack.
- `docker compose config` to validate compose files.

### Backend (`sgsst-api`)
- `npm ci`
- `npx prisma generate`
- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run test:e2e`

### Frontend (`sgsst-web`)
- `npm ci`
- `npm run build`
- `npm run dev`

## CI behavior
- GitHub Actions validate `docker compose config` at root.
- Backend job uses Node 22, `npm ci`, `npx prisma generate`, unit and e2e tests, and `npm run build`.
- Web job uses Node 22, `npm ci`, and `npm run build`.

## Important architecture notes
- API base path is `/api/v1`.
- Auth is JWT-based; use `Authorization: Bearer <token>`.
- The backend contains guards, decorators and DTOs to enforce validation and RBAC.
- The frontend reads `VITE_API_URL` and expects the API under that base URL.
- `sgsst-api` uses Prisma migrations and should keep schema changes matched with new migrations.

## Useful references
- Root README: `README.md`
- Architecture: `docs/arquitectura-sgsst.md`
- Backend conventions: `docs/backend-sgsst-nestjs.md`
- PostgreSQL backups: `docs/backups-postgresql.md`
- Local env and Docker: `docker-compose.yml`

## Agent style
- Answer with concise code changes and specific file paths.
- Prefer minimal edits to fix issues or add features.
- If the repo already has a docs page for a topic, link to it instead of duplicating content.
- When proposing tests, use the existing `npm run test` or `npm run build` patterns.
