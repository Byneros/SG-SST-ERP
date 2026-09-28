# Rol DEVELOPER (panel técnico de plataforma)

## Propósito

Rol técnico de plataforma, independiente de los roles de empresa
(`ADMIN`, `SST`, `EMPLOYEE`, `AUDITOR`) y de `SUPER_ADMIN`:

- `companyId: null` — vive fuera de todo tenant; `resolveCompanyScope`
  responde 403 en cualquier recurso de negocio.
- Acceso **exclusivo** a `/api/v1/developer/*` (sin bypass de SUPER_ADMIN).
- No se crea ni modifica por la API de usuarios: solo por seed/consola.
- No expone datos de negocio de las empresas, credenciales ni secretos.

## Creación del primer usuario DEVELOPER

El seed (`sgsst-api/prisma/seed.ts`) lo crea de forma idempotente
(upsert por email) solo si defines las variables de entorno. Nunca va
una contraseña en el código fuente.

PowerShell:

```powershell
cd sgsst-api
$env:DEVELOPER_EMAIL    = "dev@tudominio.com"
$env:DEVELOPER_PASSWORD = "UnaClaveLargaDeAlMenos12Caracteres"
npm run seed
```

Requisitos de la contraseña: mínimo 12 caracteres (se rechaza con un
warning si es más corta). Si el email ya existe con otro rol, el seed
**no** lo convierte a DEVELOPER (evita escalada accidental).

## Variables de entorno

| Variable              | Obligatoria | Descripción                              |
|-----------------------|-------------|------------------------------------------|
| `DEVELOPER_EMAIL`     | sí (seed)   | Email de la cuenta DEVELOPER             |
| `DEVELOPER_PASSWORD`  | sí (seed)   | Contraseña en claro SOLO para el seed    |

Se puede usar un `.env` local (no versionado) en `sgsst-api/`.

## Migración

La migración `20260928210000_developer_role` añade el valor
`DEVELOPER` al enum `Role` de PostgreSQL. Ya aplicada en desarrollo.
En otros entornos:

```bash
cd sgsst-api
npx prisma migrate deploy
```

## Endpoints (todos requieren JWT con role=DEVELOPER)

| Endpoint                 | Contenido                                             |
|--------------------------|-------------------------------------------------------|
| `GET /developer/overview`    | Estado API + PostgreSQL + Redis + colas on/off   |
| `GET /developer/modules`     | Módulos del sistema y flags de configuración     |
| `GET /developer/queues`      | Configuración efectiva de colas BullMQ           |
| `GET /developer/audit`       | Últimas 50 operaciones administrativas          |
| `GET /developer/diagnostics` | Conteos globales (empresas, usuarios, auditoría) |

## Frontend

Vista `developer` en `sgsst-web` (`Panel de desarrollador`, menú solo
visible para `role === 'DEVELOPER'`). El backend es la autoridad:
ocultar el menú no es la única protección.

## Seguridad aplicada

1. `JwtAuthGuard` + `RolesGuard` + `assertDeveloper` en cada handler
   (defensa en profundidad: SUPER_ADMIN no tiene bypass aquí).
2. DTOs de usuarios excluyen `DEVELOPER` (400 por
   `forbidNonWhitelisted`); `ensureSingleCompanyAssignment` además lo
   rechaza con 403.
3. Un DEVELOPER no puede mutar su propio rol vía users API.
4. SSO no provisiona DEVELOPER (`AssignableRole` excluye
   `SUPER_ADMIN` y `DEVELOPER`).
5. Sin empresa asignada: todo recurso tenant responde 403.
6. Contraseñas hasheadas con bcrypt (costo 12), igual que el resto.
