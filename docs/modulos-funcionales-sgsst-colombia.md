# Modulos funcionales de un software SG-SST para Colombia

Este documento define los modulos que debe cubrir un software SG-SST completo, desde una mirada funcional, normativa y operativa para Colombia.

## Marco normativo de referencia

El diseno funcional debe alinearse, como minimo, con:

- Decreto 1072 de 2015, Libro 2, Parte 2, Titulo 4, Capitulo 6: SG-SST basado en mejora continua y ciclo PHVA.
- Resolucion 0312 de 2019: Estandares Minimos del SG-SST, ajustados por tamano de empresa, actividad economica y clase de riesgo.
- Ley 1562 de 2012: Sistema General de Riesgos Laborales y definicion moderna de SST/SG-SST.
- Resolucion 1401 de 2007: investigacion de incidentes y accidentes de trabajo.
- Resolucion 1843 de 2025: evaluaciones medicas ocupacionales, historias clinicas ocupacionales y manejo de datos de salud (derogo la Resolucion 2346 de 2007).
- Normas complementarias aplicables por sector, tarea critica o peligro especifico: alturas, espacios confinados, riesgo electrico, sustancias quimicas, seguridad vial, riesgo psicosocial, emergencias, contratistas y proteccion de datos personales.

El sistema debe permitir configurar el nivel de cumplimiento segun:

- Numero de trabajadores.
- Clase de riesgo ARL: I, II, III, IV o V.
- Actividad economica.
- Tipo de vinculacion: empleados, contratistas, trabajadores en mision, estudiantes o independientes.
- Sedes, procesos, centros de trabajo y frentes operativos.

## Principios funcionales

- El SG-SST debe operar con ciclo PHVA: planear, hacer, verificar y actuar.
- Cada actividad debe tener responsable, fecha, evidencia, estado y trazabilidad.
- Toda informacion debe filtrarse por empresa, sede y permisos del usuario.
- Los documentos y evidencias deben tener version, vigencia, aprobacion y soporte.
- Las acciones correctivas, preventivas y de mejora deben integrarse con riesgos, auditorias, incidentes, inspecciones e indicadores.
- El sistema debe producir evidencia auditable para Ministerio del Trabajo, ARL, auditorias internas y auditorias de terceros.

## 1. Administracion, empresas y configuracion del SG-SST

### Descripcion funcional

Modulo base para administrar empresas, sedes, centros de trabajo, procesos, cargos, usuarios, roles, parametros SG-SST y configuracion normativa aplicable.

### Submodulos

- Empresas y sedes.
- Centros de trabajo.
- Procesos y areas.
- Cargos y perfiles ocupacionales.
- Usuarios y roles.
- Parametros de clase de riesgo ARL.
- Calendarios laborales.
- Configuracion de consecutivos y formatos.
- Plantillas por tipo de empresa.

### Entidades

- companies
- sites
- work_centers
- areas
- processes
- job_positions
- users
- roles
- permissions
- user_company_roles
- arl_risk_classes
- company_sgsst_profiles
- system_parameters

### Flujos de trabajo

1. Crear empresa.
2. Registrar sedes y centros de trabajo.
3. Definir procesos, areas y cargos.
4. Asignar clase de riesgo y ARL.
5. Configurar responsables SG-SST.
6. Asignar roles y permisos.
7. Activar modulos requeridos segun estandares minimos aplicables.

### Casos de uso reales

- Una empresa de 35 trabajadores riesgo III activa un paquete de estandares minimos simplificado.
- Una empresa industrial riesgo V activa gestion avanzada de tareas criticas, permisos de trabajo, mediciones higienicas y vigilancia epidemiologica.
- Un consultor SST administra varias empresas sin mezclar informacion entre clientes.

## 2. Identidad, roles y control de acceso

### Descripcion funcional

Modulo para autenticacion, autorizacion y trazabilidad de accesos. Debe soportar roles SG-SST y permisos granulares.

### Submodulos

- Login y recuperacion de cuenta.
- Gestion de sesiones.
- Roles: ADMIN, SST, EMPLOYEE, AUDITOR.
- Permisos por modulo, empresa, sede y recurso.
- Auditoria de accesos.
- MFA opcional para perfiles criticos.

### Entidades

- users
- roles
- permissions
- role_permissions
- sessions
- refresh_tokens
- login_attempts
- audit_logs

### Flujos de trabajo

1. Usuario inicia sesion.
2. Sistema valida credenciales y estado.
3. Sistema emite token con rol, empresa y alcance.
4. Cada accion valida permisos.
5. Acciones sensibles quedan auditadas.

### Casos de uso reales

- Un auditor externo puede consultar documentos y hallazgos, pero no editar la matriz de peligros.
- Un empleado solo reporta incidentes, consulta capacitaciones y descarga documentos publicados.
- El lider SST puede crear inspecciones, acciones correctivas y capacitaciones de su empresa.

## 3. Matriz legal

### Descripcion funcional

Gestiona requisitos legales aplicables a la empresa y su cumplimiento. Debe permitir demostrar identificacion, actualizacion, evaluacion y seguimiento de requisitos legales.

### Submodulos

- Normograma colombiano.
- Requisitos legales por actividad economica.
- Evaluacion de cumplimiento.
- Evidencias por requisito.
- Alertas de vencimiento o actualizacion.
- Planes de accion por brechas legales.

### Entidades

- legal_requirements
- legal_categories
- company_legal_requirements
- legal_compliance_evaluations
- legal_evidence
- legal_updates
- legal_action_plans

### Flujos de trabajo

1. Seleccionar actividad economica y clase de riesgo.
2. Sistema sugiere normas aplicables.
3. Responsable SST marca aplicabilidad.
4. Se evalua cumplimiento.
5. Brechas generan acciones.
6. Se cargan evidencias.
7. Se programa reevaluacion periodica.

### Casos de uso reales

- La empresa identifica que por usar sustancias quimicas debe exigir hojas de seguridad y matriz de compatibilidad.
- Una auditoria solicita evidencia de cumplimiento del Decreto 1072 y la empresa exporta la matriz legal con soportes.
- Un cambio normativo genera tarea de revision para el responsable SST.

## 4. Politica, objetivos y responsabilidades SG-SST

### Descripcion funcional

Permite gestionar politica SST, objetivos, metas, responsables, recursos y asignacion formal de responsabilidades.

### Submodulos

- Politica SST.
- Objetivos medibles.
- Responsabilidades por rol.
- Asignacion de recursos.
- Divulgacion y aceptacion.
- Revision anual.

### Entidades

- sgsst_policies
- sgsst_objectives
- objective_targets
- responsibility_assignments
- resource_allocations
- policy_acknowledgements
- policy_versions

### Flujos de trabajo

1. Crear politica SST.
2. Enviar a aprobacion de gerencia.
3. Publicar politica vigente.
4. Registrar divulgacion a trabajadores.
5. Definir objetivos y metas.
6. Relacionar objetivos con plan anual e indicadores.
7. Revisar y actualizar anualmente.

### Casos de uso reales

- Gerencia firma digitalmente la politica SST y el sistema registra version vigente.
- El objetivo "reducir accidentalidad" se conecta con indicadores de frecuencia, severidad y ausentismo.
- Cada jefe de area acepta sus responsabilidades SST dentro del sistema.

## 5. Plan anual de trabajo SG-SST

### Descripcion funcional

Modulo central de planeacion anual. Debe contener objetivos, actividades, metas, responsables, cronograma, recursos y evidencias, como exige el enfoque de planificacion del SG-SST.

### Submodulos

- Plan anual por vigencia.
- Actividades y cronograma.
- Responsables.
- Presupuesto y recursos.
- Evidencias.
- Seguimiento mensual.
- Reprogramaciones.
- Aprobacion y firma.

### Entidades

- annual_work_plans
- annual_work_plan_activities
- activity_schedules
- activity_responsibles
- activity_resources
- activity_evidence
- plan_approvals
- plan_progress_snapshots

### Flujos de trabajo

1. Crear plan anual desde evaluacion inicial, matriz de riesgos, auditorias e indicadores.
2. Definir actividades, responsables y recursos.
3. Enviar a aprobacion de gerencia.
4. Ejecutar actividades.
5. Cargar evidencias.
6. Medir avance mensual.
7. Generar acciones por retrasos.
8. Cerrar vigencia y alimentar plan del siguiente ano.

### Casos de uso reales

- El plan incluye capacitacion en trabajo en alturas para marzo, inspecciones mensuales y auditoria interna en octubre.
- Una actividad vencida genera alerta al responsable SST y al jefe de area.
- La gerencia revisa porcentaje de cumplimiento por trimestre.

## 6. Gestion de riesgos y matriz de peligros

### Descripcion funcional

Identifica peligros, evalua y valora riesgos, define controles y hace seguimiento a su eficacia. Debe soportar metodologias como GTC 45 u otra definida por la empresa.

### Submodulos

- Inventario de procesos, actividades y tareas.
- Identificacion de peligros.
- Clasificacion de peligros: fisico, quimico, biologico, biomecanico, psicosocial, condiciones de seguridad, fenomenos naturales, transito, publico, entre otros.
- Evaluacion y valoracion del riesgo.
- Controles existentes.
- Jerarquia de controles.
- Riesgo residual.
- Priorizacion.
- Planes de intervencion.
- Revision anual y por cambios.

### Entidades

- hazard_matrices
- hazard_matrix_versions
- activities
- tasks
- hazards
- hazard_categories
- risk_assessments
- existing_controls
- proposed_controls
- control_hierarchy
- risk_intervention_plans
- risk_review_logs

### Flujos de trabajo

1. Crear version de matriz.
2. Registrar proceso, actividad y tarea.
3. Identificar peligros y posibles efectos.
4. Evaluar probabilidad, consecuencia, exposicion o variables de la metodologia.
5. Clasificar nivel de riesgo.
6. Registrar controles existentes.
7. Definir controles adicionales.
8. Asignar responsables y fechas.
9. Aprobar matriz.
10. Revisar por cambios, incidentes, inspecciones o periodicidad anual.

### Casos de uso reales

- En bodega se identifica riesgo biomecanico por manipulacion manual de cargas y se asigna control de ayudas mecanicas.
- En mantenimiento se identifica riesgo electrico y se exige permiso de trabajo, bloqueo y etiquetado.
- Tras un incidente, se reabre la matriz para recalcular riesgo residual.

## 7. Planes de accion, acciones correctivas, preventivas y de mejora

### Descripcion funcional

Consolida las acciones derivadas de riesgos, inspecciones, auditorias, incidentes, indicadores, revision gerencial, comites y matriz legal.

### Submodulos

- Acciones correctivas.
- Acciones preventivas.
- Acciones de mejora.
- Causa raiz.
- Seguimiento y evidencias.
- Verificacion de eficacia.
- Escalamiento por vencimiento.

### Entidades

- action_plans
- actions
- action_causes
- action_evidence
- action_followups
- effectiveness_checks
- action_sources

### Flujos de trabajo

1. Crear accion desde una fuente.
2. Asignar responsable y fecha.
3. Registrar causa raiz.
4. Ejecutar actividad.
5. Cargar evidencia.
6. Validar cumplimiento.
7. Verificar eficacia.
8. Cerrar o reabrir.

### Casos de uso reales

- Una inspeccion detecta extintor vencido y crea accion correctiva para mantenimiento.
- Un indicador de accidentalidad en aumento crea accion preventiva en capacitacion y controles operacionales.
- Una auditoria detecta documento obsoleto y genera accion de actualizacion documental.

## 8. Gestion documental

### Descripcion funcional

Administra documentos SG-SST, versiones, aprobaciones, vigencias, distribucion, lectura y evidencias. Debe soportar politicas, procedimientos, formatos, instructivos, registros y soportes.

### Submodulos

- Biblioteca documental.
- Versionamiento.
- Aprobaciones.
- Control de vigencia.
- Documentos obligatorios.
- Registros y evidencias.
- Lectura y aceptacion.
- Firmas electronicas.
- Retencion documental.

### Entidades

- documents
- document_versions
- document_categories
- document_approvals
- document_distributions
- document_acknowledgements
- document_retention_rules
- document_files
- digital_signatures

### Flujos de trabajo

1. Crear documento borrador.
2. Enviar a revision.
3. Aprobar version.
4. Publicar a cargos, sedes o procesos.
5. Registrar lectura o aceptacion.
6. Controlar vigencia.
7. Generar nueva version si cambia.
8. Mantener historico auditable.

### Casos de uso reales

- Se publica procedimiento de investigacion de accidentes y los jefes deben confirmar lectura.
- Un formato de inspeccion cambia de version; el sistema bloquea el uso de formatos obsoletos.
- Auditoria descarga historico de versiones de la politica SST.

## 9. Capacitaciones, induccion y entrenamiento

### Descripcion funcional

Planifica, ejecuta y evidencia capacitaciones SST, inducciones, reinducciones, entrenamientos obligatorios y evaluaciones de aprendizaje.

### Submodulos

- Plan de capacitacion.
- Induccion y reinduccion.
- Capacitaciones por riesgo prioritario.
- Asistencia.
- Evaluaciones.
- Certificados.
- Competencias por cargo.
- Entrenamientos criticos.

### Entidades

- training_programs
- training_sessions
- training_topics
- training_attendees
- training_evaluations
- training_certificates
- competency_profiles
- employee_competencies
- instructors

### Flujos de trabajo

1. Definir necesidades desde matriz de peligros, cargos e incidentes.
2. Programar capacitacion.
3. Convocar asistentes.
4. Registrar asistencia.
5. Aplicar evaluacion.
6. Emitir certificado si aplica.
7. Medir cobertura y eficacia.
8. Reprogramar ausentes.

### Casos de uso reales

- Todo nuevo empleado realiza induccion SG-SST antes de iniciar labores.
- Conductores reciben capacitacion de seguridad vial y se registra certificado.
- Personal de alturas tiene alerta de vencimiento de entrenamiento.

## 10. Inspecciones de seguridad

### Descripcion funcional

Gestiona inspecciones planeadas y no planeadas a areas, equipos, herramientas, EPP, vehiculos, extintores, botiquines, orden y aseo, instalaciones y tareas criticas.

### Submodulos

- Programacion de inspecciones.
- Listas de chequeo.
- Inspecciones por sede, area o equipo.
- Hallazgos.
- Evidencias fotograficas.
- Planes de accion.
- Tendencias por area.

### Entidades

- inspection_programs
- inspection_checklists
- checklist_items
- inspections
- inspection_findings
- inspection_evidence
- inspection_action_links
- inspected_assets

### Flujos de trabajo

1. Crear lista de chequeo.
2. Programar inspeccion.
3. Ejecutar desde web o movil.
4. Registrar conformidades, no conformidades y observaciones.
5. Adjuntar fotos.
6. Crear acciones.
7. Verificar cierre.
8. Analizar recurrencia.

### Casos de uso reales

- Inspeccion mensual de extintores detecta manometro fuera de rango.
- Inspeccion de orden y aseo encuentra pasillos obstruidos.
- Inspeccion preoperacional de montacargas bloquea equipo por falla de frenos.

## 11. Accidentes, incidentes y enfermedades laborales

### Descripcion funcional

Permite reportar, investigar, analizar causas, definir acciones, hacer seguimiento y calcular indicadores asociados a eventos laborales.

### Submodulos

- Reporte de incidente.
- Reporte de accidente.
- Enfermedad laboral sospechada o calificada.
- FURAT/FUREL y soportes.
- Equipo investigador.
- Investigacion.
- Causa raiz.
- Acciones correctivas.
- Seguimiento de incapacidades.
- Comunicacion a ARL.

### Entidades

- occupational_events
- incident_reports
- accident_reports
- occupational_disease_reports
- injured_workers
- event_witnesses
- investigation_teams
- event_investigations
- root_causes
- event_action_plans
- disability_records
- arl_reports
- event_evidence

### Flujos de trabajo

1. Trabajador o jefe reporta evento.
2. SST clasifica incidente, accidente o enfermedad sospechada.
3. Se registra atencion inicial y datos del evento.
4. Se notifica a responsables y ARL si aplica.
5. Se conforma equipo investigador.
6. Se investiga causa inmediata, basica y raiz.
7. Se definen acciones correctivas.
8. Se hace seguimiento a incapacidades y reincorporacion.
9. Se actualizan indicadores y matriz de peligros.

### Casos de uso reales

- Un trabajador sufre caida al mismo nivel; se reporta accidente, se investiga causa y se corrige condicion locativa.
- Un casi accidente con montacargas genera accion preventiva antes de que ocurra lesion.
- Un diagnostico osteomuscular recurrente activa vigilancia epidemiologica biomecanica.

## 12. Medicina preventiva, examenes ocupacionales y vigilancia epidemiologica

### Descripcion funcional

Gestiona informacion ocupacional no clinica, conceptos medicos, restricciones, recomendaciones, profesiogramas y programas de vigilancia epidemiologica. La historia clinica individual debe manejarse con reserva por el prestador medico.

### Submodulos

- Profesiogramas.
- Examenes de ingreso, periodicos, egreso, reintegro y post incapacidad.
- Conceptos de aptitud.
- Restricciones y recomendaciones.
- Diagnostico de condiciones de salud poblacional.
- Programas de vigilancia epidemiologica.
- Seguimiento a casos.
- Ausentismo medico.

### Entidades

- occupational_medical_exam_orders
- medical_fitness_concepts
- work_restrictions
- medical_recommendations
- job_medical_profiles
- epidemiological_surveillance_programs
- surveillance_cases
- health_condition_reports
- absenteeism_records

### Flujos de trabajo

1. Crear profesiograma por cargo.
2. Ordenar examen segun tipo y riesgo.
3. Registrar concepto medico, no historia clinica detallada.
4. Crear restricciones o recomendaciones.
5. Notificar a jefe y SST segun permiso.
6. Hacer seguimiento.
7. Alimentar indicadores de salud y ausentismo.

### Casos de uso reales

- Un trabajador reintegrado por lesion lumbar recibe restriccion temporal de levantamiento de cargas.
- El diagnostico de salud muestra alta prevalencia osteomuscular y activa PVE biomecanico.
- Se alerta vencimiento de examen periodico para cargo expuesto a ruido.

## 13. Elementos de proteccion personal y dotacion SST

### Descripcion funcional

Gestiona seleccion, entrega, reposicion, inspeccion y trazabilidad de EPP segun matriz de peligros, cargo y tarea.

### Submodulos

- Matriz de EPP por cargo/tarea.
- Inventario.
- Entrega y aceptacion.
- Reposicion.
- Inspeccion de EPP.
- Fichas tecnicas.
- Proveedores.

### Entidades

- ppe_items
- ppe_categories
- ppe_stock
- ppe_assignments
- ppe_delivery_records
- ppe_inspections
- ppe_replacement_rules
- ppe_supplier_documents

### Flujos de trabajo

1. Definir EPP requerido por cargo o riesgo.
2. Registrar inventario.
3. Entregar EPP a trabajador.
4. Registrar firma o aceptacion.
5. Programar reposicion.
6. Inspeccionar estado.
7. Bloquear tarea si EPP critico no esta vigente.

### Casos de uso reales

- Soldador recibe careta, guantes, polainas y proteccion respiratoria segun tarea.
- Casco con vida util vencida genera alerta de reposicion.
- Inspeccion detecta arnes deteriorado y lo retira de servicio.

## 14. Tareas criticas y permisos de trabajo

### Descripcion funcional

Controla actividades de alto riesgo o tareas criticas con autorizaciones, analisis seguro de trabajo, preoperacionales, controles y cierre.

### Submodulos

- Permisos de trabajo.
- Analisis seguro de trabajo.
- Trabajo en alturas.
- Espacios confinados.
- Energias peligrosas.
- Trabajo en caliente.
- Izaje de cargas.
- Excavaciones.
- Riesgo electrico.
- Validacion de competencias.

### Entidades

- work_permits
- permit_types
- job_safety_analysis
- permit_controls
- permit_authorizations
- critical_task_checklists
- worker_certifications
- permit_closures

### Flujos de trabajo

1. Solicitar permiso.
2. Asociar tarea, area, trabajadores y equipos.
3. Validar competencias y certificados.
4. Completar analisis seguro de trabajo.
5. Verificar controles previos.
6. Autorizar permiso.
7. Ejecutar y monitorear.
8. Cerrar permiso con evidencias.

### Casos de uso reales

- Trabajo en caliente exige extintor, area despejada y vigia antes de aprobar.
- Trabajo en alturas bloquea autorizacion si el certificado del trabajador esta vencido.
- Mantenimiento electrico exige bloqueo y etiquetado antes de iniciar.

## 15. Preparacion y respuesta ante emergencias

### Descripcion funcional

Gestiona plan de emergencias, amenazas, brigadas, recursos, simulacros, inspecciones de equipos y lecciones aprendidas.

### Submodulos

- Analisis de amenazas y vulnerabilidad.
- Plan de emergencias.
- Brigada.
- Recursos de emergencia.
- Simulacros.
- Rutas de evacuacion.
- Puntos de encuentro.
- Lecciones aprendidas.

### Entidades

- emergency_plans
- emergency_scenarios
- vulnerability_assessments
- brigade_members
- emergency_resources
- emergency_drills
- drill_attendance
- drill_findings
- evacuation_routes

### Flujos de trabajo

1. Identificar amenazas.
2. Definir escenarios de emergencia.
3. Asignar brigadistas.
4. Registrar recursos.
5. Programar simulacro.
6. Ejecutar simulacro.
7. Registrar tiempos, asistencia y hallazgos.
8. Crear acciones de mejora.

### Casos de uso reales

- Simulacro de evacuacion mide tiempo de salida por sede.
- Inspeccion de botiquines detecta insumos vencidos.
- Amenaza de incendio en bodega de quimicos actualiza plan de emergencias.

## 16. COPASST, Comite de Convivencia y participacion de trabajadores

### Descripcion funcional

Administra comites, integrantes, elecciones, reuniones, actas, compromisos, quejas, recomendaciones y participacion de trabajadores.

### Submodulos

- COPASST o Vigia SST.
- Comite de Convivencia Laboral.
- Elecciones y designaciones.
- Actas.
- Compromisos.
- Recomendaciones.
- Quejas y reportes.
- Participacion y consulta.

### Entidades

- committees
- committee_members
- committee_elections
- committee_meetings
- meeting_minutes
- meeting_commitments
- worker_reports
- workplace_complaints
- committee_recommendations

### Flujos de trabajo

1. Crear comite o vigia.
2. Registrar integrantes y periodo.
3. Programar reunion.
4. Registrar acta y asistencia.
5. Crear compromisos.
6. Hacer seguimiento.
7. Escalar recomendaciones a plan de accion.

### Casos de uso reales

- COPASST participa en investigacion de accidente grave.
- Comite de Convivencia recibe queja y gestiona tramite reservado.
- Trabajadores reportan una condicion insegura desde celular.

## 17. Gestion de contratistas, proveedores y visitantes

### Descripcion funcional

Controla requisitos SST para terceros, validacion documental, induccion, permisos, ingreso a sedes y evaluacion de desempeno.

### Submodulos

- Registro de contratistas.
- Requisitos documentales.
- Seguridad social.
- Induccion a terceros.
- Permisos de ingreso.
- Evaluacion SST del proveedor.
- Control de actividades tercerizadas.

### Entidades

- contractors
- contractor_workers
- contractor_requirements
- contractor_documents
- visitor_records
- entry_permits
- contractor_evaluations
- third_party_incidents

### Flujos de trabajo

1. Registrar contratista.
2. Definir requisitos segun tarea y riesgo.
3. Cargar documentos.
4. Validar seguridad social y certificados.
5. Realizar induccion.
6. Autorizar ingreso.
7. Evaluar desempeno SST.

### Casos de uso reales

- Contratista de mantenimiento no puede ingresar porque falta pago vigente de ARL.
- Visitante recibe induccion corta y acepta reglas de seguridad.
- Proveedor con accidente recurrente queda condicionado en evaluacion.

## 18. Equipos, herramientas, maquinas e infraestructura

### Descripcion funcional

Gestiona activos relacionados con SST: maquinas, herramientas, vehiculos, equipos de emergencia, calibraciones, mantenimiento e inspecciones.

### Submodulos

- Inventario de activos.
- Hojas de vida.
- Mantenimiento preventivo.
- Calibraciones.
- Inspecciones preoperacionales.
- Bloqueo por condicion insegura.
- Documentos tecnicos.

### Entidades

- assets
- asset_categories
- asset_maintenance_plans
- maintenance_records
- calibration_records
- preoperational_checks
- asset_safety_blocks
- asset_documents

### Flujos de trabajo

1. Registrar activo.
2. Definir criticidad SST.
3. Programar mantenimiento o calibracion.
4. Ejecutar inspeccion.
5. Registrar hallazgo.
6. Bloquear activo si es inseguro.
7. Liberar activo tras correccion.

### Casos de uso reales

- Montacargas queda bloqueado por falla en alarma de reversa.
- Sonometro requiere calibracion antes de medicion higienica.
- Escalera deteriorada queda fuera de servicio.

## 19. Gestion del cambio

### Descripcion funcional

Evalua impactos SST antes de cambios en procesos, instalaciones, personal, sustancias, equipos, turnos o tecnologia.

### Submodulos

- Solicitudes de cambio.
- Evaluacion de impacto SST.
- Revision de matriz de peligros.
- Aprobaciones.
- Plan de controles.
- Verificacion posterior.

### Entidades

- change_requests
- change_impacts
- change_risk_assessments
- change_approvals
- change_control_plans
- post_change_reviews

### Flujos de trabajo

1. Registrar cambio propuesto.
2. Evaluar impacto en peligros y requisitos legales.
3. Definir controles previos.
4. Aprobar cambio.
5. Ejecutar cambio.
6. Verificar eficacia.
7. Actualizar matriz, procedimientos y capacitaciones.

### Casos de uso reales

- Se introduce una nueva sustancia quimica y se exige hoja de seguridad, capacitacion y actualizacion de matriz.
- Cambio de turno nocturno obliga a revisar fatiga, iluminacion y seguridad vial.
- Nueva maquina requiere guarda de seguridad y procedimiento operativo.

## 20. Comunicaciones, reportes y cultura SST

### Descripcion funcional

Administra comunicacion interna y externa del SG-SST, campanas, boletines, reportes de condiciones inseguras, encuestas y participacion.

### Submodulos

- Comunicados SST.
- Campanas.
- Reporte de actos y condiciones inseguras.
- Encuestas.
- Buzon SST.
- Reconocimientos.
- Comunicacion externa.

### Entidades

- sst_communications
- communication_audiences
- communication_acknowledgements
- safety_campaigns
- unsafe_condition_reports
- safety_observations
- surveys
- survey_responses

### Flujos de trabajo

1. Crear comunicado o campana.
2. Segmentar audiencia.
3. Publicar.
4. Registrar lectura.
5. Recibir reportes o respuestas.
6. Crear acciones cuando aplique.
7. Medir participacion.

### Casos de uso reales

- Campana de cuidado de manos se envia a operarios y mide participacion.
- Trabajador reporta cable expuesto y se genera inspeccion correctiva.
- Encuesta identifica baja percepcion de seguridad en turno nocturno.

## 21. Indicadores, KPIs y tableros

### Descripcion funcional

Define, calcula y visualiza indicadores de estructura, proceso y resultado del SG-SST, con fichas tecnicas, metas, fuentes y periodicidad.

### Submodulos

- Fichas tecnicas de indicadores.
- Indicadores de estructura.
- Indicadores de proceso.
- Indicadores de resultado.
- Accidentabilidad.
- Ausentismo.
- Cumplimiento del plan anual.
- Cumplimiento documental.
- Tableros gerenciales.
- Reportes para auditoria.

### Entidades

- indicators
- indicator_formulas
- indicator_measurements
- indicator_targets
- indicator_sources
- kpi_dashboards
- dashboard_widgets
- indicator_alerts

### Flujos de trabajo

1. Crear indicador con ficha tecnica.
2. Definir formula, meta, fuente y periodicidad.
3. Capturar datos manuales o automaticos.
4. Calcular resultado.
5. Comparar contra meta.
6. Generar alerta si incumple.
7. Crear accion de mejora.
8. Presentar tablero a gerencia.

### Casos de uso reales

- Tasa de frecuencia aumenta y se activa revision de controles en area critica.
- Cumplimiento del plan anual baja del 80% y genera alerta a gerencia.
- Dashboard muestra accidentalidad por sede y tipo de evento.

## 22. Auditorias SG-SST

### Descripcion funcional

Gestiona auditorias internas, externas, de proveedores y revisiones por cumplimiento de estandares minimos.

### Submodulos

- Programa de auditoria.
- Plan de auditoria.
- Listas de verificacion.
- Equipo auditor.
- Hallazgos.
- No conformidades.
- Planes de accion.
- Informe de auditoria.

### Entidades

- audit_programs
- audit_plans
- audit_criteria
- audit_checklists
- audit_teams
- audits
- audit_findings
- nonconformities
- audit_reports
- audit_action_links

### Flujos de trabajo

1. Crear programa de auditoria.
2. Planificar auditoria.
3. Definir criterios y alcance.
4. Ejecutar lista de verificacion.
5. Registrar hallazgos.
6. Emitir informe.
7. Crear acciones.
8. Verificar cierre y eficacia.

### Casos de uso reales

- Auditoria interna anual evalua cumplimiento del Decreto 1072 y Resolucion 0312.
- Auditor externo registra no conformidad por falta de evidencia de capacitacion.
- Auditoria a contratista identifica incumplimiento documental.

## 23. Autoevaluacion de estandares minimos

### Descripcion funcional

Permite aplicar la autoevaluacion de estandares minimos de la Resolucion 0312 de 2019 segun tamano, riesgo y actividad de la empresa.

### Submodulos

- Plantillas por tipo de empresa.
- Criterios de evaluacion.
- Puntajes.
- Evidencias.
- Plan de mejora.
- Historico anual.
- Reporte exportable.

### Entidades

- minimum_standard_templates
- minimum_standard_items
- standard_evaluations
- standard_scores
- standard_evidence
- standard_improvement_plans
- standard_evaluation_history

### Flujos de trabajo

1. Seleccionar perfil de empresa.
2. Cargar estandares aplicables.
3. Evaluar cada criterio.
4. Adjuntar evidencia.
5. Calcular puntaje.
6. Clasificar resultado.
7. Generar plan de mejora.
8. Hacer seguimiento.

### Casos de uso reales

- Empresa de menos de 10 trabajadores riesgo II evalua solo los estandares que le aplican.
- Empresa riesgo V aplica estandares completos y genera plan de mejora.
- Consultor exporta autoevaluacion para revision con gerencia.

## 24. Revision por la direccion

### Descripcion funcional

Soporta la revision periodica del SG-SST por parte de la alta direccion, con entradas, decisiones, compromisos y acciones.

### Submodulos

- Agenda de revision.
- Entradas de revision.
- Analisis de resultados.
- Decisiones.
- Compromisos gerenciales.
- Recursos.
- Acta.

### Entidades

- management_reviews
- review_inputs
- review_decisions
- review_commitments
- review_attendees
- review_minutes
- review_action_links

### Flujos de trabajo

1. Programar revision.
2. Consolidar indicadores, auditorias, accidentes, acciones y cumplimiento legal.
3. Registrar analisis.
4. Definir decisiones y recursos.
5. Crear compromisos.
6. Hacer seguimiento.

### Casos de uso reales

- Gerencia aprueba presupuesto para controles de ruido tras resultados de medicion.
- Revision anual decide reforzar capacitaciones por alta accidentalidad.
- Se documenta decision de actualizar politica SST.

## 25. Reportes, analitica y cumplimiento

### Descripcion funcional

Genera reportes operativos, gerenciales, legales y de auditoria. Debe permitir exportaciones controladas y trazables.

### Submodulos

- Reportes por modulo.
- Reportes gerenciales.
- Exportacion de evidencias.
- Tableros por rol.
- Analitica de tendencias.
- Alertas predictivas.
- Auditoria de exportaciones.

### Entidades

- report_templates
- generated_reports
- report_exports
- report_permissions
- analytics_snapshots
- scheduled_reports

### Flujos de trabajo

1. Usuario selecciona reporte.
2. Sistema valida permisos.
3. Aplica filtros por empresa, sede y periodo.
4. Genera PDF, Excel o dashboard.
5. Registra exportacion.
6. Programa envio si aplica.

### Casos de uso reales

- Gerente recibe reporte mensual de cumplimiento del plan anual.
- Auditor descarga paquete de evidencias por criterio de Resolucion 0312.
- SST analiza tendencia de incidentes por area.

## 26. Integraciones

### Descripcion funcional

Permite conectar el SG-SST con ARL, proveedores de firma digital, correo, IoT, sistemas de nomina, talento humano, BI y almacenamiento documental.

### Submodulos

- ARL.
- Firmas digitales.
- Correo y mensajeria.
- IoT y sensores.
- Nomina y talento humano.
- Almacenamiento externo.
- Webhooks.
- Bitacora de integraciones.

### Entidades

- integrations
- integration_providers
- integration_credentials
- integration_events
- webhooks
- webhook_deliveries
- external_references
- sync_jobs

### Flujos de trabajo

1. Configurar proveedor.
2. Validar credenciales.
3. Mapear datos.
4. Ejecutar sincronizacion o webhook.
5. Registrar respuesta.
6. Reintentar errores.
7. Auditar intercambio de informacion.

### Casos de uso reales

- Envio de reporte de accidente a integracion ARL.
- Firma digital de politica SST por representante legal.
- Sensor IoT reporta temperatura alta y genera alerta preventiva.

## 27. Seguridad de la informacion y proteccion de datos sensibles

### Descripcion funcional

Modulo transversal para proteger datos personales, laborales, medicos, documentales y de auditoria.

### Submodulos

- Clasificacion de informacion.
- Consentimientos y autorizaciones.
- Enmascaramiento.
- Control de descarga.
- Retencion y eliminacion.
- Auditoria de accesos.
- Gestion de incidentes de seguridad.

### Entidades

- data_classifications
- privacy_consents
- sensitive_access_logs
- download_logs
- retention_policies
- data_deletion_requests
- security_incidents

### Flujos de trabajo

1. Clasificar dato o documento.
2. Definir permisos de acceso.
3. Registrar consulta o descarga.
4. Aplicar retencion.
5. Gestionar solicitud de titular si aplica.
6. Reportar incidente de seguridad.

### Casos de uso reales

- Un jefe ve restricciones laborales, pero no historia clinica detallada.
- Exportacion de datos de trabajadores queda auditada.
- Documento con datos sensibles solo puede ser descargado por SST autorizado.

## 28. Movilidad y operacion en campo

### Descripcion funcional

Extiende el SG-SST a trabajadores de campo para reportes, inspecciones, evidencias y consulta de documentos desde dispositivos moviles.

### Submodulos

- App movil o PWA.
- Inspecciones offline.
- Reporte de incidentes.
- Evidencias fotograficas.
- Georreferenciacion.
- Firma en pantalla.
- Sincronizacion.

### Entidades

- mobile_sessions
- offline_tasks
- field_reports
- geo_locations
- mobile_evidence
- sync_conflicts

### Flujos de trabajo

1. Usuario descarga tarea de campo.
2. Ejecuta inspeccion o reporte offline.
3. Captura fotos, ubicacion y firma.
4. Sincroniza al recuperar conexion.
5. Sistema valida conflictos.
6. Genera acciones.

### Casos de uso reales

- Inspector realiza checklist en obra sin internet.
- Trabajador reporta condicion insegura con foto y ubicacion.
- Supervisor firma cierre de permiso desde tablet.

## Modelo transversal de estados

Los modulos deben compartir estados comunes:

- Borrador.
- En revision.
- Aprobado.
- Publicado.
- En ejecucion.
- Vencido.
- Cerrado.
- Reabierto.
- Anulado.

Para acciones:

- Abierta.
- Asignada.
- En progreso.
- Pendiente de evidencia.
- Pendiente de verificacion.
- Eficaz.
- No eficaz.
- Cerrada.

## Entidades maestras recomendadas

- companies
- sites
- work_centers
- areas
- processes
- job_positions
- employees
- contractors
- users
- roles
- permissions
- arl_risk_classes
- document_categories
- hazard_categories
- action_statuses
- evidence_files
- audit_logs

## Trazabilidad minima por registro

Cada entidad critica debe incluir:

- company_id
- site_id, cuando aplique
- created_by
- created_at
- updated_by
- updated_at
- approved_by, cuando aplique
- approved_at, cuando aplique
- status
- version
- evidence_files
- audit_log_reference

## Flujos integrados clave

### Riesgo a plan anual

Matriz de peligros identifica riesgo prioritario -> se define control -> se crea actividad en plan anual -> se asigna responsable -> se ejecuta -> se carga evidencia -> se mide indicador.

### Incidente a mejora

Empleado reporta incidente -> SST investiga -> se identifican causas -> se crean acciones -> se actualiza matriz de peligros -> se mide eficacia -> se actualiza indicador de accidentalidad.

### Auditoria a plan de mejora

Auditoria genera hallazgo -> se clasifica no conformidad -> se crea accion correctiva -> se adjunta evidencia -> auditor verifica cierre -> gerencia revisa resultados.

### Documento a capacitacion

Nuevo procedimiento se aprueba -> se publica -> trabajadores reciben notificacion -> se programa capacitacion -> se registra asistencia -> se mide comprension.

### Examen ocupacional a restricciones

Examen periodico emite concepto -> se registran restricciones -> jefe recibe recomendacion operativa -> SST hace seguimiento -> se actualiza profesiograma si aplica.

## Priorizacion de implementacion por etapas

### Etapa 1: cumplimiento base

- Empresas, usuarios y roles.
- Empleados.
- Matriz legal.
- Politica, objetivos y responsabilidades.
- Plan anual.
- Matriz de peligros.
- Documentos.
- Capacitaciones.
- Inspecciones.
- Incidentes y accidentes.
- Indicadores.
- Auditorias.

### Etapa 2: operacion avanzada

- Acciones correctivas y mejora.
- EPP.
- Medicina preventiva y vigilancia epidemiologica.
- COPASST y convivencia.
- Contratistas.
- Emergencias.
- Activos y mantenimiento.
- Revision por la direccion.

### Etapa 3: escalabilidad e integraciones

- Tareas criticas y permisos de trabajo.
- Autoevaluacion avanzada Resolucion 0312.
- App movil/offline.
- BI y analitica.
- Integraciones ARL.
- Firmas digitales.
- IoT.
- Automatizaciones predictivas.

