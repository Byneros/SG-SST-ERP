# KPIs para un sistema SG-SST

Este documento define indicadores clave para un sistema SG-SST orientado a Colombia. La estructura sigue el enfoque del Decreto 1072 de 2015: indicadores de estructura, proceso y resultado. Cada indicador debe tener definicion, interpretacion, limite/meta, formula, fuente, frecuencia y responsables que conocen el resultado.

## Reglas generales de medicion

- Medir por empresa, sede, centro de trabajo, proceso, cargo, clase de riesgo y periodo.
- Separar empleados directos, contratistas y temporales cuando aplique.
- Guardar numerador, denominador, formula usada, fuente y usuario que registra.
- Mantener historico mensual y anual.
- Toda alerta critica debe poder generar una accion correctiva, preventiva o de mejora.
- Los indicadores de accidentalidad deben poder recalcularse si cambia la clasificacion de un evento.

## KPIs de resultado

| Indicador | Formula | Frecuencia | Visualizacion recomendada | Uso en toma de decisiones |
| --- | --- | --- | --- | --- |
| Indice de accidentalidad | `(Numero de accidentes de trabajo en el periodo / Numero promedio de trabajadores en el periodo) * 100` | Mensual, trimestral y anual | Tarjeta KPI, linea de tendencia, comparativo por sede | Identificar aumento de accidentes y priorizar intervenciones en areas criticas. |
| Frecuencia de accidentes | `(Numero de accidentes de trabajo / Horas hombre trabajadas) * 1.000.000` | Mensual y anual | Linea temporal con meta, ranking por proceso | Comparar accidentalidad entre periodos o sedes ajustando por exposicion real. |
| Severidad de accidentes | `(Dias perdidos por accidentes de trabajo / Horas hombre trabajadas) * 1.000.000` | Mensual y anual | Linea temporal, semaforo contra meta | Evaluar impacto real de lesiones y priorizar controles sobre eventos graves. |
| Tasa de incidentes | `(Numero de incidentes y casi accidentes reportados / Numero promedio de trabajadores) * 100` | Mensual | Barras por sede/proceso, embudo de reportes | Medir cultura de reporte y anticipar accidentes antes de que ocurran lesiones. |
| Proporcion de accidentes investigados | `(Accidentes investigados / Accidentes reportados) * 100` | Mensual | Gauge o barra de cumplimiento | Controlar cumplimiento del proceso de investigacion y evitar cierres sin analisis causal. |
| Oportunidad de investigacion | `(Investigaciones cerradas dentro del plazo definido / Total investigaciones cerradas) * 100` | Mensual | Semaforo por responsable | Detectar retrasos en investigacion y escalar casos vencidos. |
| Reincidencia de eventos | `(Eventos repetidos por misma causa raiz / Total eventos del periodo) * 100` | Trimestral | Pareto por causa raiz | Saber si las acciones correctivas son eficaces o si se repiten causas. |
| Ausentismo por causa medica | `(Dias de ausencia por causa medica / Dias laborales programados) * 100` | Mensual | Serie temporal, mapa por area | Identificar tendencias de salud laboral y activar vigilancia epidemiologica. |
| Enfermedades laborales calificadas | `Numero de enfermedades laborales calificadas en el periodo` | Trimestral y anual | Tarjeta KPI, tendencia anual | Evaluar efectividad de programas de vigilancia y controles higienicos. |
| Cumplimiento de objetivos SST | `(Objetivos SST cumplidos / Total objetivos SST definidos) * 100` | Trimestral y anual | Scorecard gerencial | Revisar si el SG-SST esta generando resultados frente a metas aprobadas. |

## KPIs de proceso

| Indicador | Formula | Frecuencia | Visualizacion recomendada | Uso en toma de decisiones |
| --- | --- | --- | --- | --- |
| Cumplimiento del plan anual | `(Actividades ejecutadas del plan anual / Actividades programadas del plan anual) * 100` | Mensual | Barra de avance anual, calendario heatmap | Reasignar recursos, reprogramar actividades y reportar avance a gerencia. |
| Cumplimiento oportuno del plan anual | `(Actividades ejecutadas dentro de fecha / Actividades programadas vencidas) * 100` | Mensual | Semaforo por responsable/proceso | Diferenciar avance real de actividades ejecutadas tarde. |
| Ejecucion del plan de capacitacion | `(Capacitaciones ejecutadas / Capacitaciones programadas) * 100` | Mensual | Cronograma, barra acumulada | Controlar cumplimiento del plan de formacion SST. |
| Cobertura de capacitacion | `(Trabajadores capacitados / Trabajadores convocados o requeridos) * 100` | Mensual y por evento | Barras por tema, cargo y sede | Identificar cargos o turnos sin cobertura suficiente. |
| Aprobacion de evaluaciones de capacitacion | `(Trabajadores que aprueban evaluacion / Trabajadores evaluados) * 100` | Por capacitacion y mensual | Distribucion de notas, semaforo por tema | Medir eficacia de la capacitacion, no solo asistencia. |
| Cumplimiento de inspecciones | `(Inspecciones ejecutadas / Inspecciones programadas) * 100` | Mensual | Calendario y barras por tipo | Confirmar que los controles preventivos se estan realizando. |
| Hallazgos por inspeccion | `Numero de hallazgos / Numero de inspecciones ejecutadas` | Mensual | Linea y Pareto por tipo de hallazgo | Identificar areas con deterioro de condiciones de seguridad. |
| Cierre de acciones correctivas | `(Acciones cerradas / Acciones generadas) * 100` | Mensual | Funnel abierto-en progreso-cerrado | Controlar capacidad de respuesta y evitar acumulacion de acciones. |
| Oportunidad de cierre de acciones | `(Acciones cerradas a tiempo / Acciones vencidas o cerradas) * 100` | Mensual | Semaforo por responsable | Escalar acciones vencidas y priorizar recursos. |
| Eficacia de acciones | `(Acciones verificadas como eficaces / Acciones verificadas) * 100` | Mensual y trimestral | Gauge, tendencia trimestral | Determinar si las acciones eliminan o reducen la causa del problema. |
| Actualizacion de matriz de peligros | `(Matrices revisadas o actualizadas / Matrices que requieren revision) * 100` | Trimestral y anual | Semaforo por sede/proceso | Asegurar que cambios, incidentes e inspecciones actualicen la gestion del riesgo. |
| Cumplimiento de mediciones higienicas | `(Mediciones realizadas / Mediciones programadas) * 100` | Segun cronograma | Cronograma, cumplimiento por peligro | Decidir controles de higiene industrial y presupuesto tecnico. |

## KPIs de estructura

| Indicador | Formula | Frecuencia | Visualizacion recomendada | Uso en toma de decisiones |
| --- | --- | --- | --- | --- |
| Politica SST vigente y comunicada | `(Trabajadores con politica comunicada / Total trabajadores) * 100` | Anual y al ingreso | Tarjeta KPI, barra por sede | Evidenciar compromiso gerencial y comunicacion del SG-SST. |
| Roles y responsabilidades asignadas | `(Cargos con responsabilidades SST asignadas / Total cargos aplicables) * 100` | Semestral | Matriz cargo vs responsabilidad | Cerrar brechas de rendicion de cuentas. |
| Disponibilidad documental SG-SST | `(Documentos obligatorios vigentes / Documentos obligatorios aplicables) * 100` | Mensual | Semaforo documental | Priorizar actualizacion y aprobacion documental. |
| Recursos ejecutados SG-SST | `(Presupuesto SG-SST ejecutado / Presupuesto SG-SST aprobado) * 100` | Mensual y trimestral | Barra presupuestal | Controlar financiacion del plan anual y justificar ajustes. |
| Funcionamiento COPASST/Vigia | `(Reuniones realizadas / Reuniones programadas) * 100` | Mensual o bimestral | Cronograma y cumplimiento | Evaluar participacion de trabajadores y gestion de compromisos. |
| Plan de emergencias actualizado | `(Sedes con plan de emergencias vigente / Total sedes) * 100` | Semestral | Mapa o tabla por sede | Identificar sedes sin preparacion documentada. |
| Cobertura de profesiogramas | `(Cargos con profesiograma vigente / Total cargos) * 100` | Semestral | Barra por proceso | Alinear examenes medicos y restricciones con riesgos reales del cargo. |

## KPIs por modulo funcional

### Riesgos y matriz de peligros

| Indicador | Formula | Frecuencia | Visualizacion recomendada | Uso |
| --- | --- | --- | --- | --- |
| Riesgos criticos abiertos | `Conteo de riesgos con nivel CRITICAL sin control cerrado` | Semanal | Tarjeta roja y lista priorizada | Priorizar controles inmediatos y recursos. |
| Riesgos altos sin plan de accion | `(Riesgos HIGH/CRITICAL sin accion asociada / Total riesgos HIGH/CRITICAL) * 100` | Semanal | Semaforo por proceso | Evitar riesgos priorizados sin tratamiento. |
| Reduccion de riesgo residual | `Promedio riesgo inherente - promedio riesgo residual` | Trimestral | Barras antes/despues | Medir efectividad de controles. |

### Documentos

| Indicador | Formula | Frecuencia | Visualizacion recomendada | Uso |
| --- | --- | --- | --- | --- |
| Documentos vencidos | `Conteo de documentos con fecha de vencimiento menor a hoy y estado vigente` | Semanal | Lista vencidos y tarjeta KPI | Priorizar revision documental. |
| Lectura de documentos publicados | `(Trabajadores que confirmaron lectura / Trabajadores objetivo) * 100` | Mensual | Barra por documento/cargo | Evidenciar divulgacion y reforzar comunicacion. |
| Tiempo promedio de aprobacion documental | `Promedio(fecha aprobacion - fecha envio revision)` | Mensual | Linea temporal | Detectar cuellos de botella en aprobaciones. |

### Capacitaciones

| Indicador | Formula | Frecuencia | Visualizacion recomendada | Uso |
| --- | --- | --- | --- | --- |
| Vencimiento de competencias criticas | `(Competencias criticas vencidas / Competencias criticas requeridas) * 100` | Semanal | Semaforo por trabajador/cargo | Bloquear tareas criticas o programar reentrenamiento. |
| Asistencia a capacitaciones | `(Asistentes / Convocados) * 100` | Por evento | Barra por sesion | Gestionar ausentes y turnos. |
| Eficacia de capacitacion | `(Evaluaciones aprobadas / Evaluaciones presentadas) * 100` | Por evento | Histograma de calificaciones | Mejorar metodologia o reforzar temas. |

### Incidentes y accidentes

| Indicador | Formula | Frecuencia | Visualizacion recomendada | Uso |
| --- | --- | --- | --- | --- |
| Eventos por tipo | `Conteo por incidente, accidente, casi accidente, enfermedad laboral` | Mensual | Barras apiladas | Distinguir cultura de reporte vs accidentalidad real. |
| Causas raiz recurrentes | `Conteo de eventos por causa raiz` | Trimestral | Pareto 80/20 | Priorizar intervenciones sistemicas. |
| Dias perdidos por accidente | `Suma de dias de incapacidad por accidente de trabajo` | Mensual | Linea y ranking por area | Dimensionar impacto operativo y humano. |

### Auditorias

| Indicador | Formula | Frecuencia | Visualizacion recomendada | Uso |
| --- | --- | --- | --- | --- |
| Cumplimiento del programa de auditoria | `(Auditorias ejecutadas / Auditorias programadas) * 100` | Trimestral | Cronograma de auditoria | Asegurar verificacion periodica del sistema. |
| No conformidades abiertas | `Conteo de no conformidades sin cierre` | Mensual | Tarjeta KPI y tabla por criticidad | Priorizar cierres antes de auditorias externas. |
| Cierre oportuno de hallazgos | `(Hallazgos cerrados a tiempo / Hallazgos con fecha vencida o cerrada) * 100` | Mensual | Semaforo por responsable | Controlar respuesta a auditorias. |

### Plan anual

| Indicador | Formula | Frecuencia | Visualizacion recomendada | Uso |
| --- | --- | --- | --- | --- |
| Avance fisico del plan | `(Actividades completadas / Actividades totales) * 100` | Mensual | Barra acumulada anual | Presentar avance operativo. |
| Avance ponderado del plan | `Suma(peso actividad * avance actividad) / Suma(pesos)` | Mensual | Gauge gerencial | Medir avance real cuando no todas las actividades pesan igual. |
| Ejecucion presupuestal SST | `(Valor ejecutado / Valor presupuestado) * 100` | Mensual | Barra presupuesto vs ejecutado | Gestionar recursos y justificar desviaciones. |

## Visualizaciones recomendadas por perfil

### Gerencia

- Scorecard mensual con 8 a 12 KPIs.
- Semaforos de cumplimiento.
- Tendencia trimestral de accidentalidad, severidad y plan anual.
- Ranking de sedes/procesos criticos.
- Alertas de riesgos legales o no conformidades mayores.

### Responsable SST

- Bandeja de acciones vencidas.
- Mapa de calor por sede, area y riesgo.
- Pareto de causas raiz, hallazgos e incidentes.
- Calendario de capacitaciones, inspecciones y auditorias.
- Tablero de evidencias faltantes.

### Jefes de area

- Cumplimiento de acciones asignadas.
- Trabajadores pendientes de capacitacion.
- Hallazgos de inspeccion del area.
- Incidentes y condiciones inseguras reportadas.

### Auditor

- Matriz de cumplimiento por requisito.
- Evidencias por estandar minimo.
- No conformidades abiertas/cerradas.
- Trazabilidad de cambios, aprobaciones y cierres.

## Metas sugeridas iniciales

Estas metas deben parametrizarse por empresa, sector, riesgo y linea base historica.

| Indicador | Meta inicial sugerida |
| --- | --- |
| Cumplimiento del plan anual | `>= 90%` |
| Cierre oportuno de acciones | `>= 85%` |
| Investigacion de accidentes | `100%` |
| Documentos obligatorios vigentes | `>= 95%` |
| Cobertura de capacitacion obligatoria | `>= 90%` |
| Auditorias ejecutadas | `100% del programa aprobado` |
| Politica SST comunicada | `100%` |
| Riesgos criticos sin plan | `0%` |

## Modelo de datos sugerido para KPIs

```sql
indicators(
  id,
  company_id,
  code,
  name,
  category,
  formula,
  unit,
  periodicity,
  target_value,
  responsible_user_id,
  is_active
)

indicator_measurements(
  id,
  company_id,
  indicator_id,
  period_start,
  period_end,
  numerator,
  denominator,
  value,
  target_value,
  source_module,
  calculated_at,
  calculated_by,
  observations
)
```

## Alertas automaticas recomendadas

- KPI por debajo de meta durante dos periodos consecutivos.
- Aumento de accidentes o incidentes mayor al 20% frente al periodo anterior.
- Acciones vencidas de riesgo alto o critico.
- Documento obligatorio vencido.
- Competencia critica vencida.
- Riesgo critico sin plan de accion.
- Auditoria vencida o no conformidad mayor sin cierre.

## Priorizacion para implementar

1. Cumplimiento del plan anual.
2. Accidentes, frecuencia y severidad.
3. Investigaciones cerradas y oportunidad de investigacion.
4. Cierre oportuno y eficacia de acciones.
5. Cobertura y eficacia de capacitaciones.
6. Documentos vigentes y lectura documental.
7. Riesgos criticos abiertos y riesgos sin plan.
8. Cumplimiento de inspecciones.
9. Auditorias y hallazgos.
10. Ausentismo y vigilancia epidemiologica.

