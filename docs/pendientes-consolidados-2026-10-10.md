# Trabajo pendiente consolidado — SG-SST-ERP

Fecha de corte: **2026-10-10** (actualizado con el cierre S16 del 2026-10-13) · Rama `main` · Último commit: `d243f86` (workflow de aprobación de documentos).
Fuentes: issues #43 (matriz) y #5–#54 verificados vía `gh` · CI en verde (últimas 4 corridas exitosas, la última `37981207806` 2026-10-09) · Suite local al 2026-10-13: **519/519 unitarias · 67/67 e2e-db · builds API/web OK**.

> Este documento reemplaza/adapta el análisis 2026-10-07 (`docs/analisis-avance-sprints-2026-10-07.md`); conserva su convención: porcentajes derivados de checkboxes con evidencia, no de estimaciones.

---

## 1. Estado global al corte

| Sprint | Tema | Historias cerradas | Avance verificado | Restante |
|---|---|---|---|---|
| S2 | auth-usuarios-rbac | 1/1 | **100%** | 0% |
| S3 | empresas-empleados-sedes | 2/2 | **100%** (cerrado 2026-10-07) | 0% |
| S4 | documentos-notificaciones | 0/2 | **~25%** | 75% |
| S5 | riesgos-gtc45 | 0/2 | **0%** (QA no ejecutado) | 100% |
| S6 | incidentes-capacitacion | 0/3 | **0%** (QA no ejecutado) | 100% |
| S7 | seguridad-hardening | 2/2 | **100%** (cerrado 2026-10-07) | 0% |
| S8–S13 | evaluaciones → contratistas | 21/21 | **100%** | 0% |
| S14 | gestion-del-cambio | 2/2 | **100%** (cerrado 2026-10-07) | 0% |
| S15 | auditoria-indicadores-reportes | 1/3 | **~46%** (1 de 3 issues cerrado formalmente; #40 y #41 abiertos) | ~54% |
| S16 | asistente IA (fuera de matriz original, ahora con issues #46–#54) | 9/9 cerrados (#46–#54) | **100%** (cierre formal en bloque 2026-10-13, incluido el smoke de `capabilities` por rol 16/16 y el QA UI del entry point 6/6) | 0% (bonus P3 pendiente: escritura con confirmación §7) |

- **Formal (issues cerrados / total de la matriz #43):** 33/38 ≈ **87%** (S4–S6 y el alcance original de S15 quedan fuera).
- **Funcional verificado:** ≈ **90%** (S4–S6 siguen siendo la brecha principal de QA, no de implementación).
- **Actualización 2026-10-13:** el cierre formal en bloque de S16 elevó el formal desde 26/38; quedan abiertos #8–#14 (S4–S6), #40/#41/#55/#56 (S15) y #43 (matriz, S1).

**Nota importante de revalidación:** los sprints S2, S7, S14 y S8–S13 aparecen cerrados formalmente, pero eso no significa que cada módulo haya sido revalidado después de todos los cambios recientes (S15 hallazgos/acciones/bandeja + S16 framework/asistentes tocaron repositorios y módulos transversales). Los reads/queries de esos módulos fueron adaptados para asistentes (trainings, ppe, medical), pero no hay una corrida de humo formal post-S16 para todo el ciclo.

**Nota metodológica:** S1 (`fundacion`) no aparece como historias cerradas en la matriz #43 (solo es label del propio #43): **no hay forma de calcular su avance de forma honesta** sin recuperar su alcance original (qué historias/criterios eran). Es pendiente de gobernanza.

---

## 2. Sprints S4–S6 — QA funcional pendiente (P1, mayor brecha)

La implementación existe; lo pendiente es **QA funcional con datos demo desde la UI** (criterios de los issues #8–#14, sin dependencias técnicas entre sí salvo compartir sesión de QA y datos demo).

### S4 — Documentos y notificaciones (75% restante)

| Issue | Historia | Pendiente |
|---|---|---|
| #8 S4.1 | QA completo del ciclo documental | Recorrer desde UI con datos demo: crear → cargar → versionar → aprobar → publicar → vencer → notificar → archivar. Verificar AuditLog en cada paso + `companyId`. |
| #9 S4.2 | QA de entregas externas | Corrida con SMTP/WhatsApp de prueba o `SKIPPED` documentado: entrega exitosa registra intento+estado; fallo → reintento con backoff (`EXTERNAL_DELIVERY_*`); límite de intentos → fallida final; aislamiento por empresa. El e2e `external-deliveries-multi-tenant.e2e-spec.ts` ya existe; falta corrida de aceptación. |

### S5 — Riesgos GTC-45 (100% restante)

| Issue | Historia | Pendiente |
|---|---|---|
| #10 S5.1 | Cerrar flujo completo GTC-45 | Crear desde UI: Proceso → Actividad → Peligro → Riesgo → Valoración → Nivel → Control → Plan de intervención → Seguimiento. Resultado visible en dashboard/reportes. |
| #11 S5.2 | QA de trazabilidad de riesgos | Verificar 100% de campos de trazabilidad obligatorios en UI/API + que el reporte de matriz incluya la trazabilidad completa. |

> Riesgo de negocio: es la mayor brecha del ciclo PHVA "Planear". Ejecutar antes del despliegue: los riesgos son el dato maestro del SG-SST.

### S6 — Incidentes y capacitación (100% restante)

| Issue | Historia | Pendiente |
|---|---|---|
| #12 S6.1 | Investigación de accidentes | Reporte → Investigación → Causas → Evidencias → Acciones → Responsable → Seguimiento → Cierre, con datos demo. |
| #13 S6.2 | Trazabilidad de capacitación | Trabajador → Curso → Asistencia → Evaluación → Evidencia → Vencimiento; vencimientos visibles en dashboard. |
| #14 S6.3 | Indicadores ligados | Indicador de accidentalidad y de cumplimiento de capacitación calculados desde datos reales creados en #12/#13. |

**Estimación:** una sola sesión de QA de 1–2 días cierra los 7 issues (#8–#14).

---

## 3. S15 — Cierre parcial (~46% formal)

| Issue | Historia | Estado | Pendiente |
|---|---|---|---|
| #42 S15.3 (cerrado) | Estrategia de borrado | **75% — quedó 1 criterio sin marcar** | Fase 2: unique parcial de `Site.code` + drop de columnas vestigiales → el issue **#4** (que ya figura CLOSED, aparentemente fuera de orden o referencia cruzada) quedó sin resolver: falta la **migración + verificación en dev/prod**. ⚠️ el cuerpo de #42 no refleja que #4 ya no está abierto formalmente. |
| #40 S15.1 | QA integral de indicadores y reportes | abierto | Decisión de producto pendiente: el alcance original (QA datos → dashboard → reporte con PDF/CSV con datos demo) no se ejecutó. El sub-alcance S15.1 real (hallazgos unificados) ya está implementado y cerrado (commit `5bef1d1`). Alternativas: (a) ejecutar el QA original, o (b) re-denominar el issue y crear uno nuevo para el QA original. Hoy coexisten **#55 (S15.5, QA del ciclo de auditoría)** y **#56 (S15.4, QA reportes/exportaciones)** creados 2026-10-09 como issues nuevos y abiertos. |
| #41 S15.2 | Auditoría SG-SST: hallazgo → acción → evidencia → cierre | abierto | Similar a #40: módulo implementado, falta QA específico del ciclo `sgsst-audits` → finding → acción → cierre. Solapa con #55. |
| #55 S15.5 (nuevo) | QA integral del ciclo de auditoría | abierto | Ejecutar el QA completo (dados demo → hallazgo → acción → cierre). |
| #56 S15.4 (nuevo) | QA integral de reportes y exportaciones | abierto | Ejecutar el QA completo (dados demo → PDF/CSV/workflow). |

**Pendiente de gobernanza:** resolver solapamientos #40/#41 vs #55/#56 (podrían cerrarse los viejos si #55/#56 los absorben, o viceversa). ~30 min de decisión de producto.

---

## 4. S16 — Asistente inteligente (✅ cerrado formalmente el 2026-10-13)

Cierre en bloque ejecutado el 2026-10-13: los issues #47–#51, #53 y #54 se
cerraron con evidencia (suite 519/519 + 67/67 e2e-db, e2e-db del asistente
12/12 en `b0a07cb`, smoke de `capabilities` por rol 16/16 y QA UI del entry
point 6/6 — ver `docs/evidencia-smoke-s16-capabilities.md`). Con #46 y #52
ya cerrados, **S16 queda 9/9 cerrado formalmente (~70% técnico original pasó
a 100% formal)**. Sigue abierto solo el roadmap P3 declarado en el plan:

1. Escalation/diagnóstico bonus (P3): `escalationLevel` en Task para escalar a jefatura tras N hitos (solo si el volumen lo exige).
2. Escritura con confirmación (§7 del plan): proposals con doble confirmación en UI. P3 posterior.
3. Higiene de matriz: los checkboxes de los cuerpos de #47–#51/#53/#54 quedaron sin marcar (los cierres se hicieron por comentario; ver ítem 6 del plan de acción).

---

## 5. Deudas transversales

1. **CI:** ✅ **Resuelta** (última corrida verde `37981207806` 2026-10-09 tras el fix de `SEED_ADMIN_PASSWORD` del 2026-10-07, commit `00e7794`). Solo restaba la falla puntual `37819749540` del 2026-10-08 ya superada con 4 corridas exitosas consecutivas después.
2. **Despliegue cloud:** todo el trabajo técnico preparado (staging.env.example, Caddyfile, bootstrap-vm.sh, release.yml). Pendiente **solo decisión de negocio**: proveedor VM, dominio/TLS, ambientes GitHub, secretos y primer release staging. Checklist en `docs/despliegue-preparacion.md`.
3. **Higiene de matriz:** cuerpos de #17–#28 con checkboxes sin marcar (cerrados con evidencia en comentarios). Actualizar para que los porcentajes de #43 sean derivables de checkboxes. Ídem: actualizar cuerpos de #40/#41/#42 y #47–#51/#53/#54 con la evidencia ya existente antes de cerrarlos.
4. **S1:** recuperar el alcance original (historias/criterios) para poder calcular su avance de forma honesta.
5. **Pre-producción (fuera de sprint, declarado en informe S7):** pentest externo, fuzzing, lockout del SSO.
6. **Higiene local (no versionada):** artefactos `deploy;C/` y `docker-compose.prod.yml;C` en la raíz local (no están en git).

---

## 6. Plan de acción ordenado (al corte 2026-10-10)

| # | Acción | Prioridad | Estimación | Bloquea |
|---|---|---|---|---|
| 1 | **Sesión de QA funcional S4–S6** (#8–#14): ciclo documental, entregas externas, GTC-45, incidentes, capacitación, indicadores con datos demo | P1 | 1–2 días | Despliegue a producción |
| 2 | **Gobernanza S15:** resolver solapamiento #40/#41 vs #55/#56 | P1 | 30 min | Cierre S15 |
| 3 | **Cierre en bloque S16:** comentar evidencia en #47–#51, #53, #54 y cerrar (el trabajo técnico ya está hecho y verificado, incluido e2e-db 12/12 en `b0a07cb`); pendiente técnico único: smoke de `capabilities` por rol | P1 | ~~2–4 h~~ ✅ **Ejecutado 2026-10-13**: smoke 16/16 (`docs/evidencia-smoke-s16-capabilities.md`), QA UI entry point 6/6 y 7 issues cerrados | ~~Porcentaje formal de S16~~ S16 100% formal |
| 4 | **QA S15.4/S15.5 (#55/#56):** reportes/exportaciones + ciclo de auditoría con datos demo | P2 | ½–1 día | Cierre S15 |
| 5 | **Fase 2 de borrado (#42 residual / #4):** migración `Site.code` unique parcial + drop columnas vestigiales | P2 | ½ día | Cierre total de #42 |
| 6 | **Higiene de matriz:** checkboxes en cuerpos de #17–#28 y cuerpos de issues S16 | P2 | 1–2 h | Derivabilidad de % |
| 7 | **Recuperar alcance S1** (gobernanza) | P3 | 1 h | Honestidad del % global |
| 8 | **Decisión negocio de despliegue cloud** + ejecutar checklist `despliegue-preparacion.md` | P2 | decisión interna | Release staging |

---

*Documento consolidado desde `docs/analisis-avance-sprints-2026-10-07.md` + verificación en vivo de issues/CI (`gh`) al 2026-10-10.*
