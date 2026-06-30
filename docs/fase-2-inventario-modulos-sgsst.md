# Fase 2 - Inventario completo de modulos SG-SST

Este documento define el mapa funcional objetivo para convertir el sistema actual en una plataforma SG-SST empresarial colombiana. No reemplaza una revision juridica formal; sirve como backlog funcional, base de arquitectura, modelo de datos y matriz de trazabilidad normativa.

Normativa de referencia: Decreto 1072 de 2015, Resolucion 0312 de 2019, Ley 1562 de 2012, Resolucion 1401 de 2007, Resolucion 2013 de 1986, Resolucion 2646 de 2008, Resolucion 2400 de 1979, GTC 45 e ISO 45001:2018.

## Roles base

- Administrador: configura plataforma, empresas, usuarios, permisos, catalogos, auditoria y parametrizacion.
- Responsable SG-SST: lidera planeacion, ejecucion, seguimiento, evidencias, reportes y cierre.
- Lider de proceso: reporta condiciones, ejecuta planes, atiende acciones y valida controles en su area.
- Trabajador: consulta tareas, reporta actos/condiciones/incidentes, firma evidencias y participa en capacitaciones.
- Auditor: consulta evidencias, ejecuta auditorias, registra hallazgos y verifica acciones.
- COPASST: consulta, recomienda, participa en investigaciones, inspecciones y seguimiento.
- Consulta: rol de solo lectura para gerencia, ARL, interventoria o cliente autorizado.

## Convenciones API

- Base: `/api/v1`.
- CRUD sugerido por entidad: `GET /recurso`, `GET /recurso/:id`, `POST /recurso`, `PUT /recurso/:id`, `DELETE /recurso/:id`.
- Para trazabilidad, `DELETE` debe ser baja logica salvo catalogos temporales.
- Todo recurso operativo debe incluir `companyId`, auditoria, estado y evidencias cuando aplique.

## 1. Dashboard Ejecutivo

**Objetivo:** visualizar cumplimiento, riesgos, vencimientos, accidentalidad, planes y alertas por empresa.

**Descripcion funcional:** tablero gerencial con indicadores legales, operativos y predictivos. Debe permitir filtros por empresa, sede, area, proceso, periodo, clase de riesgo y responsable.

**Alcance:** resumen ejecutivo, semaforos, tendencias, mapa de calor, tareas criticas, vencimientos, alertas y exportacion.

**Submodulos:** resumen gerencial, indicadores legales, alertas criticas, mapa de calor, vencimientos, tendencias, comparativo multiempresa.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| dashboard_widgets | Configuracion de widgets por usuario/rol | id, userId, companyId, widgetKey, config, order, visible | User, Company | GET/POST/PUT/DELETE `/dashboard/widgets` | Administrador, Responsable SG-SST |
| dashboard_snapshots | Corte historico de indicadores | id, companyId, period, metricKey, value, target, status | Company | GET `/dashboard/snapshots`, POST interno | Administrador, Responsable SG-SST, Auditor, Consulta |

**Flujo:** seleccionar alcance -> cargar indicadores -> mostrar semaforos -> abrir detalle -> generar reporte -> crear tareas correctivas si aplica.

**Reglas de negocio:** indicadores vencidos se marcan en rojo; datos globales solo para Administrador; cada KPI debe tener fuente y fecha de corte.

**Casos de uso reales:** gerencia revisa cumplimiento mensual; Responsable SG-SST identifica acciones vencidas; auditor consulta evidencia por indicador.

**Reportes:** tablero gerencial PDF, cumplimiento mensual, criticidad por sede, vencimientos por responsable.

**KPIs:** cumplimiento plan anual, accidentalidad, severidad, ausentismo, avance acciones, documentos vencidos, cobertura capacitacion.

**Notificaciones:** vencimientos criticos, deterioro de indicador, accion vencida, riesgo alto sin control.

**Evidencias:** reportes firmados, cortes de indicadores, actas de revision gerencial.

**Riesgo legal:** no demostrar seguimiento del SG-SST, ausencia de revision por direccion, falta de indicadores obligatorios.

## 2. Empresas

**Objetivo:** administrar tenants, datos legales, ARL, clase de riesgo y parametrizacion SG-SST.

**Descripcion funcional:** registro maestro de empresas con datos de identificacion, politicas, responsables y configuracion de alertas.

**Alcance:** CRUD empresa, datos legales, ARL, politicas de reportes, canales externos y estado.

**Submodulos:** informacion legal, configuracion SG-SST, canales de alerta, politicas de retencion, contactos.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| companies | Tenant principal | id, name, nit, arl, riskClass, economicActivity, city, department, email, isActive | Users, Employees, Sites | GET/POST/PUT/DELETE `/companies` | Administrador |
| company_settings | Parametros SG-SST | id, companyId, key, value, effectiveFrom | Company | GET/POST/PUT/DELETE `/companies/:id/settings` | Administrador, Responsable SG-SST |

**Flujo:** crear empresa -> validar NIT -> asignar ARL/clase riesgo -> configurar sedes/responsables -> activar usuarios -> monitorear.

**Reglas:** NIT unico; empresa inactiva no permite nuevos registros operativos; cambios criticos generan auditoria.

**Casos:** alta de cliente SaaS, parametrizacion por ARL, suspension temporal.

**Reportes:** ficha empresa, configuracion SG-SST, estado multiempresa.

**KPIs:** empresas activas, empresas sin responsable, empresas con parametros incompletos.

**Notificaciones:** empresa sin configuracion minima, certificados/documentos empresariales vencidos.

**Evidencias:** RUT, afiliacion ARL, contrato, politica SST.

**Riesgo legal:** no identificar empleador/contratante, perdida de trazabilidad multiempresa.

## 3. Sedes

**Objetivo:** representar ubicaciones fisicas donde se ejecutan actividades.

**Descripcion funcional:** permite separar riesgos, inspecciones, emergencias, trabajadores, areas y reportes por sede.

**Alcance:** sedes, direcciones, ciudad/departamento, responsable, estado, georreferencia.

**Submodulos:** sedes administrativas, operativas, temporales, centros de trabajo.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| sites | Sedes o centros | id, companyId, name, code, address, city, department, responsibleId, isMain, isActive | Company, Areas, Employees | GET/POST/PUT/DELETE `/sites` | Administrador, Responsable SG-SST |
| site_contacts | Contactos por sede | id, siteId, name, role, phone, email | Site | GET/POST/PUT/DELETE `/sites/:id/contacts` | Administrador, Responsable SG-SST |

**Flujo:** crear sede -> asignar responsable -> crear areas/procesos -> asociar trabajadores -> evaluar riesgos.

**Reglas:** cada sede debe tener responsable; no cerrar sede con acciones abiertas sin reasignar.

**Casos:** nueva planta, bodega temporal, sede administrativa.

**Reportes:** riesgos por sede, inspecciones por sede, emergencias por sede.

**KPIs:** sedes inspeccionadas, acciones vencidas por sede, riesgos altos por sede.

**Notificaciones:** inspeccion pendiente, plan emergencia vencido, responsable no asignado.

**Evidencias:** fotos, planos, actas de inspeccion, certificados.

**Riesgo legal:** no controlar condiciones locativas ni emergencias por centro de trabajo.

## 4. Areas

**Objetivo:** clasificar espacios o unidades internas para gestionar peligros, responsables e inspecciones.

**Descripcion funcional:** estructura operativa por area: produccion, mantenimiento, administrativa, almacen, laboratorio, etc.

**Alcance:** areas por sede, responsable, procesos asociados, criticidad.

**Submodulos:** areas fisicas, areas funcionales, responsables.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| areas | Areas internas | id, companyId, siteId, name, code, responsibleId, riskCriticality, isActive | Company, Site, Processes | GET/POST/PUT/DELETE `/areas` | Administrador, Responsable SG-SST, Lider de proceso |
| area_assignments | Asignaciones de usuarios | id, areaId, userId, role, validFrom, validTo | Area, User | GET/POST/PUT/DELETE `/areas/:id/assignments` | Administrador, Responsable SG-SST |

**Flujo:** crear area -> asociar sede -> asignar lider -> vincular procesos/cargos -> ejecutar matriz de peligros.

**Reglas:** area con riesgos altos debe tener plan de intervencion activo.

**Casos:** inspeccion de almacen, cierre de area por traslado.

**Reportes:** mapa de calor por area, hallazgos por area.

**KPIs:** areas con matriz actualizada, hallazgos abiertos por area.

**Notificaciones:** lider sin acciones cerradas, matriz vencida.

**Evidencias:** fotos, planos, actas, mediciones.

**Riesgo legal:** no demostrar control por condiciones especificas del lugar.

## 5. Procesos

**Objetivo:** mapear procesos organizacionales donde ocurren actividades y riesgos.

**Descripcion funcional:** conecta cargos, tareas, peligros, indicadores, responsables y objetivos.

**Alcance:** procesos estrategicos, misionales, apoyo, contratistas.

**Submodulos:** mapa de procesos, responsables, actividades, tareas criticas.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| processes | Procesos SG-SST/operativos | id, companyId, areaId, name, type, responsibleId, description, isActive | Company, Area, Jobs, Risks | GET/POST/PUT/DELETE `/processes` | Administrador, Responsable SG-SST, Lider de proceso |
| process_activities | Actividades del proceso | id, processId, name, frequency, isCritical | Process, HazardMatrix | GET/POST/PUT/DELETE `/processes/:id/activities` | Responsable SG-SST, Lider de proceso |

**Flujo:** registrar proceso -> definir actividades -> asociar cargos -> identificar peligros -> definir controles.

**Reglas:** todo peligro debe estar ligado a proceso/actividad; cambios de proceso disparan gestion del cambio.

**Casos:** proceso de soldadura, proceso administrativo, mantenimiento preventivo.

**Reportes:** matriz por proceso, indicadores por proceso.

**KPIs:** procesos evaluados, actividades criticas controladas.

**Notificaciones:** proceso sin matriz, cambio pendiente de evaluacion.

**Evidencias:** caracterizacion, procedimientos, analisis de tareas.

**Riesgo legal:** peligros no identificados por actividad real.

## 6. Cargos

**Objetivo:** gestionar cargos, funciones, competencias, riesgos, EPP y examenes requeridos.

**Descripcion funcional:** define perfiles ocupacionales y requisitos SG-SST por cargo.

**Alcance:** cargos, funciones, profesiograma, competencias, EPP, examenes, capacitaciones.

**Submodulos:** perfiles, profesiogramas, requisitos, restricciones.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| job_positions | Cargos | id, companyId, processId, name, description, riskClass, isActive | Company, Process, Workers | GET/POST/PUT/DELETE `/job-positions` | Administrador, Responsable SG-SST |
| job_requirements | Requisitos del cargo | id, jobPositionId, type, name, periodicity, required | JobPosition | GET/POST/PUT/DELETE `/job-positions/:id/requirements` | Responsable SG-SST |

**Flujo:** crear cargo -> asociar proceso -> definir funciones/riesgos -> definir examenes/EPP/capacitaciones -> asignar trabajadores.

**Reglas:** trabajador no debe ser asignado sin requisitos minimos definidos para cargos criticos.

**Casos:** conductor, soldador, auxiliar administrativo, trabajo en alturas.

**Reportes:** matriz de requisitos por cargo, brechas de competencias.

**KPIs:** cargos con profesiograma, trabajadores con requisitos vencidos.

**Notificaciones:** examen/certificacion requerida vencida.

**Evidencias:** profesiograma, perfil de cargo, certificados.

**Riesgo legal:** asignar labores sin aptitud, entrenamiento o controles requeridos.

## 7. Trabajadores

**Objetivo:** administrar informacion laboral, estado ocupacional, requisitos y evidencias del trabajador.

**Descripcion funcional:** expediente SG-SST del trabajador con datos laborales, examenes, EPP, capacitaciones, incidentes y ausentismo.

**Alcance:** empleados directos, temporales, aprendices y personal en mision.

**Submodulos:** expediente, condiciones de salud, restricciones, historial, asignaciones.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| workers | Trabajadores | id, companyId, documentType, document, firstName, lastName, jobPositionId, siteId, areaId, status, hireDate | Company, JobPosition, Site, Area | GET/POST/PUT/DELETE `/workers` | Administrador, Responsable SG-SST |
| worker_history | Historial laboral SG-SST | id, workerId, eventType, date, description, evidenceId | Worker, Evidence | GET/POST `/workers/:id/history` | Responsable SG-SST, Auditor |

**Flujo:** crear trabajador -> asignar cargo/sede/area -> cargar requisitos -> programar examenes/capacitaciones -> seguimiento.

**Reglas:** documento unico por empresa; restricciones medicas solo visibles a roles autorizados.

**Casos:** ingreso, traslado, incapacidad, retiro, cambio de cargo.

**Reportes:** expediente trabajador, cumplimiento requisitos, vencimientos individuales.

**KPIs:** trabajadores activos, requisitos cumplidos, examenes vencidos.

**Notificaciones:** vencimientos, capacitaciones pendientes, restricciones por vencer.

**Evidencias:** contrato, induccion, examenes, EPP, certificados.

**Riesgo legal:** exposicion sin control, manejo indebido de datos sensibles, falta de trazabilidad.

## 8. Contratistas

**Objetivo:** controlar cumplimiento SG-SST de contratistas y proveedores.

**Descripcion funcional:** registra contratistas, documentos, trabajadores, actividades y permisos de trabajo.

**Alcance:** empresas contratistas, personal contratista, validacion documental, induccion, permisos.

**Submodulos:** empresas contratistas, personal, documentos, permisos, evaluacion.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| contractors | Empresas contratistas | id, companyId, name, nit, contact, arl, status | Company | GET/POST/PUT/DELETE `/contractors` | Administrador, Responsable SG-SST |
| contractor_workers | Personal contratista | id, contractorId, document, name, job, status | Contractor | GET/POST/PUT/DELETE `/contractors/:id/workers` | Responsable SG-SST |
| contractor_documents | Documentos requeridos | id, contractorId, documentType, expiresAt, status, evidenceId | Contractor, Evidence | GET/POST/PUT/DELETE `/contractors/:id/documents` | Responsable SG-SST, Auditor |

**Flujo:** registrar contratista -> definir actividad -> validar documentos -> inducir personal -> autorizar ingreso -> cerrar servicio.

**Reglas:** no autorizar ingreso con documentos criticos vencidos.

**Casos:** mantenimiento externo, obra civil, transporte.

**Reportes:** contratistas habilitados, documentos vencidos, cumplimiento por proveedor.

**KPIs:** contratistas conformes, documentos criticos vencidos, incidentes contratistas.

**Notificaciones:** vencimientos, contratista bloqueado, induccion pendiente.

**Evidencias:** seguridad social, ARL, certificados, permisos.

**Riesgo legal:** responsabilidad solidaria y exposicion de terceros sin control.

## 9. Usuarios

**Objetivo:** gestionar acceso, identidad, autenticacion y estado de cuentas.

**Descripcion funcional:** usuarios internos y externos con rol, empresa, MFA, estado, recuperacion y trazabilidad.

**Alcance:** CRUD, activacion, MFA, reset, bloqueo, sesiones.

**Submodulos:** cuentas, sesiones, MFA, recuperacion, bloqueo.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| users | Usuarios | id, companyId, name, email, passwordHash, role, mfaEnabled, isActive | Company | GET/POST/PUT/DELETE `/users` | Administrador |
| auth_sessions | Sesiones/token refresh | id, userId, tokenHash, expiresAt, revokedAt, ip | User | POST `/auth/login`, `/auth/refresh`, `/auth/logout` | Todos |

**Flujo:** crear usuario -> asignar empresa/rol -> activar MFA -> usar sistema -> auditar accesos.

**Reglas:** email unico; MFA obligatorio para roles criticos; baja logica.

**Casos:** alta Responsable SG-SST, auditor externo, trabajador.

**Reportes:** usuarios activos, MFA pendiente, accesos.

**KPIs:** % roles criticos con MFA, usuarios inactivos.

**Notificaciones:** MFA pendiente, reset password.

**Evidencias:** logs, aceptacion de politicas.

**Riesgo legal:** acceso no autorizado a datos personales y evidencias.

## 10. Roles y Permisos

**Objetivo:** administrar autorizaciones granulares por modulo, empresa, sede, proceso y accion.

**Descripcion funcional:** RBAC base y ABAC para alcance multiempresa y responsabilidades.

**Alcance:** roles, permisos, grupos, alcance por sede/proceso, auditor externo.

**Submodulos:** matriz de permisos, asignaciones, delegaciones.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| roles | Roles configurables | id, companyId, name, description, systemRole | Company | GET/POST/PUT/DELETE `/roles` | Administrador |
| permissions | Permisos | id, key, module, action, description | RolePermissions | GET `/permissions` | Administrador |
| role_permissions | Permisos por rol | id, roleId, permissionId, allowed | Role, Permission | GET/POST/DELETE `/roles/:id/permissions` | Administrador |

**Flujo:** definir rol -> asignar permisos -> asignar usuarios -> validar acceso -> auditar cambios.

**Reglas:** permisos del sistema no pueden eliminarse; cambios de permisos generan auditoria.

**Casos:** auditor solo lectura, COPASST consulta/seguimiento, lider de proceso limitado.

**Reportes:** matriz de permisos, usuarios por rol.

**KPIs:** usuarios con permisos excesivos, cambios de rol.

**Notificaciones:** cambio de permisos critico.

**Evidencias:** acta/autorizacion de acceso.

**Riesgo legal:** fuga de informacion sensible o modificacion no autorizada.

## 11. Gestion Documental

**Objetivo:** controlar documentos SG-SST, versiones, aprobaciones, vencimientos y evidencias.

**Descripcion funcional:** repositorio documental con ciclo de vida: borrador, revision, aprobado, publicado, obsoleto.

**Alcance:** politicas, procedimientos, formatos, registros, versiones, aprobaciones, firmas.

**Submodulos:** matriz documental, versiones, aprobaciones, vencimientos, distribucion.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| documents | Documento maestro | id, companyId, code, name, category, status, version, ownerId, expiresAt, fileUrl | Company, Versions | GET/POST/PUT/DELETE `/documents` | Responsable SG-SST, Administrador |
| document_versions | Versiones | id, documentId, version, fileUrl, changeLog, approvedBy, approvedAt | Document, User | GET/POST `/documents/:id/versions` | Responsable SG-SST |
| document_approvals | Flujo aprobacion | id, documentId, approverId, status, comments, signedAt | Document, User | GET/POST/PUT `/documents/:id/approvals` | Responsable SG-SST, Lider de proceso |

**Flujo:** crear documento -> cargar archivo -> enviar a revision -> aprobar/firmar -> publicar -> controlar vencimiento -> archivar.

**Reglas:** solo version aprobada puede publicarse; no eliminar documento con evidencias asociadas.

**Casos:** politica SST anual, procedimiento trabajo seguro, formato inspeccion.

**Reportes:** matriz documental, documentos vencidos, documentos por responsable.

**KPIs:** documentos vigentes, vencidos, promedio aprobacion.

**Notificaciones:** vencimiento, aprobacion pendiente, nueva version publicada.

**Evidencias:** archivos, firmas, trazabilidad de aprobacion.

**Riesgo legal:** documentos obsoletos, falta de evidencia de divulgacion o aprobacion.

## 12. Matriz de Peligros GTC-45

**Objetivo:** identificar peligros, valorar riesgos y definir controles segun GTC 45.

**Descripcion funcional:** matriz por proceso/actividad/cargo con peligros, efectos, controles existentes, valoracion y plan.

**Alcance:** peligros biologicos, fisicos, quimicos, biomecanicos, psicosociales, condiciones de seguridad y fenomenos naturales.

**Submodulos:** identificacion, valoracion, controles, aceptabilidad, versionamiento.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| hazard_matrices | Cabecera matriz | id, companyId, siteId, processId, version, status, approvedAt | Company, Site, Process | GET/POST/PUT/DELETE `/hazard-matrices` | Responsable SG-SST |
| hazards | Peligros identificados | id, matrixId, activityId, category, description, effects, exposedCount | Matrix, Activity | GET/POST/PUT/DELETE `/hazard-matrices/:id/hazards` | Responsable SG-SST, Lider de proceso |
| risk_assessments | Valoracion GTC 45 | id, hazardId, nd, ne, np, nc, nr, acceptability | Hazard | GET/POST/PUT `/hazards/:id/assessment` | Responsable SG-SST |

**Flujo:** seleccionar proceso -> identificar actividad -> registrar peligro -> valorar -> definir aceptabilidad -> crear intervenciones -> aprobar matriz.

**Reglas:** riesgo no aceptable exige plan; cambios en proceso/cargo obligan revision.

**Casos:** riesgo quimico en limpieza, biomecanico en cargue, caida en alturas.

**Reportes:** matriz GTC 45, riesgos altos, controles por jerarquia.

**KPIs:** % matriz actualizada, riesgos no aceptables, controles implementados.

**Notificaciones:** riesgo alto sin plan, matriz vencida, control vencido.

**Evidencias:** fotos, mediciones, actas, fichas de seguridad.

**Riesgo legal:** no identificar peligros ni valorar riesgos conforme SG-SST.

## 13. Evaluacion de Riesgos

**Objetivo:** profundizar la evaluacion y seguimiento de riesgos derivados de la matriz.

**Descripcion funcional:** consolida evaluaciones, reevaluaciones, criticidad, responsables y decisiones.

**Alcance:** evaluacion inicial, reevaluacion, riesgo residual, aceptacion, revision.

**Submodulos:** evaluacion inicial, residual, aprobacion, historial.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| risk_evaluations | Evaluaciones | id, hazardId, evaluationDate, inherentLevel, residualLevel, evaluatorId, status | Hazard, User | GET/POST/PUT/DELETE `/risk-evaluations` | Responsable SG-SST, Auditor |
| risk_controls | Controles | id, evaluationId, hierarchy, description, ownerId, dueDate, status | RiskEvaluation, User | GET/POST/PUT/DELETE `/risk-evaluations/:id/controls` | Responsable SG-SST, Lider de proceso |

**Flujo:** tomar peligro -> evaluar riesgo inherente -> asociar controles -> calcular residual -> aprobar -> seguimiento.

**Reglas:** jerarquia de controles obligatoria; residual alto requiere aprobacion gerencial.

**Casos:** medicion ruido, riesgo electrico, riesgo psicosocial.

**Reportes:** riesgo residual, controles por jerarquia, criticidad.

**KPIs:** riesgos residuales altos, controles eficaces.

**Notificaciones:** reevaluacion pendiente, control ineficaz.

**Evidencias:** mediciones, certificados, inspecciones.

**Riesgo legal:** controles insuficientes o no verificados.

## 14. Plan de Intervencion

**Objetivo:** convertir riesgos y hallazgos en acciones planificadas con responsables, fechas y evidencias.

**Descripcion funcional:** plan de controles e intervenciones priorizado por criticidad.

**Alcance:** acciones preventivas, correctivas, mejora, controles de ingenieria, administrativos, EPP.

**Submodulos:** priorizacion, responsables, seguimiento, eficacia.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| intervention_plans | Plan maestro | id, companyId, sourceType, sourceId, priority, status | Company | GET/POST/PUT/DELETE `/intervention-plans` | Responsable SG-SST |
| intervention_actions | Acciones | id, planId, description, hierarchy, ownerId, dueDate, status, effectiveness | Plan, User | GET/POST/PUT/DELETE `/intervention-plans/:id/actions` | Responsable SG-SST, Lider de proceso |

**Flujo:** generar plan desde riesgo/hallazgo -> asignar acciones -> cargar evidencias -> verificar eficacia -> cerrar.

**Reglas:** accion vencida escala a responsable y gerencia; cierre exige evidencia.

**Casos:** instalar guarda, capacitar, comprar EPP, rediseñar puesto.

**Reportes:** plan de intervencion, acciones vencidas, eficacia.

**KPIs:** cumplimiento plan, acciones vencidas, eficacia controles.

**Notificaciones:** vencimiento, evidencia rechazada, cierre pendiente.

**Evidencias:** fotos, facturas, actas, mediciones.

**Riesgo legal:** plan sin ejecucion ni seguimiento.

## 15. Inspecciones Planeadas

**Objetivo:** programar y ejecutar inspecciones preventivas periodicas.

**Descripcion funcional:** inspecciones con listas de chequeo, hallazgos, evidencias y acciones.

**Alcance:** locativas, EPP, equipos, herramientas, orden y aseo, emergencias.

**Submodulos:** programacion, checklists, ejecucion, hallazgos.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| planned_inspections | Inspecciones programadas | id, companyId, siteId, areaId, checklistId, scheduledAt, inspectorId, status | Company, Site, Area, User | GET/POST/PUT/DELETE `/planned-inspections` | Responsable SG-SST, COPASST |
| inspection_items | Respuestas | id, inspectionId, question, result, observation, evidenceId | Inspection, Evidence | GET/POST/PUT `/planned-inspections/:id/items` | Responsable SG-SST, COPASST |

**Flujo:** programar -> notificar inspector -> ejecutar checklist -> registrar hallazgos -> crear acciones -> cerrar.

**Reglas:** hallazgo critico crea accion inmediata; inspeccion vencida escala.

**Casos:** inspeccion mensual extintores, orden y aseo, herramientas.

**Reportes:** inspecciones ejecutadas, hallazgos por area, cumplimiento programa.

**KPIs:** cumplimiento inspecciones, hallazgos recurrentes, cierre de acciones.

**Notificaciones:** inspeccion proxima/vencida, hallazgo critico.

**Evidencias:** fotos, checklist firmado, acta.

**Riesgo legal:** falta de inspeccion y control preventivo.

## 16. Inspecciones No Planeadas

**Objetivo:** registrar inspecciones espontaneas por eventos, quejas, cambios o condiciones criticas.

**Descripcion funcional:** inspecciones reactivas sin programacion previa.

**Alcance:** visitas sorpresa, inspecciones por incidente, queja, autoridad o COPASST.

**Submodulos:** inspeccion rapida, hallazgos, acciones.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| unplanned_inspections | Inspecciones no planeadas | id, companyId, siteId, areaId, reason, inspectorId, date, status | Company, Site, Area | GET/POST/PUT/DELETE `/unplanned-inspections` | Responsable SG-SST, COPASST, Auditor |
| unplanned_findings | Hallazgos | id, inspectionId, type, severity, description, evidenceId | Inspection | GET/POST/PUT `/unplanned-inspections/:id/findings` | Responsable SG-SST, COPASST |

**Flujo:** iniciar inspeccion -> registrar motivo -> capturar evidencias -> crear hallazgos/acciones -> cerrar.

**Reglas:** motivo obligatorio; severidad critica exige accion inmediata.

**Casos:** visita COPASST por queja, inspeccion tras accidente.

**Reportes:** inspecciones reactivas, hallazgos repetitivos.

**KPIs:** hallazgos criticos, tiempo respuesta.

**Notificaciones:** accion inmediata, responsable asignado.

**Evidencias:** fotos, videos, testimonios.

**Riesgo legal:** omitir respuesta ante condiciones reportadas.

## 17. Actos Inseguros

**Objetivo:** reportar comportamientos que aumentan probabilidad de accidente.

**Descripcion funcional:** canal para reportar, clasificar, intervenir y cerrar actos inseguros.

**Alcance:** reportes anonimos/no anonimos, observaciones comportamentales, acciones.

**Submodulos:** reporte, clasificacion, intervencion, tendencia.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| unsafe_acts | Actos inseguros | id, companyId, siteId, areaId, reporterId, workerId, description, severity, status | Company, Worker | GET/POST/PUT/DELETE `/unsafe-acts` | Todos segun rol |
| unsafe_act_actions | Acciones | id, unsafeActId, action, ownerId, dueDate, status | UnsafeAct, User | GET/POST/PUT `/unsafe-acts/:id/actions` | Responsable SG-SST, Lider |

**Flujo:** reportar -> clasificar -> definir accion educativa/correctiva -> evidenciar -> cerrar.

**Reglas:** no usar como mecanismo disciplinario sin debido proceso; proteger reporter anonimo.

**Casos:** no usar EPP, retirar guarda, transitar por zona prohibida.

**Reportes:** actos por area, tendencia por tipo.

**KPIs:** actos reportados, reincidencia, tiempo cierre.

**Notificaciones:** acto critico, accion vencida.

**Evidencias:** foto, observacion, capacitacion.

**Riesgo legal:** cultura punitiva o falta de intervencion preventiva.

## 18. Condiciones Inseguras

**Objetivo:** reportar condiciones fisicas o ambientales peligrosas.

**Descripcion funcional:** canal de reporte y cierre de condiciones inseguras con evidencia y acciones.

**Alcance:** infraestructura, equipos, herramientas, orden, instalaciones, senalizacion.

**Submodulos:** reporte, priorizacion, correccion, verificacion.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| unsafe_conditions | Condiciones inseguras | id, companyId, siteId, areaId, reporterId, description, severity, status, evidenceId | Company, Site, Area | GET/POST/PUT/DELETE `/unsafe-conditions` | Todos segun rol |
| condition_actions | Acciones correctivas | id, conditionId, action, ownerId, dueDate, status | UnsafeCondition | GET/POST/PUT `/unsafe-conditions/:id/actions` | Responsable SG-SST, Lider |

**Flujo:** reportar condicion -> clasificar -> asignar responsable -> corregir -> verificar -> cerrar.

**Reglas:** condicion critica debe permitir bloqueo/aislamiento.

**Casos:** piso humedo, cable expuesto, extintor vencido.

**Reportes:** condiciones por sede, reincidencias.

**KPIs:** tiempo cierre, condiciones criticas abiertas.

**Notificaciones:** condicion critica, vencimiento accion.

**Evidencias:** foto antes/despues, orden de trabajo.

**Riesgo legal:** accidente prevenible por condicion conocida.

## 19. Accidentes de Trabajo

**Objetivo:** registrar y gestionar accidentes laborales desde ocurrencia hasta cierre.

**Descripcion funcional:** captura datos del evento, trabajador, lesion, atencion, reporte y seguimiento.

**Alcance:** accidente leve, grave, mortal; reporte ARL; evidencias; investigacion.

**Submodulos:** reporte inicial, FURAT, seguimiento medico, investigacion.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| work_accidents | Accidentes | id, companyId, workerId, date, place, severity, injuryType, bodyPart, status | Company, Worker | GET/POST/PUT/DELETE `/work-accidents` | Responsable SG-SST, Trabajador |
| accident_reports | Reportes oficiales | id, accidentId, reportType, sentAt, arlCaseNumber, evidenceId | Accident | GET/POST/PUT `/work-accidents/:id/reports` | Responsable SG-SST |

**Flujo:** reportar accidente -> clasificar -> atencion inicial -> reporte ARL -> investigacion -> acciones -> cierre.

**Reglas:** accidente grave/mortal dispara notificacion critica; fechas legales deben controlarse.

**Casos:** caida, corte, atrapamiento, accidente vial laboral.

**Reportes:** accidentalidad, accidentes graves, FURAT, analisis por causa.

**KPIs:** frecuencia, severidad, dias perdidos, tiempo reporte.

**Notificaciones:** accidente grave, reporte pendiente, investigacion vencida.

**Evidencias:** fotos, testimonios, atencion medica, FURAT.

**Riesgo legal:** reporte extemporaneo, investigacion incompleta, sanciones.

## 20. Incidentes de Trabajo

**Objetivo:** registrar eventos sin lesion que pudieron causar dano.

**Descripcion funcional:** reporta casi accidentes y eventos peligrosos para prevenir accidentes.

**Alcance:** near miss, evento peligroso, dano material, interrupcion.

**Submodulos:** reporte, analisis, acciones.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| work_incidents | Incidentes | id, companyId, reporterId, siteId, areaId, date, description, potentialSeverity, status | Company, User | GET/POST/PUT/DELETE `/work-incidents` | Trabajador, Responsable SG-SST |
| incident_actions | Acciones | id, incidentId, action, ownerId, dueDate, status | Incident | GET/POST/PUT `/work-incidents/:id/actions` | Responsable SG-SST |

**Flujo:** reportar -> evaluar potencial -> investigar si aplica -> acciones -> cierre.

**Reglas:** potencial alto se investiga como accidente.

**Casos:** objeto cae sin lesionar, fuga controlada, casi atropello.

**Reportes:** incidentes por tipo, potencial alto.

**KPIs:** incidentes reportados, conversion incidente/accidente.

**Notificaciones:** potencial alto, accion vencida.

**Evidencias:** fotos, videos, testimonios.

**Riesgo legal:** perder oportunidades preventivas y repeticion de eventos.

## 21. Investigacion de Accidentes

**Objetivo:** cumplir Resolucion 1401 con investigacion, causas y acciones.

**Descripcion funcional:** equipo investigador, metodologia causal, causas inmediatas/basicas, recomendaciones y cierre.

**Alcance:** accidentes e incidentes de alto potencial.

**Submodulos:** equipo investigador, entrevistas, causas, informe, plan de accion.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| accident_investigations | Investigacion | id, accidentId, leadId, startedAt, dueDate, status, methodology | Accident, User | GET/POST/PUT/DELETE `/accident-investigations` | Responsable SG-SST, COPASST |
| investigation_causes | Causas | id, investigationId, type, category, description | Investigation | GET/POST/PUT `/accident-investigations/:id/causes` | Responsable SG-SST, COPASST |
| investigation_team | Equipo | id, investigationId, userId, role | Investigation, User | GET/POST/DELETE `/accident-investigations/:id/team` | Responsable SG-SST |

**Flujo:** abrir investigacion -> conformar equipo -> recolectar evidencias -> analizar causas -> definir acciones -> aprobar informe -> cerrar.

**Reglas:** debe incluir COPASST cuando aplique; cierre exige acciones creadas.

**Casos:** accidente grave, evento repetitivo, incidente alto potencial.

**Reportes:** informe investigacion, causas recurrentes.

**KPIs:** investigaciones a tiempo, acciones derivadas cerradas.

**Notificaciones:** vencimiento investigacion, accion pendiente.

**Evidencias:** entrevistas, fotos, croquis, registros, informe firmado.

**Riesgo legal:** incumplir metodologia y plazos de investigacion.

## 22. Ausentismo

**Objetivo:** gestionar ausencias, incapacidades y analisis de causas.

**Descripcion funcional:** registro de incapacidades, origen, dias perdidos, diagnosticos agregados y tendencias.

**Alcance:** enfermedad comun, laboral, accidente, permisos, ausencias injustificadas.

**Submodulos:** incapacidades, diagnosticos, dias perdidos, reincorporacion.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| absences | Ausencias | id, workerId, type, startDate, endDate, days, origin, diagnosisGroup, status | Worker | GET/POST/PUT/DELETE `/absences` | Responsable SG-SST, Administrador |
| return_to_work | Reintegros | id, absenceId, restrictions, plan, reviewedAt, status | Absence | GET/POST/PUT `/absences/:id/return-to-work` | Responsable SG-SST |

**Flujo:** registrar ausencia -> validar soporte -> clasificar -> calcular dias -> plan reintegro si aplica -> cerrar.

**Reglas:** diagnostico sensible debe limitarse; ausencias largas disparan vigilancia.

**Casos:** incapacidad lumbar, accidente laboral, permiso medico.

**Reportes:** ausentismo mensual, causas principales, dias perdidos.

**KPIs:** tasa ausentismo, dias perdidos, reincidencia.

**Notificaciones:** incapacidad prolongada, reintegro pendiente.

**Evidencias:** incapacidad, recomendaciones medicas.

**Riesgo legal:** mal manejo de datos de salud o no adaptar restricciones.

## 23. Vigilancia Epidemiologica

**Objetivo:** monitorear grupos de riesgo y programas de vigilancia.

**Descripcion funcional:** programas para riesgo biomecanico, ruido, quimicos, psicosocial, visual, respiratorio, etc.

**Alcance:** cohortes, examenes, indicadores, casos, intervenciones.

**Submodulos:** programas PVE, cohortes, seguimiento, casos.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| epidemiological_programs | PVE | id, companyId, name, riskType, objective, status, ownerId | Company, User | GET/POST/PUT/DELETE `/epidemiological-programs` | Responsable SG-SST |
| pve_cases | Casos seguimiento | id, programId, workerId, caseStatus, findings, nextReviewAt | Program, Worker | GET/POST/PUT `/epidemiological-programs/:id/cases` | Responsable SG-SST |

**Flujo:** crear PVE -> definir poblacion -> asociar trabajadores -> hacer seguimiento -> intervenir -> evaluar resultados.

**Reglas:** PVE debe basarse en riesgos priorizados y resultados medicos.

**Casos:** PVE osteomuscular, auditivo, psicosocial.

**Reportes:** seguimiento PVE, casos activos, tendencias.

**KPIs:** cobertura PVE, casos controlados, examenes cumplidos.

**Notificaciones:** revision pendiente, caso critico.

**Evidencias:** informes medicos agregados, mediciones, intervenciones.

**Riesgo legal:** no prevenir enfermedad laboral.

## 24. Examenes Medicos

**Objetivo:** controlar examenes ocupacionales y conceptos de aptitud.

**Descripcion funcional:** ingreso, periodico, retiro, postincapacidad, cambio de cargo y restricciones.

**Alcance:** programacion, proveedor, concepto, restricciones, vencimientos.

**Submodulos:** ordenes, resultados, restricciones, profesiograma.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| medical_exams | Examenes | id, workerId, type, scheduledAt, performedAt, provider, aptitude, restrictions, expiresAt | Worker | GET/POST/PUT/DELETE `/medical-exams` | Responsable SG-SST |
| medical_restrictions | Restricciones | id, examId, workerId, description, startDate, endDate, status | Exam, Worker | GET/POST/PUT `/medical-exams/:id/restrictions` | Responsable SG-SST |

**Flujo:** programar -> emitir orden -> cargar concepto -> registrar restricciones -> seguimiento -> renovar/cerrar.

**Reglas:** no almacenar historia clinica completa; solo concepto ocupacional.

**Casos:** ingreso, periodico anual, reintegro.

**Reportes:** examenes vencidos, aptitud por cargo, restricciones activas.

**KPIs:** cobertura examenes, restricciones vencidas, examenes por realizar.

**Notificaciones:** examen proximo, restriccion por vencer.

**Evidencias:** concepto medico, orden, certificado.

**Riesgo legal:** exposicion de trabajador sin aptitud o manejo indebido de datos medicos.

## 25. Entrega de EPP

**Objetivo:** controlar entrega, firma, reposicion y devolucion de EPP.

**Descripcion funcional:** entrega individual de elementos segun cargo/riesgo con firma y evidencia.

**Alcance:** asignacion, tallas, periodicidad, reposicion, devolucion.

**Submodulos:** entrega, firma, reposicion, devolucion.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| ppe_deliveries | Entregas EPP | id, workerId, ppeItemId, quantity, deliveredAt, dueReplacementAt, signedByWorker, evidenceId | Worker, PPEItem | GET/POST/PUT/DELETE `/ppe-deliveries` | Responsable SG-SST, Trabajador |
| ppe_returns | Devoluciones | id, deliveryId, returnedAt, condition, observation | Delivery | GET/POST/PUT `/ppe-deliveries/:id/returns` | Responsable SG-SST |

**Flujo:** seleccionar trabajador -> elegir EPP requerido -> entregar -> firmar -> programar reposicion -> cerrar/devolver.

**Reglas:** EPP critico requiere firma; reposicion segun vida util o deterioro.

**Casos:** casco, gafas, guantes, respirador.

**Reportes:** entregas por trabajador, reposiciones vencidas.

**KPIs:** cobertura EPP, reposiciones vencidas.

**Notificaciones:** reposicion proxima, firma pendiente.

**Evidencias:** firma, foto, acta entrega.

**Riesgo legal:** no demostrar suministro de EPP.

## 26. Inventario EPP

**Objetivo:** administrar existencias, fichas tecnicas y vida util de EPP.

**Descripcion funcional:** catalogo de EPP, stock, lote, proveedor, certificaciones y vencimientos.

**Alcance:** inventario, movimientos, stock minimo, vencimientos.

**Submodulos:** catalogo, stock, movimientos, proveedores.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| ppe_items | Catalogo EPP | id, companyId, name, type, standard, usefulLifeDays, stockMin | Company | GET/POST/PUT/DELETE `/ppe-items` | Responsable SG-SST |
| ppe_inventory_movements | Movimientos | id, ppeItemId, type, quantity, date, reference | PPEItem | GET/POST `/ppe-items/:id/movements` | Responsable SG-SST |

**Flujo:** crear item -> registrar compra/stock -> entregar -> descontar -> alertar stock minimo.

**Reglas:** no entregar si no hay stock; EPP vencido no disponible.

**Casos:** compra de guantes, reposicion de respiradores.

**Reportes:** stock, consumo, vencimientos.

**KPIs:** stock critico, consumo mensual, vencidos.

**Notificaciones:** stock bajo, lote vencido.

**Evidencias:** ficha tecnica, certificado, factura.

**Riesgo legal:** EPP inadecuado o sin certificacion.

## 27. Capacitaciones

**Objetivo:** planear, ejecutar y evidenciar formacion SG-SST.

**Descripcion funcional:** plan de capacitacion por cargo/riesgo, sesiones, asistencia y certificados.

**Alcance:** induccion, reinduccion, capacitaciones obligatorias, entrenamiento especifico.

**Submodulos:** plan, sesiones, asistencia, certificados.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| trainings | Capacitaciones | id, companyId, title, topic, date, instructor, status | Company | GET/POST/PUT/DELETE `/trainings` | Responsable SG-SST |
| training_attendance | Asistencia | id, trainingId, workerId, attended, score, signedAt | Training, Worker | GET/POST/PUT `/trainings/:id/attendance` | Responsable SG-SST, Trabajador |

**Flujo:** crear plan -> programar sesion -> convocar -> registrar asistencia/evaluacion -> emitir certificado.

**Reglas:** induccion obligatoria al ingreso; capacitacion critica requiere evaluacion.

**Casos:** alturas, EPP, emergencias, induccion.

**Reportes:** cobertura capacitacion, asistencia, certificados.

**KPIs:** cobertura, aprobacion, vencimientos.

**Notificaciones:** convocatoria, ausencia, certificado vencido.

**Evidencias:** lista asistencia, evaluacion, certificado.

**Riesgo legal:** trabajador sin formacion para riesgo expuesto.

## 28. Evaluaciones

**Objetivo:** medir comprension y eficacia de capacitaciones o competencias.

**Descripcion funcional:** cuestionarios, resultados, intentos, aprobacion y retroalimentacion.

**Alcance:** evaluaciones teoricas, practicas y de eficacia.

**Submodulos:** banco preguntas, evaluaciones, resultados.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| assessments | Evaluaciones | id, companyId, trainingId, title, passingScore, status | Company, Training | GET/POST/PUT/DELETE `/assessments` | Responsable SG-SST |
| assessment_results | Resultados | id, assessmentId, workerId, score, passed, completedAt | Assessment, Worker | GET/POST `/assessments/:id/results` | Trabajador, Responsable SG-SST |

**Flujo:** crear evaluacion -> asignar -> responder -> calificar -> aprobar/reentrenar.

**Reglas:** no aprobar capacitacion critica sin puntaje minimo.

**Casos:** examen induccion, prueba de alturas.

**Reportes:** resultados, reprobados, eficacia.

**KPIs:** tasa aprobacion, promedio puntaje.

**Notificaciones:** evaluacion pendiente, reprobacion.

**Evidencias:** respuestas, certificado, firma.

**Riesgo legal:** capacitacion sin validacion de aprendizaje.

## 29. Competencias

**Objetivo:** controlar competencias, licencias y certificaciones por cargo.

**Descripcion funcional:** matriz de competencias requeridas vs cumplidas.

**Alcance:** habilidades, certificados, licencias, experiencia, reentrenamientos.

**Submodulos:** matriz, brechas, certificaciones.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| competencies | Competencias | id, companyId, name, type, validityDays, requiredEvidence | Company | GET/POST/PUT/DELETE `/competencies` | Responsable SG-SST |
| worker_competencies | Competencias trabajador | id, workerId, competencyId, achievedAt, expiresAt, status, evidenceId | Worker, Competency | GET/POST/PUT/DELETE `/workers/:id/competencies` | Responsable SG-SST |

**Flujo:** definir competencia -> asignar a cargo -> cargar certificado -> validar -> alertar vencimiento.

**Reglas:** cargo critico no habilitado sin competencia vigente.

**Casos:** licencia conduccion, coordinador alturas, montacargas.

**Reportes:** brechas por cargo, vencimientos.

**KPIs:** competencias vigentes, brechas criticas.

**Notificaciones:** certificado por vencer, competencia faltante.

**Evidencias:** certificados, licencias, diplomas.

**Riesgo legal:** ejecucion de tareas criticas por personal no competente.

## 30. COPASST

**Objetivo:** gestionar conformacion, reuniones, compromisos y participacion del COPASST.

**Descripcion funcional:** miembros, periodos, actas, reuniones, recomendaciones y seguimiento.

**Alcance:** eleccion, comite, actas, compromisos, inspecciones, investigaciones.

**Submodulos:** miembros, elecciones, reuniones, compromisos.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| copasst_committees | COPASST | id, companyId, periodStart, periodEnd, status | Company | GET/POST/PUT/DELETE `/copasst` | Responsable SG-SST |
| copasst_members | Miembros | id, committeeId, workerId, representation, role | Committee, Worker | GET/POST/PUT/DELETE `/copasst/:id/members` | Responsable SG-SST |
| copasst_meetings | Reuniones | id, committeeId, date, agenda, minutesEvidenceId | Committee | GET/POST/PUT/DELETE `/copasst/:id/meetings` | COPASST, Responsable SG-SST |

**Flujo:** crear periodo -> registrar miembros -> programar reuniones -> levantar actas -> crear compromisos -> cerrar.

**Reglas:** reuniones periodicas obligatorias; acta requerida para cierre.

**Casos:** reunion mensual, participacion en investigacion.

**Reportes:** actas COPASST, compromisos, asistencia.

**KPIs:** reuniones cumplidas, compromisos cerrados.

**Notificaciones:** reunion proxima, compromiso vencido.

**Evidencias:** actas, votaciones, firmas.

**Riesgo legal:** incumplir participacion de trabajadores.

## 31. Comite de Convivencia

**Objetivo:** gestionar convivencia laboral, reuniones y casos de acoso.

**Descripcion funcional:** comite, miembros, quejas, tratamiento confidencial, compromisos.

**Alcance:** conformacion, reuniones, casos, seguimiento, confidencialidad.

**Submodulos:** miembros, reuniones, casos, medidas.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| coexistence_committees | Comite convivencia | id, companyId, periodStart, periodEnd, status | Company | GET/POST/PUT/DELETE `/coexistence-committee` | Responsable SG-SST |
| coexistence_cases | Casos | id, committeeId, reporterId, involvedId, type, status, confidentialCode | Committee, Worker | GET/POST/PUT `/coexistence-committee/cases` | Responsable SG-SST, Comite |
| coexistence_meetings | Reuniones | id, committeeId, date, minutesEvidenceId | Committee | GET/POST/PUT `/coexistence-committee/:id/meetings` | Comite |

**Flujo:** conformar comite -> recibir caso -> evaluar confidencialmente -> definir medidas -> seguimiento -> cierre.

**Reglas:** acceso restringido; datos sensibles cifrados o minimizados.

**Casos:** queja de acoso, conflicto interpersonal.

**Reportes:** casos anonimizados, reuniones, compromisos.

**KPIs:** tiempo atencion, casos cerrados.

**Notificaciones:** reunion/caso solo a autorizados.

**Evidencias:** actas confidenciales, compromisos.

**Riesgo legal:** vulnerar confidencialidad o no atender quejas.

## 32. Brigadas de Emergencia

**Objetivo:** administrar brigadistas, roles, formacion y dotacion.

**Descripcion funcional:** brigada por sede, miembros, competencias, equipos y ejercicios.

**Alcance:** primeros auxilios, evacuacion, contra incendio, rescate.

**Submodulos:** miembros, roles, dotacion, entrenamiento.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| emergency_brigades | Brigadas | id, companyId, siteId, name, status | Company, Site | GET/POST/PUT/DELETE `/emergency-brigades` | Responsable SG-SST |
| brigade_members | Brigadistas | id, brigadeId, workerId, role, certifiedUntil | Brigade, Worker | GET/POST/PUT/DELETE `/emergency-brigades/:id/members` | Responsable SG-SST |

**Flujo:** crear brigada -> asignar miembros -> capacitar -> dotar -> participar simulacros.

**Reglas:** sede activa debe tener cobertura brigada segun riesgo.

**Casos:** brigada evacuacion planta, primeros auxilios oficina.

**Reportes:** brigadistas vigentes, competencias vencidas.

**KPIs:** cobertura brigada, certificaciones vigentes.

**Notificaciones:** certificado brigadista vencido.

**Evidencias:** actas, certificados, listados.

**Riesgo legal:** respuesta insuficiente ante emergencias.

## 33. Plan de Emergencias

**Objetivo:** gestionar planes, amenazas, recursos y procedimientos de emergencia.

**Descripcion funcional:** plan por sede con amenazas, rutas, recursos, brigadas y actualizaciones.

**Alcance:** analisis vulnerabilidad, rutas, recursos, protocolos, divulgacion.

**Submodulos:** amenazas, recursos, procedimientos, divulgacion.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| emergency_plans | Plan emergencia | id, companyId, siteId, version, status, approvedAt, expiresAt | Company, Site | GET/POST/PUT/DELETE `/emergency-plans` | Responsable SG-SST |
| emergency_resources | Recursos | id, planId, type, location, quantity, status | Plan | GET/POST/PUT/DELETE `/emergency-plans/:id/resources` | Responsable SG-SST |

**Flujo:** crear plan -> identificar amenazas -> definir recursos/rutas -> aprobar -> divulgar -> probar en simulacro.

**Reglas:** plan vencido genera alerta; cambios locativos exigen actualizacion.

**Casos:** incendio, sismo, derrame, evacuacion.

**Reportes:** plan por sede, recursos criticos.

**KPIs:** planes vigentes, recursos inspeccionados.

**Notificaciones:** plan por vencer, recurso no conforme.

**Evidencias:** documento plan, planos, actas divulgacion.

**Riesgo legal:** falta de preparacion ante emergencias.

## 34. Simulacros

**Objetivo:** planear, ejecutar y evaluar simulacros.

**Descripcion funcional:** programa simulacros, participantes, tiempos, hallazgos y acciones.

**Alcance:** evacuacion, incendio, primeros auxilios, derrames, rescate.

**Submodulos:** planificacion, ejecucion, evaluacion, acciones.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| emergency_drills | Simulacros | id, companyId, siteId, scenario, scheduledAt, executedAt, status | Company, Site | GET/POST/PUT/DELETE `/emergency-drills` | Responsable SG-SST |
| drill_results | Resultados | id, drillId, evacuationTime, participants, findings, score | Drill | GET/POST/PUT `/emergency-drills/:id/results` | Responsable SG-SST |

**Flujo:** programar -> notificar -> ejecutar -> medir -> registrar hallazgos -> acciones -> cierre.

**Reglas:** simulacro debe generar informe y acciones si hay fallas.

**Casos:** simulacro evacuacion anual, derrame quimico.

**Reportes:** informe simulacro, tiempos evacuacion.

**KPIs:** cumplimiento simulacros, tiempo evacuacion, hallazgos.

**Notificaciones:** simulacro proximo, informe pendiente.

**Evidencias:** fotos, listado asistencia, informe.

**Riesgo legal:** no probar preparacion ante emergencias.

## 35. Gestion Ambiental

**Objetivo:** controlar aspectos ambientales relacionados con SST y operacion.

**Descripcion funcional:** gestion de residuos, sustancias, derrames, permisos y controles ambientales.

**Alcance:** residuos peligrosos, quimicos, emisiones, vertimientos, incidentes ambientales.

**Submodulos:** aspectos, residuos, sustancias, incidentes.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| environmental_aspects | Aspectos ambientales | id, companyId, processId, aspect, impact, significance, controls | Company, Process | GET/POST/PUT/DELETE `/environmental-aspects` | Responsable SG-SST |
| waste_records | Residuos | id, companyId, type, quantity, date, disposalProvider, evidenceId | Company | GET/POST/PUT/DELETE `/waste-records` | Responsable SG-SST |
| chemical_substances | Sustancias | id, companyId, name, cas, sdsUrl, hazardClass, storageLocation | Company | GET/POST/PUT/DELETE `/chemical-substances` | Responsable SG-SST |

**Flujo:** identificar aspecto -> valorar impacto -> definir control -> registrar residuos/sustancias -> seguimiento.

**Reglas:** sustancia peligrosa requiere hoja de seguridad y controles.

**Casos:** manejo solventes, disposicion residuos biosanitarios.

**Reportes:** sustancias peligrosas, residuos, incidentes ambientales.

**KPIs:** residuos gestionados, sustancias con SDS, incidentes.

**Notificaciones:** SDS vencida, permiso/evidencia pendiente.

**Evidencias:** manifiestos, SDS, certificados disposicion.

**Riesgo legal:** sanciones ambientales y afectacion a salud.

## 36. Auditorias Internas

**Objetivo:** planear y ejecutar auditorias SG-SST.

**Descripcion funcional:** auditorias por norma, proceso, sede o requisito, con hallazgos y acciones.

**Alcance:** programa auditoria, listas, entrevistas, evidencias, informes.

**Submodulos:** programa, auditorias, checklists, informes.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| internal_audits | Auditorias | id, companyId, scope, auditorId, scheduledAt, status, result | Company, User | GET/POST/PUT/DELETE `/internal-audits` | Auditor, Responsable SG-SST |
| audit_checklist_items | Items | id, auditId, requirementCode, question, result, evidenceId | Audit | GET/POST/PUT `/internal-audits/:id/items` | Auditor |

**Flujo:** programar -> preparar checklist -> ejecutar -> registrar evidencias -> emitir informe -> crear hallazgos.

**Reglas:** auditor no debe auditar su propio proceso cuando aplique independencia.

**Casos:** auditoria anual SG-SST, auditoria ISO 45001.

**Reportes:** informe auditoria, cumplimiento por requisito.

**KPIs:** auditorias ejecutadas, hallazgos por severidad.

**Notificaciones:** auditoria proxima, informe pendiente.

**Evidencias:** checklist, entrevistas, documentos, informe.

**Riesgo legal:** no verificar funcionamiento del SG-SST.

## 37. Hallazgos

**Objetivo:** registrar no conformidades, observaciones y oportunidades.

**Descripcion funcional:** hallazgos con severidad, fuente, causa, responsable y acciones.

**Alcance:** auditorias, inspecciones, incidentes, indicadores, quejas.

**Submodulos:** clasificacion, causas, acciones, cierre.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| findings | Hallazgos | id, companyId, sourceType, sourceId, type, severity, description, status | Company | GET/POST/PUT/DELETE `/findings` | Auditor, Responsable SG-SST |
| finding_causes | Causas | id, findingId, causeType, description | Finding | GET/POST/PUT `/findings/:id/causes` | Responsable SG-SST |

**Flujo:** registrar hallazgo -> clasificar -> analizar causa -> asignar acciones -> verificar cierre.

**Reglas:** no conformidad mayor requiere accion correctiva y verificacion de eficacia.

**Casos:** documento vencido, ausencia de matriz, accion incumplida.

**Reportes:** hallazgos abiertos, tendencias.

**KPIs:** hallazgos por severidad, tiempo cierre.

**Notificaciones:** hallazgo critico, cierre vencido.

**Evidencias:** soporte del hallazgo, analisis causa.

**Riesgo legal:** no corregir desviaciones del sistema.

## 38. Acciones Correctivas

**Objetivo:** eliminar causas de no conformidades o eventos.

**Descripcion funcional:** acciones con causa raiz, responsable, fecha, evidencia y eficacia.

**Alcance:** derivadas de accidentes, auditorias, inspecciones, indicadores.

**Submodulos:** plan, ejecucion, verificacion eficacia.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| corrective_actions | Correctivas | id, companyId, sourceType, sourceId, rootCause, action, ownerId, dueDate, status, effectiveness | Company, User | GET/POST/PUT/DELETE `/corrective-actions` | Responsable SG-SST, Lider |

**Flujo:** crear desde hallazgo/evento -> ejecutar -> cargar evidencia -> verificar eficacia -> cerrar.

**Reglas:** cierre exige evidencia y verificacion independiente cuando sea critica.

**Casos:** corregir causa de accidente, no conformidad auditoria.

**Reportes:** correctivas vencidas, eficacia.

**KPIs:** % cierre a tiempo, reincidencia.

**Notificaciones:** vencimiento, eficacia pendiente.

**Evidencias:** fotos, documentos, mediciones.

**Riesgo legal:** reincidencia por no eliminar causa raiz.

## 39. Acciones Preventivas

**Objetivo:** evitar materializacion de riesgos o desviaciones potenciales.

**Descripcion funcional:** acciones antes de evento, originadas en riesgos, tendencias o observaciones.

**Alcance:** riesgos potenciales, mejoras preventivas, recomendaciones COPASST.

**Submodulos:** origen, plan, seguimiento.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| preventive_actions | Preventivas | id, companyId, sourceType, sourceId, description, ownerId, dueDate, status | Company, User | GET/POST/PUT/DELETE `/preventive-actions` | Responsable SG-SST, COPASST |

**Flujo:** identificar potencial -> crear accion -> ejecutar -> validar -> cerrar.

**Reglas:** accion preventiva no requiere no conformidad previa.

**Casos:** reforzar capacitacion antes de temporada alta.

**Reportes:** preventivas por origen, cumplimiento.

**KPIs:** preventivas cerradas, eventos evitados.

**Notificaciones:** vencimiento accion.

**Evidencias:** actas, fotos, registros.

**Riesgo legal:** gestion reactiva, no preventiva.

## 40. Acciones de Mejora

**Objetivo:** elevar desempeno SG-SST mas alla del cumplimiento minimo.

**Descripcion funcional:** iniciativas de mejora continua con impacto y beneficios esperados.

**Alcance:** optimizacion procesos, digitalizacion, cultura, indicadores.

**Submodulos:** ideas, priorizacion, ejecucion, beneficios.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| improvement_actions | Mejoras | id, companyId, idea, expectedBenefit, ownerId, dueDate, status, result | Company, User | GET/POST/PUT/DELETE `/improvement-actions` | Responsable SG-SST, Lider, COPASST |

**Flujo:** proponer mejora -> evaluar -> aprobar -> ejecutar -> medir resultado -> cerrar.

**Reglas:** mejora debe tener beneficio esperado y resultado.

**Casos:** digitalizar inspecciones, mejorar senalizacion.

**Reportes:** mejoras implementadas, beneficios.

**KPIs:** mejoras cerradas, impacto.

**Notificaciones:** aprobacion/vencimiento.

**Evidencias:** antes/despues, actas.

**Riesgo legal:** estancamiento del ciclo PHVA.

## 41. Indicadores KPI

**Objetivo:** medir estructura, proceso y resultado del SG-SST.

**Descripcion funcional:** catalogo de indicadores con formula, fuente, meta, frecuencia y resultados.

**Alcance:** indicadores legales, gerenciales, operativos, por empresa/sede/proceso.

**Submodulos:** catalogo, mediciones, metas, tableros.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| kpi_definitions | Definicion KPI | id, companyId, code, name, type, formula, frequency, target | Company | GET/POST/PUT/DELETE `/kpis` | Responsable SG-SST |
| kpi_measurements | Mediciones | id, kpiId, period, numerator, denominator, value, status | KPI | GET/POST/PUT `/kpis/:id/measurements` | Responsable SG-SST |

**Flujo:** definir KPI -> configurar formula -> capturar datos -> calcular -> aprobar corte -> reportar.

**Reglas:** KPI legal debe conservar historico; cambios de formula versionados.

**Casos:** frecuencia accidentalidad, severidad, cumplimiento plan.

**Reportes:** indicadores mensuales, tendencia anual.

**KPIs:** modulo mide todos los KPI definidos.

**Notificaciones:** corte pendiente, meta incumplida.

**Evidencias:** corte, fuente de datos, aprobacion.

**Riesgo legal:** no medir resultados del SG-SST.

## 42. Objetivos SG-SST

**Objetivo:** definir objetivos, metas, responsables y seguimiento.

**Descripcion funcional:** objetivos alineados a politica SST, indicadores y plan anual.

**Alcance:** objetivos anuales, metas, avance, cierre.

**Submodulos:** definicion, metas, seguimiento.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| sgsst_objectives | Objetivos | id, companyId, year, objective, target, ownerId, status | Company, User | GET/POST/PUT/DELETE `/sgsst-objectives` | Responsable SG-SST, Administrador |
| objective_progress | Avances | id, objectiveId, date, progress, evidenceId, comments | Objective | GET/POST/PUT `/sgsst-objectives/:id/progress` | Responsable SG-SST |

**Flujo:** definir objetivo -> asociar KPI -> planear actividades -> registrar avances -> evaluar cierre.

**Reglas:** objetivo debe ser medible y tener responsable.

**Casos:** reducir accidentalidad, aumentar cobertura capacitacion.

**Reportes:** avance objetivos, objetivos incumplidos.

**KPIs:** cumplimiento objetivos.

**Notificaciones:** avance pendiente, meta en riesgo.

**Evidencias:** actas, mediciones, informes.

**Riesgo legal:** politica y objetivos no gestionados.

## 43. Plan Anual de Trabajo

**Objetivo:** planear actividades SG-SST anuales con recursos, responsables y seguimiento.

**Descripcion funcional:** cronograma anual por ciclo PHVA, actividad, responsable, presupuesto y evidencia.

**Alcance:** actividades, metas, recursos, ejecucion, cierre.

**Submodulos:** planeacion, cronograma, presupuesto, seguimiento.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| annual_work_plans | Plan anual | id, companyId, year, approvedBy, approvedAt, status | Company, User | GET/POST/PUT/DELETE `/annual-work-plans` | Responsable SG-SST |
| annual_plan_activities | Actividades | id, planId, cycle, activity, ownerId, dueDate, budget, status, evidenceId | Plan, User | GET/POST/PUT/DELETE `/annual-work-plans/:id/activities` | Responsable SG-SST, Lider |

**Flujo:** crear plan -> aprobar -> ejecutar actividades -> cargar evidencias -> medir cumplimiento -> cierre anual.

**Reglas:** plan debe cubrir requisitos minimos y riesgos priorizados.

**Casos:** plan 2026, seguimiento mensual.

**Reportes:** plan anual, avance mensual, presupuesto.

**KPIs:** cumplimiento plan, actividades vencidas.

**Notificaciones:** actividad proxima/vencida.

**Evidencias:** actas, documentos, registros.

**Riesgo legal:** ausencia de plan anual exigido.

## 44. Estandares Minimos Resolucion 0312

**Objetivo:** evaluar cumplimiento de estandares minimos SG-SST.

**Descripcion funcional:** checklist parametrizado por tamano/riesgo, puntaje, evidencias y plan de mejora.

**Alcance:** autoevaluacion, auditoria, plan mejora, historico.

**Submodulos:** catalogo estandares, evaluacion, evidencias, plan mejora.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| minimum_standard_items | Catalogo 0312 | id, code, cycle, criterion, maxScore, appliesByCompanyType | System | GET `/minimum-standards/items` | Todos consulta |
| minimum_standard_assessments | Evaluaciones | id, companyId, year, evaluatorId, score, level, status | Company, User | GET/POST/PUT/DELETE `/minimum-standards/assessments` | Responsable SG-SST, Auditor |
| minimum_standard_answers | Respuestas | id, assessmentId, itemId, score, observation, evidenceId | Assessment, Item | GET/POST/PUT `/minimum-standards/assessments/:id/answers` | Responsable SG-SST, Auditor |

**Flujo:** crear evaluacion -> cargar criterios aplicables -> responder con evidencia -> calcular puntaje -> plan mejora -> cierre.

**Reglas:** puntaje bajo exige plan de mejora; criterio no aplica requiere justificacion.

**Casos:** autoevaluacion anual, auditoria ARL.

**Reportes:** resultado 0312, plan mejora, brechas.

**KPIs:** puntaje global, avance plan mejora.

**Notificaciones:** evaluacion anual pendiente, evidencia faltante.

**Evidencias:** documentos, registros, actas, fotos.

**Riesgo legal:** incumplir estandares minimos y no contar con plan de mejora.

## 45. Gestion del Cambio

**Objetivo:** evaluar impactos SG-SST ante cambios organizacionales, tecnicos o locativos.

**Descripcion funcional:** solicitud, evaluacion de riesgos, aprobaciones, acciones y cierre.

**Alcance:** cambios de proceso, tecnologia, sede, equipos, sustancias, personal.

**Submodulos:** solicitud, evaluacion, aprobacion, acciones.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| change_requests | Solicitudes cambio | id, companyId, requesterId, type, description, impact, status | Company, User | GET/POST/PUT/DELETE `/change-requests` | Responsable SG-SST, Lider |
| change_risk_reviews | Revision riesgos | id, changeId, reviewerId, risks, controls, approved | ChangeRequest | GET/POST/PUT `/change-requests/:id/risk-review` | Responsable SG-SST |

**Flujo:** solicitar cambio -> evaluar impactos -> definir controles -> aprobar -> ejecutar -> verificar -> cerrar.

**Reglas:** cambio no puede ejecutarse sin evaluacion SG-SST si afecta riesgos.

**Casos:** nueva maquina, cambio quimico, remodelacion.

**Reportes:** cambios abiertos, cambios sin evaluacion.

**KPIs:** cambios evaluados, acciones por cambio.

**Notificaciones:** aprobacion pendiente, control vencido.

**Evidencias:** solicitud, analisis, aprobaciones.

**Riesgo legal:** introducir peligros sin control.

## 46. Tareas

**Objetivo:** centralizar tareas derivadas de modulos SG-SST.

**Descripcion funcional:** bandeja de tareas con responsable, fecha, prioridad, origen y evidencias.

**Alcance:** tareas automaticas y manuales, vencimientos, reasignacion.

**Submodulos:** bandeja, asignacion, seguimiento, escalamiento.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| tasks | Tareas | id, companyId, sourceType, sourceId, title, ownerId, dueDate, priority, status | Company, User | GET/POST/PUT/DELETE `/tasks` | Todos segun alcance |
| task_comments | Comentarios | id, taskId, userId, comment, createdAt | Task, User | GET/POST `/tasks/:id/comments` | Todos segun alcance |

**Flujo:** crear/asignar -> notificar -> ejecutar -> cargar evidencia -> aprobar/cerrar.

**Reglas:** tarea vencida escala; cierre puede requerir aprobador.

**Casos:** cargar evidencia, corregir hallazgo, asistir capacitacion.

**Reportes:** tareas vencidas, carga por responsable.

**KPIs:** cumplimiento tareas, vencidas, promedio cierre.

**Notificaciones:** asignacion, recordatorio, vencimiento.

**Evidencias:** archivos, comentarios, firmas.

**Riesgo legal:** acciones sin seguimiento verificable.

## 47. Notificaciones

**Objetivo:** informar eventos, vencimientos y alertas SG-SST.

**Descripcion funcional:** notificaciones internas y externas por email/WhatsApp con reintentos.

**Alcance:** bandeja, lectura, canales, plantillas, entregas externas.

**Submodulos:** internas, plantillas, canales, entregas, reintentos.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| notifications | Notificaciones internas | id, userId, companyId, title, message, priority, read | User, Company | GET/PATCH `/notifications` | Todos |
| external_deliveries | Entregas externas | id, provider, status, target, payload, response, error, attemptCount | Company, Notification | GET `/notifications/external-deliveries`, POST retry | Administrador |
| notification_templates | Plantillas | id, key, channel, subject, body, active | System/Company | GET/POST/PUT/DELETE `/notification-templates` | Administrador |

**Flujo:** evento -> crear notificacion -> enviar canal externo si aplica -> registrar entrega -> reintentar fallas -> cerrar.

**Reglas:** alertas criticas usan prioridad alta; no enviar datos sensibles por canales no seguros.

**Casos:** documento vencido, accion critica, WhatsApp alerta reporte.

**Reportes:** entregas fallidas, notificaciones por tipo.

**KPIs:** tasa entrega, fallos por proveedor, tiempo notificacion.

**Notificaciones:** este modulo genera todas.

**Evidencias:** log entrega, respuesta proveedor.

**Riesgo legal:** no informar oportunamente o exponer datos sensibles.

## 48. Evidencias Multimedia

**Objetivo:** almacenar evidencias en fotos, videos, documentos y audio.

**Descripcion funcional:** repositorio transversal de evidencias asociado a cualquier modulo.

**Alcance:** carga, metadatos, geolocalizacion, hash, firma, retencion.

**Submodulos:** carga, visor, versionado, integridad.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| evidences | Evidencias | id, companyId, entity, entityId, fileUrl, mimeType, hash, uploadedBy, capturedAt | Company, User | GET/POST/PUT/DELETE `/evidences` | Todos segun alcance |
| evidence_metadata | Metadatos | id, evidenceId, key, value | Evidence | GET/POST/PUT `/evidences/:id/metadata` | Responsable SG-SST |

**Flujo:** capturar/cargar -> asociar entidad -> calcular hash -> validar -> usar en cierre/reporte.

**Reglas:** evidencia critica no debe eliminarse, solo anularse; conservar hash.

**Casos:** foto inspeccion, video incidente, acta firmada.

**Reportes:** evidencias por modulo, evidencias faltantes.

**KPIs:** evidencias cargadas, evidencias rechazadas.

**Notificaciones:** evidencia requerida, evidencia rechazada.

**Evidencias:** el archivo mismo y metadatos.

**Riesgo legal:** perdida o manipulacion de soportes.

## 49. Firma Electronica

**Objetivo:** firmar documentos, actas, entregas y aprobaciones.

**Descripcion funcional:** firma simple o integrada con proveedor, trazabilidad, certificado y hash.

**Alcance:** firma interna, OTP, proveedor externo, certificados.

**Submodulos:** solicitudes, firmantes, certificados, validacion.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| signature_requests | Solicitudes firma | id, companyId, entity, entityId, status, expiresAt | Company | GET/POST/PUT/DELETE `/signature-requests` | Responsable SG-SST |
| signatures | Firmas | id, requestId, signerId, signedAt, method, hash, certificateUrl | Request, User | GET/POST `/signature-requests/:id/signatures` | Todos segun solicitud |

**Flujo:** solicitar firma -> notificar firmante -> autenticar -> firmar -> guardar hash/certificado -> cerrar.

**Reglas:** firma debe vincular identidad, fecha, IP/metodo y hash documento.

**Casos:** entrega EPP, acta COPASST, politica SST.

**Reportes:** firmas pendientes, documentos firmados.

**KPIs:** solicitudes vencidas, tiempo firma.

**Notificaciones:** firma pendiente, vencimiento.

**Evidencias:** certificado, hash, documento firmado.

**Riesgo legal:** desconocimiento de firmas o falta de prueba de aceptacion.

## 50. Reportes Gerenciales

**Objetivo:** generar reportes ejecutivos, legales y operativos.

**Descripcion funcional:** reportes PDF/Excel/CSV programados y bajo demanda, con historial y trazabilidad.

**Alcance:** gerenciales, legales, auditoria, indicadores, cumplimiento.

**Submodulos:** generador, programacion, historial, metricas, alertas.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| report_exports | Exportaciones | id, companyId, requestedById, kind, format, status, fileUrl, expiresAt | Company, User | GET `/reports/exports`, POST schedule/retry | Administrador, Responsable SG-SST, Auditor |
| report_templates | Plantillas reporte | id, key, name, format, queryConfig, active | System/Company | GET/POST/PUT/DELETE `/report-templates` | Administrador |
| report_metric_snapshots | Metricas reportes | id, companyId, date, total, failed, storageBytes | Company | GET `/reports/metrics/history` | Administrador |

**Flujo:** seleccionar reporte -> aplicar filtros -> generar/enqueue -> notificar -> descargar -> expirar/retener.

**Reglas:** descarga se audita; reportes sensibles respetan alcance por rol.

**Casos:** informe gerencial mensual, autoevaluacion 0312, accidentalidad.

**Reportes:** todos los informes del sistema.

**KPIs:** reportes fallidos, tiempo generacion, almacenamiento.

**Notificaciones:** reporte listo/fallido, umbral almacenamiento.

**Evidencias:** archivo generado, auditoria descarga.

**Riesgo legal:** reportes incompletos o sin trazabilidad.

## 51. Mapa Normativo SG-SST

**Objetivo:** conectar cada requisito legal SG-SST con los modulos del sistema, evidencias requeridas, responsables, vencimientos, indicadores, acciones y estado de cumplimiento.

**Descripcion funcional:** matriz maestra de cumplimiento normativo. Debe funcionar como el eje de trazabilidad entre Decreto 1072 de 2015, Resolucion 0312 de 2019, Ley 1562 de 2012, Resolucion 1401 de 2007, Resolucion 2013 de 1986, Resolucion 2646 de 2008, Resolucion 2400 de 1979, GTC 45, ISO 45001:2018 y la operacion diaria del SG-SST.

**Alcance:** inventario normativo, requisitos aplicables, obligaciones por empresa, evidencias, responsables, fechas de revision, alertas, estado de cumplimiento, brechas, planes de accion y reportes legales.

**Submodulos:**

- Catalogo normativo.
- Requisitos legales.
- Aplicabilidad por empresa.
- Matriz requisito-modulo-evidencia.
- Obligaciones periodicas.
- Seguimiento de cumplimiento.
- Brechas y acciones.
- Reporte legal gerencial.

**Entidades y APIs**

| Tabla | Descripcion | Campos principales | Relaciones | APIs | Roles |
|---|---|---|---|---|---|
| legal_norms | Norma juridica o tecnica | id, code, name, type, issuingEntity, issuedAt, effectiveFrom, status, url | LegalRequirements | GET/POST/PUT/DELETE `/legal-norms` | Administrador |
| legal_requirements | Requisito individual | id, normId, article, numeral, title, description, obligationType, frequency, appliesTo, riskLevel | LegalNorm, RequirementMappings | GET/POST/PUT/DELETE `/legal-requirements` | Administrador, Responsable SG-SST, Auditor |
| company_legal_requirements | Aplicabilidad y cumplimiento por empresa | id, companyId, requirementId, applies, status, ownerId, dueDate, nextReviewAt, lastReviewedAt, score | Company, LegalRequirement, User | GET/POST/PUT `/companies/:id/legal-requirements` | Administrador, Responsable SG-SST, Auditor, Consulta |
| legal_requirement_mappings | Conexion requisito-modulo | id, requirementId, moduleKey, entityName, entityId, evidenceType, kpiKey, reportKey | LegalRequirement | GET/POST/PUT/DELETE `/legal-requirements/:id/mappings` | Administrador, Responsable SG-SST |
| legal_evidence_requirements | Evidencias esperadas | id, requirementId, evidenceName, evidenceType, mandatory, frequency, retentionYears | LegalRequirement | GET/POST/PUT/DELETE `/legal-requirements/:id/evidence-requirements` | Administrador, Responsable SG-SST |
| legal_evidence_links | Evidencias aportadas | id, companyRequirementId, evidenceId, status, reviewedById, reviewedAt, comments | CompanyLegalRequirement, Evidence, User | GET/POST/PUT/DELETE `/company-legal-requirements/:id/evidences` | Responsable SG-SST, Auditor |
| legal_compliance_reviews | Revisiones de cumplimiento | id, companyId, period, reviewedById, score, status, reportExportId | Company, User, ReportExport | GET/POST/PUT/DELETE `/legal-compliance-reviews` | Responsable SG-SST, Auditor |
| legal_requirement_actions | Acciones por brecha normativa | id, companyRequirementId, actionId, source, status | CompanyLegalRequirement, Task/Action | GET/POST/PUT/DELETE `/company-legal-requirements/:id/actions` | Responsable SG-SST, Lider de proceso |

**Endpoints sugeridos**

| Metodo | Endpoint | Uso | Roles |
|---|---|---|---|
| GET | `/legal-norms` | listar normas | Administrador, Responsable SG-SST, Auditor, Consulta |
| POST | `/legal-norms` | crear norma | Administrador |
| PUT | `/legal-norms/:id` | actualizar norma | Administrador |
| DELETE | `/legal-norms/:id` | desactivar norma | Administrador |
| GET | `/legal-requirements` | listar requisitos con filtros por norma, modulo, periodicidad y criticidad | Administrador, Responsable SG-SST, Auditor, Consulta |
| POST | `/legal-requirements` | crear requisito | Administrador |
| PUT | `/legal-requirements/:id` | actualizar requisito | Administrador |
| DELETE | `/legal-requirements/:id` | desactivar requisito | Administrador |
| GET | `/companies/:id/legal-requirements` | matriz aplicable por empresa | Administrador, Responsable SG-SST, Auditor, Consulta |
| POST | `/companies/:id/legal-requirements/sync` | generar matriz aplicable desde catalogo | Administrador, Responsable SG-SST |
| PUT | `/company-legal-requirements/:id` | actualizar aplicabilidad, responsable, estado o vencimiento | Responsable SG-SST |
| POST | `/company-legal-requirements/:id/evidences` | asociar evidencia | Responsable SG-SST, Lider de proceso |
| POST | `/company-legal-requirements/:id/actions` | crear accion por brecha | Responsable SG-SST |
| POST | `/legal-compliance-reviews` | crear revision periodica | Responsable SG-SST, Auditor |
| GET | `/legal-compliance-reviews/:id/report` | descargar informe | Administrador, Responsable SG-SST, Auditor |

**MVP backend implementado**

Ruta base: `/api/v1/legal-compliance`.

| Metodo | Endpoint | Uso | Roles |
|---|---|---|---|
| GET | `/norms` | listar normas legales | Administrador, Responsable SG-SST, Auditor |
| POST | `/norms` | crear norma legal | Administrador |
| PATCH | `/norms/:id` | actualizar norma legal | Administrador |
| DELETE | `/norms/:id` | inactivar norma legal | Administrador |
| GET | `/requirements` | listar requisitos legales | Administrador, Responsable SG-SST, Auditor |
| POST | `/requirements` | crear requisito legal con mapeos y evidencias requeridas | Administrador |
| PATCH | `/requirements/:id` | actualizar requisito legal | Administrador |
| DELETE | `/requirements/:id` | inactivar requisito legal | Administrador |
| POST | `/seed-defaults` | cargar matriz base Decreto 1072, Resolucion 0312, Ley 1562, resoluciones clave, GTC 45 e ISO 45001 | Administrador |
| POST | `/companies/:companyId/requirements/sync` | sincronizar requisitos legales activos para una empresa | Administrador, Responsable SG-SST |
| GET | `/companies/:companyId/requirements` | listar cumplimiento legal por empresa | Administrador, Responsable SG-SST, Auditor |
| GET | `/companies/:companyId/summary` | consultar resumen KPI de cumplimiento legal | Administrador, Responsable SG-SST, Auditor |
| PATCH | `/company-requirements/:id` | actualizar estado, responsable, vencimientos, puntaje y notas | Administrador, Responsable SG-SST, Auditor |
| POST | `/company-requirements/:id/evidences` | vincular evidencia documental, auditoria, inspeccion, matriz o accion | Administrador, Responsable SG-SST, Auditor |

**Roles autorizados**

| Accion | Administrador | Responsable SG-SST | Lider de proceso | Trabajador | Auditor | COPASST | Consulta |
|---|---|---|---|---|---|---|---|
| Configurar catalogo normativo | Total | Consulta | No | No | Consulta | Consulta | Consulta |
| Definir aplicabilidad empresa | Total | Total | Parcial | No | Consulta | Consulta | Consulta |
| Cargar evidencias | Total | Total | Parcial segun asignacion | Parcial si es evidencia propia | Consulta | Parcial | No |
| Revisar cumplimiento | Total | Total | Consulta | No | Total | Consulta | Consulta |
| Crear acciones por brecha | Total | Total | Parcial | No | Recomienda | Recomienda | No |
| Cerrar requisito | Total | Total con evidencia | No | No | Valida | Recomienda | No |

**Flujo de trabajo**

1. Administrador crea o actualiza el catalogo normativo.
2. Administrador registra requisitos por norma, articulo, numeral y obligacion.
3. Responsable SG-SST sincroniza requisitos aplicables a la empresa.
4. Sistema propone aplicabilidad segun numero de trabajadores, clase de riesgo, actividad economica, sedes y procesos.
5. Responsable SG-SST confirma aplicabilidad, responsable, frecuencia y fecha de proxima revision.
6. Sistema conecta cada requisito con modulo, entidad, evidencia, KPI y reporte esperado.
7. Responsables cargan evidencias desde los modulos operativos.
8. Auditor o Responsable SG-SST revisa evidencia y marca cumplimiento: cumple, parcial, no cumple, no aplica justificado.
9. Para brechas, el sistema crea tareas o acciones correctivas/preventivas.
10. Se ejecutan acciones, se anexan evidencias y se verifica eficacia.
11. El requisito se cierra o queda en seguimiento.
12. Dashboard y reportes gerenciales muestran puntaje, brechas, vencimientos y riesgos legales.

**Reglas de negocio**

- Todo requisito debe tener norma, articulo/numeral, descripcion, responsable sugerido y evidencia minima.
- Un requisito no puede cerrarse como `CUMPLE` sin evidencia validada cuando la evidencia es obligatoria.
- `NO_APLICA` exige justificacion y aprobacion del Responsable SG-SST o Auditor.
- Requisito critico vencido genera notificacion a Responsable SG-SST y Administrador.
- Brecha critica debe crear accion correctiva, preventiva o de mejora.
- Los cambios en el catalogo normativo deben versionarse y no alterar historicos ya cerrados.
- La aplicabilidad debe recalcularse cuando cambia tamano de empresa, clase de riesgo, actividad economica, sedes, procesos o contratistas.
- Evidencias asociadas deben conservar trazabilidad: usuario, fecha, origen, modulo, hash y version.
- La matriz debe permitir auditoria por periodo, no solo estado actual.

**Casos de uso reales**

- Empresa realiza autoevaluacion anual de Resolucion 0312 y carga evidencias por estandar.
- Auditor revisa cumplimiento Decreto 1072 y solicita acciones por brechas.
- Responsable SG-SST consulta requisitos con vencimiento en 30 dias.
- Gerencia revisa mapa de cumplimiento por ciclo PHVA.
- COPASST consulta requisitos relacionados con participacion, inspecciones e investigaciones.
- ARL solicita evidencias de matriz de peligros, plan anual y accidentalidad.

**Reportes asociados**

- Matriz legal por empresa.
- Mapa normativo por modulo.
- Cumplimiento por norma.
- Cumplimiento por ciclo PHVA.
- Brechas legales abiertas.
- Evidencias faltantes por requisito.
- Requisitos vencidos o proximos a vencer.
- Informe de auditoria normativa.
- Autoevaluacion Resolucion 0312 consolidada.

**Indicadores KPI asociados**

- % cumplimiento normativo global.
- % cumplimiento por norma.
- % cumplimiento por ciclo PHVA.
- Numero de requisitos no aplicables justificados.
- Numero de requisitos vencidos.
- Numero de evidencias faltantes.
- Tiempo promedio de cierre de brechas.
- Acciones por brecha vencidas.
- Reincidencia de incumplimientos por modulo.
- Puntaje Resolucion 0312.

**Notificaciones automaticas**

- Requisito proximo a vencer.
- Evidencia obligatoria faltante.
- Evidencia rechazada por auditor.
- Requisito critico incumplido.
- Accion por brecha vencida.
- Nueva version normativa publicada.
- Cambio empresarial que exige recalcular aplicabilidad.

**Evidencias requeridas**

- Documentos aprobados.
- Actas firmadas.
- Matriz de peligros.
- Plan anual.
- Registros de capacitacion.
- Investigaciones de accidentes.
- Inspecciones.
- Entrega de EPP.
- Examenes ocupacionales.
- Indicadores.
- Reportes y exportaciones.
- Firmas electronicas.
- Evidencias multimedia.

**Riesgos de incumplimiento legal**

- No demostrar implementacion del SG-SST.
- No contar con evidencias verificables.
- No cumplir estandares minimos.
- No investigar accidentes.
- No identificar peligros ni valorar riesgos.
- No ejecutar plan anual.
- No garantizar participacion de trabajadores.
- No proteger datos sensibles de salud.
- No cerrar acciones derivadas de hallazgos o auditorias.

### Matriz inicial de requisitos legales

| Norma | Requisito / Obligacion | Modulo conectado | Evidencias minimas | Responsable sugerido | Vencimiento / frecuencia | KPI asociado |
|---|---|---|---|---|---|---|
| Decreto 1072 de 2015 | Politica SG-SST definida, firmada, divulgada y revisada | Gestion Documental, Firma Electronica | Politica vigente, firma gerencia, evidencia divulgacion | Responsable SG-SST, Administrador | Revision anual | % documentos criticos vigentes |
| Decreto 1072 de 2015 | Objetivos SG-SST medibles y coherentes con politica | Objetivos SG-SST, Indicadores KPI | Objetivos, metas, responsables, mediciones | Responsable SG-SST | Anual con seguimiento periodico | % avance objetivos |
| Decreto 1072 de 2015 | Identificacion de peligros, evaluacion y valoracion de riesgos | Matriz de Peligros GTC-45, Evaluacion de Riesgos | Matriz GTC 45, controles, aprobacion | Responsable SG-SST, Lider de proceso | Minimo anual o por cambios | % matriz actualizada |
| Decreto 1072 de 2015 | Plan anual de trabajo SG-SST | Plan Anual de Trabajo | Plan aprobado, actividades, responsables, presupuesto | Responsable SG-SST, Administrador | Anual, seguimiento mensual | % cumplimiento plan anual |
| Decreto 1072 de 2015 | Gestion del cambio | Gestion del Cambio | Solicitudes, analisis riesgo, aprobaciones, acciones | Responsable SG-SST, Lider de proceso | Por cada cambio | % cambios evaluados |
| Decreto 1072 de 2015 | Rendicion de cuentas y responsabilidades | Roles y Permisos, Tareas, Dashboard Ejecutivo | Matriz responsabilidades, tareas, seguimiento | Administrador, Responsable SG-SST | Anual y por rol | % responsabilidades asignadas |
| Decreto 1072 de 2015 | Conservacion documental del SG-SST | Gestion Documental, Evidencias Multimedia | Matriz documental, historicos, versionamiento | Responsable SG-SST | Permanente | % evidencias disponibles |
| Resolucion 0312 de 2019 | Autoevaluacion de estandares minimos | Estandares Minimos 0312 | Evaluacion, respuestas, soportes, puntaje | Responsable SG-SST, Auditor | Anual | Puntaje 0312 |
| Resolucion 0312 de 2019 | Plan de mejora por resultado de estandares minimos | Estandares Minimos 0312, Acciones de Mejora | Plan mejora, acciones, avances | Responsable SG-SST | Segun resultado anual | % avance plan mejora |
| Ley 1562 de 2012 | Gestion del Sistema General de Riesgos Laborales | Empresas, Trabajadores, Accidentes, Indicadores | ARL, afiliaciones, reportes, indicadores | Administrador, Responsable SG-SST | Permanente | % trabajadores cubiertos |
| Resolucion 1401 de 2007 | Investigacion de accidentes e incidentes | Investigacion de Accidentes, Accidentes, Incidentes | Informe, equipo investigador, causas, acciones | Responsable SG-SST, COPASST | Por evento, plazo legal aplicable | % investigaciones cerradas a tiempo |
| Resolucion 2013 de 1986 | Conformacion y funcionamiento COPASST | COPASST | Actas eleccion, miembros, reuniones, compromisos | Responsable SG-SST, COPASST | Periodo y reuniones periodicas | % reuniones COPASST cumplidas |
| Resolucion 2646 de 2008 | Gestion del riesgo psicosocial | Vigilancia Epidemiologica, Evaluacion de Riesgos, Acciones | Bateria/informes, intervenciones, seguimiento | Responsable SG-SST | Segun nivel de riesgo y criterio tecnico | % intervenciones psicosociales |
| Resolucion 2400 de 1979 | Condiciones de higiene y seguridad industrial | Inspecciones, Condiciones Inseguras, Plan de Intervencion | Inspecciones, hallazgos, acciones, fotos | Responsable SG-SST, Lider de proceso | Periodica segun programa | % hallazgos locativos cerrados |
| GTC 45 | Metodologia de identificacion de peligros y valoracion de riesgos | Matriz de Peligros GTC-45 | Matriz, criterios, controles, aceptabilidad | Responsable SG-SST | Anual o por cambios | # riesgos no aceptables |
| ISO 45001:2018 | Contexto, liderazgo, planificacion, soporte, operacion, evaluacion y mejora | Auditorias Internas, Objetivos, Acciones, Indicadores | Auditorias, objetivos, acciones, revision gerencial | Administrador, Responsable SG-SST, Auditor | Ciclo de auditoria | % requisitos ISO conformes |

### Diseno de implementacion tecnica

**Backend sugerido**

- `LegalNormsModule`
- `LegalRequirementsModule`
- `CompanyLegalComplianceModule`
- `LegalEvidenceModule`
- `LegalComplianceReviewsModule`

**Frontend sugerido**

- Vista `Mapa Normativo`.
- Vista `Requisitos legales`.
- Vista `Cumplimiento por empresa`.
- Panel de brechas.
- Panel de evidencias faltantes.
- Reporte por norma.

**Modelo relacional minimo para primera iteracion**

| Tabla | Proposito MVP |
|---|---|
| legal_norms | Catalogar normas. |
| legal_requirements | Registrar obligaciones. |
| company_legal_requirements | Medir cumplimiento por empresa. |
| legal_requirement_mappings | Conectar requisito con modulo/evidencia/KPI. |
| legal_evidence_links | Asociar evidencias reales. |

**Implementacion por etapas**

1. Crear catalogo de normas y requisitos.
2. Sembrar requisitos base de Decreto 1072, Resolucion 0312, Ley 1562, Resolucion 1401, Resolucion 2013, Resolucion 2646, Resolucion 2400, GTC 45 e ISO 45001.
3. Crear matriz aplicable por empresa.
4. Asociar requisitos a modulos existentes: documentos, riesgos, incidentes, auditorias, reportes, capacitaciones, acciones.
5. Permitir carga/asociacion de evidencias.
6. Calcular estado de cumplimiento.
7. Generar notificaciones por vencimientos y evidencias faltantes.
8. Crear reporte gerencial de cumplimiento legal.

## Priorizacion recomendada

| Prioridad | Modulos |
|---|---|
| Critica | Mapa Normativo SG-SST, Matriz GTC 45, Evaluacion de Riesgos, Plan Anual, Estandares Minimos 0312, Accidentes, Investigacion de Accidentes, Gestion Documental |
| Alta | Trabajadores, Cargos, Examenes Medicos, EPP, Capacitaciones, Auditorias, Hallazgos, Acciones, Indicadores |
| Media | COPASST, Convivencia, Emergencias, Simulacros, Contratistas, Gestion del Cambio |
| Evolutiva | Firma Electronica, Reportes avanzados, Gestion Ambiental, analitica predictiva |

## Modulos existentes vs modulos objetivo

| Ya existe base en el proyecto | Requiere profundizacion |
|---|---|
| Empresas, usuarios, empleados, documentos, riesgos, incidentes, capacitaciones, auditorias, hallazgos, acciones, reportes, notificaciones, dashboard | Sedes, areas, procesos, cargos, contratistas, GTC 45 completa, estandares 0312, plan anual, COPASST, convivencia, emergencias, EPP, examenes, ausentismo, vigilancia epidemiologica, gestion del cambio, firma electronica |
