# Arquitectura SaaS SG-SST ERP

Este documento deja aplicado el diseño objetivo del proyecto como SaaS empresarial modular, multiempresa y listo para crecer hacia producción. La implementación actual usa React/Vite en frontend, NestJS en backend, Prisma como capa de acceso a datos y PostgreSQL como base transaccional.

## 1. Arquitectura del sistema

```text
Usuario web
  -> React/Vite + MUI
  -> API REST NestJS /api/v1
  -> Guards JWT + roles + alcance por companyId
  -> Servicios de dominio
  -> Repositorios Prisma
  -> PostgreSQL
  -> AuditLog
```

Arquitectura actual:

- `sgsst-web`: aplicación React con login, sidebar, dashboard, CRUD de empresas, empleados y usuarios, auditoría y carga diferida por módulo.
- `sgsst-api`: monolito modular NestJS con módulos de dominio, DTOs, guards, auditoría, Swagger y Dockerfile.
- `PostgreSQL`: fuente de verdad para tenants, usuarios, empleados, riesgos, incidentes, capacitaciones y logs de auditoría.
- `Docker Compose`: entorno local productivo con web, API y PostgreSQL.

Arquitectura evolutiva:

- Mantener el backend como monolito modular mientras el equipo y el volumen sean manejables.
- Extraer workers para notificaciones, reportes programados, integraciones e importaciones masivas.
- Separar microservicios solo cuando exista presión real de escala o independencia: documentos, integraciones, analytics o IoT.

## 2. Tecnologías recomendadas

| Capa | Tecnología aplicada | Motivo |
| --- | --- | --- |
| Frontend | React, Vite, TypeScript, MUI | UI empresarial rápida, modular y mantenible. |
| Backend | NestJS, TypeScript | Arquitectura por módulos, guards, DTOs, Swagger y buenas prácticas enterprise. |
| Datos | PostgreSQL, Prisma | Modelo relacional fuerte, migraciones y repositorios tipados. |
| Auth | JWT, bcrypt, RBAC | Base segura para SaaS multiempresa. |
| Contenedores | Docker, Docker Compose, Nginx | Entorno reproducible para local, QA y producción. |
| Documentación API | Swagger/OpenAPI | Contrato navegable para frontend e integraciones. |

Futuro recomendado:

- Redis para cache, colas, rate limiting distribuido y jobs.
- S3, Azure Blob o GCS para documentos y evidencias.
- OpenTelemetry para trazas cuando existan workers o más servicios.
- Next.js solo si se necesita SSR, SEO público o rutas híbridas; para este ERP interno React/Vite es suficiente.

## 3. Diseño multi-tenant

El tenant principal es `Company`. Los datos operativos deben pertenecer a una empresa mediante `companyId`.

Reglas aplicadas o esperadas:

- `ADMIN`: puede operar globalmente y crear empresas.
- `SST`: queda limitado a su `companyId`.
- `AUDITOR`: puede consultar según alcance asignado.
- `EMPLOYEE`: debe consultar y operar sobre su propia información y tareas.
- Toda consulta sensible debe filtrar por `companyId` desde backend.
- El frontend puede enviar filtros, pero el backend siempre decide el alcance real.
- Las eliminaciones operativas se manejan como soft delete con `isActive` y `deletedAt`.

Mejora recomendada para la siguiente fase:

- Crear una tabla de membresías o alcances si un usuario necesita operar varias empresas.
- Agregar permisos finos por módulo cuando el SaaS tenga clientes grandes.
- Implementar políticas ABAC para casos como "auditor asignado a auditoría X".

## 4. Módulos principales

Módulos ya presentes o previstos:

- `auth`: login, bootstrap admin, JWT.
- `users`: usuarios, roles y activación.
- `companies`: tenants, NIT, ARL, clase de riesgo y datos empresariales.
- `employees`: datos laborales, tipo de documento, centro de trabajo y estado.
- `dashboard`: KPIs resumidos por alcance.
- `audit`: trazabilidad de cambios.
- `documents`: evidencias, versiones, vencimientos, carga local inicial y contrato preparado para almacenamiento externo.
- `risks`: matriz de peligros y controles.
- `incidents`: reporte e investigación de incidentes.
- `trainings`: capacitaciones, asistencia y seguimiento.

Módulos de producción a incorporar:

- `notifications`: correos, recordatorios, tareas y alertas.
- `audits`: auditorías SG-SST funcionales, hallazgos y planes.
- `corrective-actions`: acciones, responsables, fechas y cierres.
- `integrations`: ARL, firmas digitales, IoT y webhooks.
- `reports`: PDF, exportaciones CSV y tableros regulatorios.

## 5. Modelo de roles

| Rol | Alcance | Permisos principales |
| --- | --- | --- |
| ADMIN | Plataforma completa | Gestiona empresas, usuarios, configuración, auditoría técnica e integraciones. |
| SST | Empresa asignada | Gestiona empleados, riesgos, incidentes, capacitaciones, documentos e indicadores. |
| EMPLOYEE | Propio perfil | Reporta incidentes, consulta tareas/capacitaciones y carga evidencias asignadas. |
| AUDITOR | Empresas o procesos asignados | Consulta, revisa evidencias, registra hallazgos y genera informes. |

Modelo recomendado:

- RBAC para rutas y acciones generales.
- ABAC para `companyId`, propietario del recurso, estado del proceso y asignaciones.
- Auditoría obligatoria en cambios de rol, exportaciones, bajas, reactivaciones y cambios de estado.

## 6. Flujo de datos entre módulos

```text
Login
  -> AuthService valida email/password
  -> JWT contiene sub, role y companyId
  -> Frontend guarda sesión

CRUD multiempresa
  -> React llama /api/v1/*
  -> JwtAuthGuard valida token
  -> RolesGuard valida rol
  -> Servicio aplica alcance por companyId
  -> Repositorio Prisma persiste
  -> AuditService registra antes/después

Dashboard
  -> Frontend solicita resumen
  -> Backend agrega datos filtrados por tenant
  -> React muestra KPIs y estados
```

Cuando se agreguen notificaciones e integraciones, los cambios de dominio deben publicar eventos internos para procesarse de forma asíncrona.

## 7. Diseño de API REST

La API principal debe seguir en REST porque es simple, auditable y compatible con Swagger.

Convenciones:

- Base URL: `/api/v1`.
- Autenticación: `Authorization: Bearer <token>`.
- Paginación: `page`, `pageSize`.
- Filtros comunes: `search`, `isActive`, `companyId`.
- Respuestas listadas: `{ data, meta }`.
- Validación estricta con DTOs, `whitelist` y `forbidNonWhitelisted`.
- Errores con códigos HTTP estándar.

Endpoints base:

```text
GET    /api/v1/health
POST   /api/v1/auth/login
POST   /api/v1/auth/bootstrap-admin
GET    /api/v1/dashboard/summary
GET    /api/v1/companies
POST   /api/v1/companies
PATCH  /api/v1/companies/:id
DELETE /api/v1/companies/:id
GET    /api/v1/employees
POST   /api/v1/employees
PATCH  /api/v1/employees/:id
DELETE /api/v1/employees/:id
GET    /api/v1/users
POST   /api/v1/users
PATCH  /api/v1/users/:id
DELETE /api/v1/users/:id
GET    /api/v1/audit-logs
```

GraphQL puede añadirse después para dashboards compuestos, pero las mutaciones críticas deben conservar trazabilidad clara.

## 8. Estrategia de escalabilidad

Etapa 1, aplicada:

- Monolito modular NestJS.
- Frontend estático servido por Nginx.
- PostgreSQL en contenedor local.
- Dockerfiles por aplicación.
- Health check HTTP para API.

Etapa 2:

- PostgreSQL administrado.
- API con múltiples réplicas detrás de balanceador.
- Redis para cache/rate limit distribuido.
- Storage externo para archivos.
- Workers para notificaciones, reportes programados e integraciones.

Etapa 3:

- Kubernetes, ECS, Azure Container Apps, Cloud Run o App Service for Containers.
- CI/CD con `lint`, `test`, `build`, migraciones Prisma y despliegue por ambiente.
- Observabilidad con logs estructurados, métricas y trazas.
- Réplica de lectura o base analítica para BI.

## 9. Seguridad

Ya aplicado:

- JWT.
- Bcrypt.
- Guards por autenticación y roles.
- Alcance por `companyId`.
- DTO validation estricta.
- CORS configurable.
- Cabeceras básicas de seguridad.
- Rate limit en memoria.
- Soft delete.
- Audit logs.
- Rechazo de `JWT_SECRET` inseguro en producción.

Mejoras pendientes para producción:

- Refresh tokens rotativos.
- MFA para `ADMIN`, `SST` y `AUDITOR`.
- Rate limiting distribuido con Redis.
- Gestor de secretos cloud.
- Encriptación de documentos en storage externo.
- Mascaramiento de datos sensibles en logs.
- Política de backups y pruebas de restauración.
- Auditoría funcional de exportaciones y descargas.
- Bloqueo temporal por intentos fallidos.

## 10. Integraciones futuras

ARL:

- Sincronizar empresas, empleados, reportes de accidentalidad y soportes.
- Crear adaptadores por proveedor.
- Registrar cada envío/respuesta en `IntegrationEvent`.

Firmas digitales:

- Generar documento, enviar a firma, recibir callback, guardar evidencia, hash y certificado.
- Integrar con proveedores como servicio externo desacoplado.

IoT:

- Recibir telemetría vía HTTP/MQTT.
- Normalizar eventos de sensores.
- Generar alertas preventivas.
- Usar almacenamiento de series de tiempo si el volumen crece.

Otros:

- Correo transaccional.
- WhatsApp/SMS.
- SSO OIDC/SAML para clientes grandes.
- BI externo por vistas o endpoints de solo lectura.

## Decisiones de arquitectura

- Mantener REST como API principal.
- Mantener monolito modular hasta que haya motivos reales para separar servicios.
- Filtrar multi-tenant en backend, no confiar en el cliente.
- Usar `AuditLog` como requisito transversal.
- No almacenar documentos en el filesystem efímero del contenedor; usar volumen local en desarrollo y storage externo en producción.
- Ejecutar migraciones en pipeline o tarea controlada en producción.

## Próximos pasos recomendados

1. Agregar pipeline de despliegue por ambiente.
2. Sincronizar backups a bucket cifrado externo.
3. Agregar observabilidad con logs estructurados y métricas.
4. Implementar SSO OIDC/SAML para clientes empresariales.
5. Registrar entregas externas de alertas con reintentos y trazabilidad.
