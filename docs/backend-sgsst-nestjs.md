# Backend SG-SST NestJS

Backend modular basado en NestJS, Prisma y PostgreSQL con arquitectura por capas:

```text
controller -> service -> repository -> Prisma -> PostgreSQL
```

## Modulos implementados

- `auth`: login JWT y perfil autenticado.
- `users`: CRUD de usuarios.
- `companies`: CRUD de empresas multi-tenant.
- `risks`: CRUD de riesgos por empresa.
- `trainings`: CRUD de capacitaciones por empresa.
- `incidents`: CRUD de incidentes por empresa.
- `database`: PrismaService global.
- `common`: guards, decorators, middleware y utilidades compartidas.

## Rutas principales

Todas las rutas usan prefijo `/api/v1`.

```text
POST   /api/v1/auth/login
GET    /api/v1/auth/me

GET    /api/v1/users
POST   /api/v1/users
GET    /api/v1/users/:id
PATCH  /api/v1/users/:id
DELETE /api/v1/users/:id

GET    /api/v1/companies
POST   /api/v1/companies
GET    /api/v1/companies/:id
PATCH  /api/v1/companies/:id
DELETE /api/v1/companies/:id

GET    /api/v1/risks?companyId=<uuid>
POST   /api/v1/risks
GET    /api/v1/risks/:id
PATCH  /api/v1/risks/:id
DELETE /api/v1/risks/:id

GET    /api/v1/trainings?companyId=<uuid>
POST   /api/v1/trainings
GET    /api/v1/trainings/:id
PATCH  /api/v1/trainings/:id
DELETE /api/v1/trainings/:id

GET    /api/v1/incidents?companyId=<uuid>
POST   /api/v1/incidents
GET    /api/v1/incidents/:id
PATCH  /api/v1/incidents/:id
DELETE /api/v1/incidents/:id
```

## Seguridad aplicada

- JWT Bearer token.
- `JwtAuthGuard` para validar tokens.
- `RolesGuard` con decorador `@Roles`.
- CORS configurable con `CORS_ORIGINS`.
- Validacion global con whitelist y rechazo de campos no permitidos.
- Middleware de cabeceras seguras.
- Rate limiting basico por IP.
- Passwords con bcrypt y costo 12.
- Validacion de alcance multi-tenant por `companyId`.
- `JWT_SECRET` obligatorio en produccion.

## Variables recomendadas

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sgsst
JWT_SECRET=change-this-secret
JWT_EXPIRES_IN=1h
CORS_ORIGINS=https://app.example.com
```

## Ejemplo de login

```json
POST /api/v1/auth/login
{
  "email": "sst@empresa.com",
  "password": "passwordSeguro123"
}
```

Respuesta:

```json
{
  "accessToken": "<jwt>",
  "tokenType": "Bearer",
  "expiresIn": "1h",
  "user": {
    "id": "<uuid>",
    "name": "Responsable SST",
    "email": "sst@empresa.com",
    "role": "SST",
    "companyId": "<uuid>"
  }
}
```

## Buenas practicas para evolucionar

- Agregar migraciones Prisma por cada cambio de schema.
- Reemplazar rate limiting en memoria por Redis o gateway cuando haya varias replicas.
- Implementar refresh tokens rotativos.
- Registrar `AuditLog` en acciones sensibles.
- Agregar Swagger/OpenAPI para contratos formales.
- Usar soft delete en tablas operativas antes de produccion.
- Agregar pruebas e2e para auth, RBAC y aislamiento multi-tenant.

