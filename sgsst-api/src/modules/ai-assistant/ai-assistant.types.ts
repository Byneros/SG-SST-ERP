export type AssistantResult = {
  content: string;
  /** Fuentes usadas por la herramienta de normativa, si aplica. */
  sources?: string[];
  /** Modulo consultado mediante herramientas autorizadas, si aplica. */
  usedTool?: string;
  /** Fase K: herramientas ejecutadas por asistentes elegidos por el router. */
  usedTools?: Array<{ assistant: string; tool: string }>;
  /** Fase K: asistentes con match de keywords pero sin permiso para el rol. */
  omittedAssistants?: string[];
};

export const ASSISTANT_CAPABILITIES = [
  'Ayuda sobre el uso de los modulos del ERP (empresas, sedes, empleados, usuarios, documentos, riesgos, incidentes, capacitaciones, inspecciones, EPP).',
  'Consulta de datos de SU empresa mediante herramientas autorizadas del backend (nunca SQL arbitrario).',
  'Orientacion general sobre normatividad SG-SST con fuentes verificables.',
] as const;

/** Roles autorizados para usar el asistente (Sprint 16, fase inicial). */
export const ASSISTANT_ALLOWED_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'SST',
  'AUDITOR',
] as const;
