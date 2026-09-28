/**
 * Base de conocimiento del asistente (Sprint 16, tareas 16.4 y 16.5).
 *
 * - Contenido curado desde docs/modulos-funcionales-sgsst-colombia.md y los
 *   modulos realmente implementados del ERP. Es contexto de solo lectura que
 *   se inyecta en el prompt de sistema; aqui nunca hay datos de tenant (eso
 *   solo ocurre via @datos con herramientas autorizadas).
 * - Normas citadas como fuentes (16.5), con secciones verificadas y estado de
 *   vigencia. Resolucion 2346 de 2007 fue DEROGADA por la Resolucion 1843 de
 *   2025 (evaluaciones medicas ocupacionales): la fuente vigente es la 1843 y
 *   la 2346 se conserva en el indice marcada como derogada.
 * - El modulo NO existe en el ERP => no se ofrece como funcionalidad, aunque
 *   aparezca en el doc funcional (p. ej. emergencias, contratistas).
 */

export type HelpTopic = {
  /** Vista del ERP donde aplica el tema (hash routing de sgsst-web). */
  view: string;
  title: string;
  /** Que puede hacer el usuario en este modulo del ERP. */
  what: string;
  /** Preguntas tipicas que cubre este tema. */
  keywords: string[];
  /** Referencias normativas del repo (docs/modulos-funcionales). */
  norms: string[];
};

export const HELP_TOPICS: HelpTopic[] = [
  {
    view: 'dashboard / companies / sites',
    title: 'Empresas y sedes',
    what:
      'Alta de empresas con NIT, clase de riesgo ARL (I a V), actividad economica y sedes ' +
      '(codigo, ciudad, direccion, sede principal). Todo se filtra por empresa: el SUPER_ADMIN ' +
      'elige la empresa activa desde la barra superior y los demas roles solo ven la suya.',
    keywords: [
      'empresa',
      'empresas',
      'sede',
      'sedes',
      'nit',
      'arl',
      'riesgo arl',
      'clase de riesgo',
    ],
    norms: ['Decreto 1072 de 2015'],
  },
  {
    view: 'employees / users',
    title: 'Empleados y usuarios',
    what:
      'Empleados con documento, cargo, tipo de contrato, estado laboral, sede y fecha de ingreso; ' +
      'usuarios del sistema con roles ADMIN, SST, EMPLOYEE y AUDITOR, activacion/desactivacion y ' +
      'MFA opcional. EMPLOYEE solo consulta datos y reporta, no administra.',
    keywords: [
      'empleado',
      'empleados',
      'trabajador',
      'usuario',
      'usuarios',
      'rol',
      'roles',
      'mfa',
      'contrato',
    ],
    norms: ['Ley 1562 de 2012'],
  },
  {
    view: 'risks',
    title: 'Riesgos y matriz de peligros',
    what:
      'Registro de peligros por sede con nivel LOW/MEDIUM/HIGH/CRITICAL, descripcion y controles. ' +
      'La metodologia de referencia es GTC 45 (identificar, evaluar, valorar y controlar); el ERP ' +
      'almacena el resultado y su seguimiento, y alimenta indicadores y planes de accion.',
    keywords: [
      'riesgo',
      'riesgos',
      'peligro',
      'matriz',
      'gtc',
      'gtc 45',
      'valoracion',
      'controles',
    ],
    norms: ['GTC 45', 'Decreto 1072 de 2015'],
  },
  {
    view: 'incidents / unsafeReports',
    title: 'Incidentes, accidentes y reportes de condiciones inseguras',
    what:
      'Incidentes y accidentes de trabajo con fecha, descripcion, sede y estado (PENDING, ' +
      'IN_PROGRESS, RESOLVED); actos y condiciones inseguras con severidad, anonimato opcional y ' +
      'cierre. EMPLOYEE puede reportar (canal de participacion). La investigacion sigue la ' +
      'Resolucion 1401 de 2007.',
    keywords: [
      'incidente',
      'incidentes',
      'accidente',
      'accidentes',
      'reporte',
      'actos inseguros',
      'condiciones inseguras',
      'investigacion',
    ],
    norms: ['Resolucion 1401 de 2007', 'Ley 1562 de 2012'],
  },
  {
    view: 'trainings',
    title: 'Capacitaciones',
    what:
      'Capacitaciones con titulo, descripcion, fecha y sede; el seguimiento de vencimientos ' +
      'alimenta alertas y el dashboard (capacitaciones vencidas/proximas). Evidencias relacionadas ' +
      'se gestionan desde Documentos.',
    keywords: [
      'capacitacion',
      'capacitaciones',
      'induccion',
      'entrenamiento',
      'curso',
      'formacion',
    ],
    norms: ['Decreto 1072 de 2015', 'Resolucion 0312 de 2019'],
  },
  {
    view: 'documents',
    title: 'Documentos y gestion documental',
    what:
      'Documentos con categoria (politica, procedimiento, certificado, evidencias), version, ' +
      'vigencia (expiresAt), estado DRAFT/PUBLISHED/EXPIRED/ARCHIVED y descarga con control de ' +
      'acceso. Las evidencias de auditorias y actividades se enlazan aqui.',
    keywords: [
      'documento',
      'documentos',
      'evidencia',
      'evidencias',
      'version',
      'vigencia',
      'politica',
      'procedimiento',
    ],
    norms: ['Decreto 1072 de 2015', 'Resolucion 0312 de 2019'],
  },
  {
    view: 'annualWorkPlans',
    title: 'Plan anual de trabajo (PAT)',
    what:
      'Plan anual por vigencia con actividades organizadas por ciclo PHVA (PLANEAR, HACER, ' +
      'VERIFICAR, ACTUAR/ACT), responsable, fecha, avance %, presupuesto y evidencia enlazada; ' +
      'aprobacion por gerencia y progreso consolidado del plan.',
    keywords: [
      'plan anual',
      'pat',
      'plan de trabajo',
      'actividad',
      'actividades',
      'phva',
      'avance',
      'cronograma',
    ],
    norms: ['Decreto 1072 de 2015', 'Resolucion 0312 de 2019'],
  },
  {
    view: 'plannedInspections / unplannedInspections',
    title: 'Inspecciones planeadas y no planeadas',
    what:
      'Inspecciones planeadas con items por section/pregunta, programacion, ejecucion y resultado; ' +
      'no planeadas por motivo/area. Los hallazgos generan acciones correctivas y pueden vincularse ' +
      'a riesgos de la matriz.',
    keywords: [
      'inspeccion',
      'inspecciones',
      'hallazgo',
      'hallazgos',
      'recorrido',
      'checklist',
    ],
    norms: ['Decreto 1072 de 2015', 'Resolucion 0312 de 2019'],
  },
  {
    view: 'ppe',
    title: 'EPP (elementos de proteccion personal)',
    what:
      'Catalogo de elementos (tipo, talla, norma, vida util, stock y stock minimo) y entregas por ' +
      'empleado con cantidad, fecha, reposicion programada y firma; alertas de stock bajo minimo.',
    keywords: [
      'epp',
      'proteccion personal',
      'dotacion',
      'entrega',
      'stock',
      'reposicion',
    ],
    norms: ['Decreto 1072 de 2015', 'Resolucion 0312 de 2019'],
  },
  {
    view: 'medical',
    title: 'Medicina laboral (examenes ocupacionales)',
    what:
      'Perfiles de examen por cargo (tipo y periodicidad), examenes ocupacionales (ingreso, ' +
      'periodico, retiro, postincapacidad, cambio de cargo) con concepto APTO/NO_APTO/' +
      'APTO_RESTRICCION y restricciones por empleado. Datos de salud: solo ADMIN/SST gestionan y ' +
      'AUDITOR consulta; el asistente NO entrega estos datos por @datos. Norma vigente: ' +
      'Resolucion 1843 de 2025 (derogo la Resolucion 2346 de 2007).',
    keywords: [
      'medicina',
      'examen',
      'examenes',
      'ocupacional',
      'restriccion',
      'historia clinica',
      'aptitud',
      '1843',
    ],
    norms: ['Resolucion 1843 de 2025', 'Ley 1562 de 2012'],
  },
  {
    view: 'sgsstEvaluations / legalCompliance',
    title: 'Evaluacion de estandares minimos y mapa normativo',
    what:
      'Autoevaluacion de estandares minimos de la Resolucion 0312 de 2019 por clase de riesgo con ' +
      'puntaje y % de cumplimiento por numeral; matriz legal con requisitos, aplicabilidad, ' +
      'evidencias y brechas por norma.',
    keywords: [
      'evaluacion',
      'estandares minimos',
      '0312',
      'autoevaluacion',
      'legal',
      'normograma',
      'cumplimiento',
      'requisitos',
    ],
    norms: ['Resolucion 0312 de 2019', 'Decreto 1072 de 2015'],
  },
  {
    view: 'indicators / reports',
    title: 'Indicadores y reportes',
    what:
      'Indicadores con formula, unidad, direccion (mayor/menor es mejor), metas por periodo y ' +
      'mediciones; reportes exportables CSV/PDF (empleados, documentos vencidos, auditorias, ' +
      'resumen, plan anual) con cola de exportaciones y expiracion.',
    keywords: [
      'indicador',
      'indicadores',
      'kpi',
      'reporte',
      'reportes',
      'exportar',
      'metrica',
      'ausentismo',
    ],
    norms: ['Resolucion 0312 de 2019'],
  },
  {
    view: 'audit',
    title: 'Auditoria del sistema',
    what:
      'Bitacora de acciones del ERP (quien, que, cuando) incluyendo las consultas de datos del ' +
      'asistente (AI_ASSISTANT_DATA_QUERY). Visible para SUPER_ADMIN, ADMIN y AUDITOR.',
    keywords: ['auditoria', 'bitacora', 'trazabilidad', 'log', 'quien hizo'],
    norms: ['Decreto 1072 de 2015'],
  },
];

/**
 * Indice de fuentes normativas (tarea 16.5). Cada entrada tiene estado de
 * vigencia y secciones verificadas: el modelo solo puede citar lo que aparece
 * aqui. Secciones verificadas contra gestores normativos y textos oficiales
 * el 2026-09-28 (funcionpublica.gov.co, alcaldiabogota.gov.co, mintrabajo,
 * fondoriesgoslaborales.gov.co).
 */
export type NormSource = {
  name: string;
  scope: string;
  /** Estado de vigencia; las derogadas no se citan como vigentes. */
  status: 'vigente' | 'derogada';
  /** Reemplazo vigente cuando status es 'derogada'. */
  replacedBy?: string;
  /** Secciones citables verificadas; no citar secciones fuera de esta lista. */
  sections: string[];
  /** Fecha de la ultima verificacion de vigencia y secciones (AAAA-MM-DD). */
  lastVerified: string;
};

export const NORM_SOURCES: NormSource[] = [
  {
    name: 'Decreto 1072 de 2015',
    scope:
      'Decreto Unico Reglamentario del Sector Trabajo; Libro 2, Parte 2, Titulo 4, Capitulo 6: ' +
      'Sistema de Gestion de SST basado en mejora continua (ciclo PHVA).',
    status: 'vigente',
    sections: [
      'Articulo 2.2.4.6.4: definicion del SG-SST y ciclo PHVA.',
      'Articulo 2.2.4.6.8: obligaciones del empleador (el numeral 7 refiere el plan anual de trabajo).',
      'Articulo 2.2.4.6.12: plan anual de trabajo del SG-SST.',
      'Articulo 2.2.4.6.13: conservacion de los documentos.',
      'Articulo 2.2.4.6.15: evaluacion inicial del sistema e identificacion de peligros, evaluacion y valoracion de riesgos.',
    ],
    lastVerified: '2026-09-28',
  },
  {
    name: 'Resolucion 0312 de 2019',
    scope:
      'Estandares Minimos del SG-SST ajustados por numero de trabajadores, actividad economica y ' +
      'clase de riesgo (deroga la Resolucion 1111 de 2017).',
    status: 'vigente',
    sections: [
      'Articulo 4: responsables del diseno e implementacion del SG-SST en empresas con 10 o menos trabajadores.',
      'Anexo (tabla de valores): estandares organizados por capitulo (politica y objetivos; identificacion de peligros y valoracion de riesgos; gestion documental; organizacion y competencia; vigilancia epidemiologica; auditoria interna; rendicion de cuentas) y autoevaluacion.',
    ],
    lastVerified: '2026-09-28',
  },
  {
    name: 'Ley 1562 de 2012',
    scope:
      'Sistema General de Riesgos Laborales y definicion moderna de SST/SG-SST.',
    status: 'vigente',
    sections: [
      'Articulo 3: definicion de accidente de trabajo.',
      'Articulo 4: definicion de enfermedad laboral.',
      'Articulo 10: fortalecimiento de la prevencion de los riesgos laborales.',
    ],
    lastVerified: '2026-09-28',
  },
  {
    name: 'Resolucion 1401 de 2007',
    scope: 'Investigacion de incidentes y accidentes de trabajo.',
    status: 'vigente',
    sections: [
      'Articulo 4: obligaciones de los aportantes, incluida la investigacion y remision del informe a la ARL dentro de los 15 dias siguientes.',
      'Articulo 6: metodologia de la investigacion de incidentes y accidentes.',
    ],
    lastVerified: '2026-09-28',
  },
  {
    name: 'Resolucion 1843 de 2025',
    scope:
      'Evaluaciones medicas ocupacionales, historias clinicas ocupacionales y manejo de datos de ' +
      'salud; deroga la Resolucion 2346 de 2007.',
    status: 'vigente',
    sections: [
      'Articulo 4: acciones obligatorias de la empresa (perfil de cargo, informacion tecnica a la IPS, costos, confidencialidad).',
      'Articulos 8 a 14: evaluaciones preingreso, periodica, cambio de ocupacion, egreso, retorno laboral, postincapacidad y seguimiento.',
      'Articulo 19: contenido del concepto medico; la expresion "no apto" queda limitada a certificados especiales.',
    ],
    lastVerified: '2026-09-28',
  },
  {
    name: 'Resolucion 2346 de 2007',
    scope:
      'Evaluaciones medicas ocupacionales e historia clinica ocupacional (norma anterior).',
    status: 'derogada',
    replacedBy: 'Resolucion 1843 de 2025',
    sections: [
      'Nota: norma derogada por la Resolucion 1843 de 2025; no apoyar respuestas en su contenido.',
    ],
    lastVerified: '2026-09-28',
  },
  {
    name: 'GTC 45',
    scope:
      'Guia tecnica colombiana para identificacion de peligros y valoracion de riesgos.',
    status: 'vigente',
    sections: [
      'Metodologia general: identificar peligros, estimar y valorar riesgos, definir controles y verificar su eficacia.',
    ],
    lastVerified: '2026-09-28',
  },
];

/** Palabras clave por norma para la recuperacion de fuentes (16.5). */
const NORM_KEYWORDS: Record<string, string[]> = {
  'Decreto 1072 de 2015': [
    'decreto 1072',
    '1072',
    'phva',
    'plan anual',
    'obligaciones del empleador',
    'conservacion de documentos',
    'evaluacion inicial',
    'identificacion de peligros',
  ],
  'Resolucion 0312 de 2019': [
    '0312',
    'resolucion 312',
    'estandares minimos',
    'autoevaluacion',
    'tabla de valores',
  ],
  'Ley 1562 de 2012': [
    '1562',
    'sistema general de riesgos laborales',
    'riesgos laborales',
    'accidente de trabajo',
    'accidentes de trabajo',
    'enfermedad laboral',
    'enfermedades laborales',
  ],
  'Resolucion 1401 de 2007': [
    '1401',
    'incidente',
    'accidente',
    'investigacion',
    'investigar',
  ],
  'Resolucion 1843 de 2025': [
    '1843',
    'examen ocupacional',
    'examenes ocupacionales',
    'evaluacion medica ocupacional',
    'evaluaciones medicas ocupacionales',
    'historia clinica',
    'concepto medico',
    'medicina laboral',
    'aptitud',
  ],
  'Resolucion 2346 de 2007': [
    '2346',
    'examen ocupacional',
    'examenes ocupacionales',
    'evaluacion medica ocupacional',
    'evaluaciones medicas ocupacionales',
    'historia clinica',
  ],
  'GTC 45': [
    'gtc',
    'matriz de peligros',
    'valoracion de riesgos',
    'identificacion de peligros',
  ],
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Resuelve las fuentes normativas aplicables a una consulta (tarea 16.5).
 * Coincidencia por palabras clave normalizadas (sin acentos); devuelve solo
 * entradas del indice (con estado de vigencia), nunca normas inventadas.
 */
export function findNormSources(query: string): NormSource[] {
  const normalized = normalize(query);
  if (!normalized.trim()) {
    return [];
  }
  return NORM_SOURCES.filter((source) =>
    (NORM_KEYWORDS[source.name] ?? [source.name]).some((keyword) =>
      normalized.includes(normalize(keyword)),
    ),
  );
}

/**
 * Recupera hasta `limit` temas relevantes para la pregunta del usuario.
 * Coincidencia por palabras clave normalizadas (sin acentos); si nada coincide
 * devuelve los primeros temas como contexto general de capacidades.
 */
export function findHelpTopics(question: string, limit = 4): HelpTopic[] {
  const normalized = normalize(question);
  const scored = HELP_TOPICS.map((topic) => {
    const hits = topic.keywords.filter((keyword) =>
      normalized.includes(normalize(keyword)),
    ).length;
    return { topic, hits };
  })
    .filter((entry) => entry.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  if (scored.length === 0) {
    return HELP_TOPICS.slice(0, limit);
  }
  return scored.slice(0, limit).map((entry) => entry.topic);
}

/**
 * Contexto de ayuda para el prompt de sistema (tarea 16.4): modulos reales del
 * ERP + indice de normas verificadas con secciones y vigencia (16.5). Es de
 * solo lectura y no contiene datos de tenant.
 */
export function buildHelpContext(question: string): string {
  const topics = findHelpTopics(question);
  const topicsText = topics
    .map(
      (topic) =>
        `- ${topic.title} (vista: ${topic.view}): ${topic.what} ` +
        `Fuentes: ${topic.norms.join(', ')}.`,
    )
    .join('\n');
  const normsText = NORM_SOURCES.map((norm) => {
    const vigency =
      norm.status === 'derogada'
        ? ` [DEROGADA por ${norm.replacedBy}; no la cites como vigente]`
        : '';
    const sections = norm.sections
      .map((section) => `    * ${section}`)
      .join('\n');
    return `- ${norm.name}${vigency}: ${norm.scope}\n  Secciones verificadas:\n${sections}`;
  }).join('\n');

  return (
    `Modulos reales del ERP relacionados con la consulta:\n${topicsText}\n\n` +
    `Normas citables (mencionalas como fuente, cita la seccion exacta de la ` +
    `lista y distingue norma de recomendacion; no cites normas que no esten ` +
    `en esta lista ni secciones fuera de las listadas):\n${normsText}\n\n` +
    `Si una fuente aparece marcada como derogada, no la cites como vigente y ` +
    `prefiere su reemplazo.\n\n` +
    `Si la pregunta trata un modulo que no aparece entre los modulos reales, ` +
    `indica que el sistema no cuenta con esa funcionalidad hoy.`
  );
}
