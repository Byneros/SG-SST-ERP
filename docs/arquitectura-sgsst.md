# Arquitectura modular SG-SST

Este documento define una base modular y escalable para el sistema SG-SST. La implementacion actual usa NestJS, Prisma, PostgreSQL y un frontend Vue/Vite, por lo que la arquitectura propuesta mantiene esa direccion y separa el dominio en modulos independientes.

## Objetivos

- Separar responsabilidades por modulos de negocio.
- Aplicar control de acceso por roles: admin, SST, empleado y auditor.
- Exponer una API versionada, segura y facil de integrar.
- Preparar la plataforma para despliegue en contenedores y crecimiento cloud.
- Proteger datos sensibles laborales, medicos, documentales y de auditoria.

## Modulos principales del sistema

| Modulo | Responsabilidad | Entidades base |
| --- | --- | --- |
| Identidad y acceso | Login, sesiones, usuarios, roles, permisos y recuperacion de cuenta. | User, Role |
| Empresas | Gestion multiempresa, sedes, configuracion SG-SST y parametros del cliente. | Company |
| Empleados | Datos laborales, cargos, vinculacion a empresa, historial y estado. | Employee |
| Riesgos | Matriz de peligros, evaluacion, controles, planes de mitigacion. | Risk |
| Incidentes | Reporte, investigacion, seguimiento, acciones correctivas y cierre. | Incident |
| Capacitaciones | Programacion, asistencia, evidencias, evaluaciones y certificados. | Training |
| Auditorias | Planes de auditoria, hallazgos, evidencias, resultados y seguimiento. | Audit |
| Documentos | Politicas, formatos, soportes, versiones, vencimientos y trazabilidad. | Document |
| Indicadores | KPIs, tableros, metricas normativas, accidentalidad y cumplimiento. | Indicator |
| Notificaciones | Alertas de vencimiento, asignaciones, cambios de estado y recordatorios. | Notification |
| Integraciones | Conectores externos para ARL, firmas digitales, IoT y correo/SMS. | IntegrationEvent, Webhook |
| Auditoria tecnica | Logs de acceso, cambios de datos, exportaciones y eventos sensibles. | AuditLog |

Estructura recomendada para NestJS:

```text
src/
  common/
    decorators/
    filters/
    guards/
    interceptors/
    pipes/
  config/
  database/
  modules/
    auth/
    users/
    companies/
    employees/
    risks/
    incidents/
    trainings/
    audits/
    documents/
    indicators/
    notifications/
    integrations/
    audit-logs/
```

## Modelo de roles

| Rol | Alcance | Permisos principales |
| --- | --- | --- |
| ADMIN | Plataforma completa o tenant asignado, segun configuracion. | Gestionar empresas, usuarios, roles, parametros globales, integraciones, auditoria tecnica y reportes consolidados. |
| SST | Empresa asignada. | Gestionar riesgos, incidentes, capacitaciones, documentos, indicadores, acciones correctivas y evidencias SG-SST. |
| EMPLOYEE | Propia informacion y flujos asignados. | Reportar incidentes, consultar capacitaciones, cargar evidencias solicitadas, ver documentos publicados y responder actividades asignadas. |
| AUDITOR | Empresa, periodo o auditoria asignada. | Consultar informacion, registrar hallazgos, revisar evidencias, generar informes y cerrar auditorias autorizadas. |

Reglas de autorizacion:

- Todo usuario debe pertenecer a una empresa, salvo un admin global.
- Las consultas deben filtrar por `companyId` para aislamiento multiempresa.
- Los permisos deben evaluarse por rol y, cuando aplique, por propiedad del recurso.
- Las acciones sensibles deben generar `AuditLog`.
- Las rutas administrativas deben usar guardias NestJS: `JwtAuthGuard`, `RolesGuard` y validacion de tenant.

## Flujo de datos entre modulos

```text
Frontend Vue
  -> API Gateway / NestJS REST
    -> Auth Module valida JWT y tenant
      -> Modulo de negocio ejecuta reglas
        -> Prisma Repository
          -> PostgreSQL
        -> Document Storage, si hay archivos
        -> Event Bus / Queue, si hay notificaciones o integraciones
          -> Notifications / Integrations
```

Flujos clave:

1. Autenticacion: el usuario inicia sesion, el API valida credenciales, emite JWT y retorna rol, permisos y empresa.
2. Operacion SG-SST: el frontend consume endpoints versionados; el backend valida rol, tenant, DTOs y reglas del modulo.
3. Evidencias y documentos: el backend registra metadata en PostgreSQL y guarda archivos en almacenamiento externo.
4. Notificaciones: cambios de estado o vencimientos publican eventos asincronos para correo, app o integraciones.
5. Auditoria: toda accion critica registra quien, cuando, desde donde y que cambio realizo.

## Diseno de API REST

REST es la opcion base recomendada para esta etapa porque encaja bien con NestJS, DTOs, guardias, versionado y Swagger/OpenAPI. GraphQL puede agregarse despues para tableros analiticos o vistas muy agregadas.

Convenciones:

- Versionado: `/api/v1`.
- Autenticacion: `Authorization: Bearer <token>`.
- Formato de respuesta consistente con `data`, `meta` y `errors`.
- Paginacion: `page`, `limit`, `sort`, `order`.
- Filtros por empresa aplicados desde el backend, no confiados al cliente.
- Validacion con `class-validator` y transformacion con DTOs.

Endpoints propuestos:

```text
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/auth/me

GET    /api/v1/users
POST   /api/v1/users
GET    /api/v1/users/:id
PATCH  /api/v1/users/:id
PATCH  /api/v1/users/:id/role

GET    /api/v1/companies
POST   /api/v1/companies
GET    /api/v1/companies/:id
PATCH  /api/v1/companies/:id

GET    /api/v1/employees
POST   /api/v1/employees
GET    /api/v1/employees/:id
PATCH  /api/v1/employees/:id

GET    /api/v1/risks
POST   /api/v1/risks
GET    /api/v1/risks/:id
PATCH  /api/v1/risks/:id

GET    /api/v1/incidents
POST   /api/v1/incidents
GET    /api/v1/incidents/:id
PATCH  /api/v1/incidents/:id
POST   /api/v1/incidents/:id/actions

GET    /api/v1/trainings
POST   /api/v1/trainings
GET    /api/v1/trainings/:id
POST   /api/v1/trainings/:id/attendance

GET    /api/v1/audits
POST   /api/v1/audits
GET    /api/v1/audits/:id
POST   /api/v1/audits/:id/findings
PATCH  /api/v1/audits/:id/close

GET    /api/v1/documents
POST   /api/v1/documents
GET    /api/v1/documents/:id
POST   /api/v1/documents/:id/versions

GET    /api/v1/indicators
POST   /api/v1/indicators
GET    /api/v1/indicators/dashboard

GET    /api/v1/notifications
PATCH  /api/v1/notifications/:id/read

POST   /api/v1/integrations/webhooks/:provider
GET    /api/v1/audit-logs
```

GraphQL opcional:

- Usarlo para dashboards con multiples agregaciones.
- Mantener mutations criticas en REST si se requiere trazabilidad operacional clara.
- Proteger resolvers con los mismos guards y filtros de tenant.

## Estrategia de escalabilidad

Arquitectura inicial:

- Frontend Vue servido como estatico desde CDN o bucket.
- API NestJS en contenedor Docker.
- PostgreSQL administrado.
- Almacenamiento de documentos en S3, Azure Blob o equivalente.
- Cola asincrona para notificaciones, reportes e integraciones.

Evolucion por etapas:

1. Monolito modular: un solo backend NestJS con modulos bien separados.
2. Workers asincronos: separar tareas pesadas como PDFs, correos, vencimientos e integraciones.
3. Escalado horizontal: multiples replicas del API detras de balanceador.
4. Cache y lectura: Redis para sesiones, rate limiting, cache de dashboards y colas.
5. Servicios separados: extraer documentos, integraciones o analytics solo cuando el volumen lo justifique.

Contenedores:

- Crear `Dockerfile` para API y frontend.
- Usar `docker-compose` local con API, PostgreSQL, Redis y worker.
- En cloud, desplegar en Kubernetes, ECS, Azure Container Apps, Cloud Run o App Service for Containers.
- Usar migraciones Prisma en pipeline controlado, no en cada arranque de replica.

Observabilidad:

- Logs estructurados por requestId, userId, companyId y modulo.
- Metricas: latencia, errores, throughput, tareas pendientes y uso de almacenamiento.
- Trazas distribuidas si se separan workers o servicios.

## Seguridad

Autenticacion:

- JWT de corta duracion y refresh token rotativo.
- Passwords con bcrypt y politica de complejidad.
- MFA opcional para ADMIN, SST y AUDITOR.
- Bloqueo temporal por intentos fallidos.

Autorizacion:

- RBAC por rol.
- ABAC complementario por `companyId`, propietario del recurso, estado del flujo y alcance de auditoria.
- Guards por ruta y validacion centralizada de permisos.
- Principio de minimo privilegio.

Proteccion de datos sensibles:

- TLS obligatorio.
- Cifrado en reposo para base de datos y almacenamiento documental.
- No guardar archivos sensibles en el contenedor.
- Variables secretas en gestor de secretos cloud.
- Enmascarar identificaciones, telefonos y correos en logs.
- Retencion documental configurable por empresa y normativa.
- Backups cifrados y pruebas periodicas de restauracion.

Seguridad de API:

- CORS restringido por ambiente.
- Rate limiting por IP, usuario y ruta.
- Validacion de DTOs con whitelist.
- Sanitizacion de entradas de texto.
- Limites de tamano y tipo para archivos.
- Cabeceras de seguridad HTTP.
- Auditoria de exportaciones, cambios de rol, cambios de estado y eliminaciones.

## Integraciones futuras

ARL:

- Sincronizacion de empresas, empleados, accidentalidad y reportes.
- Conector por proveedor con adaptadores independientes.
- Webhooks o jobs programados segun disponibilidad de la ARL.
- Tabla de eventos para trazabilidad de envios, respuestas y errores.

Firmas digitales:

- Integracion con proveedor de firma electronica/digital.
- Flujo: generar documento, enviar a firmantes, recibir callback, almacenar evidencia y hash.
- Validar identidad del firmante y conservar certificado/transaccion.

IoT:

- Recepcion de telemetria desde sensores de ambiente, EPP, ubicacion o maquinaria.
- Ingestion por MQTT/HTTP hacia un modulo de integraciones.
- Normalizacion de eventos y reglas para alertas preventivas.
- Almacenamiento separado para series de tiempo si el volumen crece.

Otros conectores:

- Correo transaccional y SMS/WhatsApp para notificaciones.
- BI externo mediante endpoints de solo lectura o replicas analiticas.
- SSO empresarial con OIDC/SAML en clientes grandes.

## Recomendaciones de implementacion inmediata

1. Crear `common`, `config`, `database` y `modules` en el API.
2. Implementar Auth primero: JWT, bcrypt, guards, decorators y roles.
3. Agregar `companyId` obligatorio en recursos multiempresa y filtros globales por tenant.
4. Incorporar Swagger/OpenAPI para documentar `/api/v1`.
5. Agregar `AuditLog`, `DocumentVersion`, `Finding`, `CorrectiveAction` e `IntegrationEvent` al modelo Prisma.
6. Separar cargas de archivos del API usando almacenamiento externo.
7. Preparar Dockerfile y pipeline con lint, test, build y migraciones controladas.

