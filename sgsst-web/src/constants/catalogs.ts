import type {
  CompanyRiskClass,
  ContractType,
  DocumentCategory,
  DocumentStatus,
  DocumentType,
  EmploymentStatus,
} from '../types'

export const riskClassOptions: CompanyRiskClass[] = [
  'CLASS_I',
  'CLASS_II',
  'CLASS_III',
  'CLASS_IV',
  'CLASS_V',
]

export const riskClassLabels: Record<CompanyRiskClass, string> = {
  CLASS_I: 'I - Riesgo minimo',
  CLASS_II: 'II - Riesgo bajo',
  CLASS_III: 'III - Riesgo medio',
  CLASS_IV: 'IV - Riesgo alto',
  CLASS_V: 'V - Riesgo maximo',
}

export const documentTypeOptions: DocumentType[] = ['CC', 'CE', 'TI', 'PASSPORT', 'NIT']

export const documentTypeLabels: Record<DocumentType, string> = {
  CC: 'Cedula de ciudadania',
  CE: 'Cedula de extranjeria',
  TI: 'Tarjeta de identidad',
  PASSPORT: 'Pasaporte',
  NIT: 'NIT',
}

export const contractTypeOptions: ContractType[] = [
  'INDEFINITE',
  'FIXED_TERM',
  'SERVICE',
  'APPRENTICESHIP',
  'TEMPORARY',
]

export const contractTypeLabels: Record<ContractType, string> = {
  INDEFINITE: 'Indefinido',
  FIXED_TERM: 'Termino fijo',
  SERVICE: 'Prestacion de servicios',
  APPRENTICESHIP: 'Aprendizaje',
  TEMPORARY: 'Temporal',
}

export const employmentStatusOptions: EmploymentStatus[] = ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'RETIRED']

export const employmentStatusLabels: Record<EmploymentStatus, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  ON_LEAVE: 'Licencia',
  RETIRED: 'Retirado',
}

export const documentCategoryOptions: DocumentCategory[] = [
  'POLICY',
  'PROCEDURE',
  'CERTIFICATE',
  'TRAINING_EVIDENCE',
  'INCIDENT_EVIDENCE',
  'AUDIT_EVIDENCE',
  'MEDICAL',
  'OTHER',
]

export const documentCategoryLabels: Record<DocumentCategory, string> = {
  POLICY: 'Politica',
  PROCEDURE: 'Procedimiento',
  CERTIFICATE: 'Certificado',
  TRAINING_EVIDENCE: 'Evidencia de capacitacion',
  INCIDENT_EVIDENCE: 'Evidencia de incidente',
  AUDIT_EVIDENCE: 'Evidencia de auditoria',
  MEDICAL: 'Medico ocupacional',
  OTHER: 'Otro',
}

export const documentStatusOptions: DocumentStatus[] = ['DRAFT', 'PUBLISHED', 'EXPIRED', 'ARCHIVED']

export const documentStatusLabels: Record<DocumentStatus, string> = {
  DRAFT: 'Borrador',
  PUBLISHED: 'Publicado',
  EXPIRED: 'Vencido',
  ARCHIVED: 'Archivado',
}
