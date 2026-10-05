export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'SST' | 'EMPLOYEE' | 'AUDITOR' | 'DEVELOPER'
export type IncidentStatus = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED'
export type View = 'dashboard' | 'aiAssistant' | 'companies' | 'committees' | 'emergency' | 'contractors' | 'developer' | 'sites' | 'employees' | 'incidents' | 'risks' | 'trainings' | 'documents' | 'sgsstAudits' | 'sgsstEvaluations' | 'indicators' | 'legalCompliance' | 'annualWorkPlans' | 'plannedInspections' | 'unplannedInspections' | 'unsafeReports' | 'ppe' | 'medical' | 'reports' | 'users' | 'externalDeliveries' | 'audit'
export type CompanyRiskClass = 'CLASS_I' | 'CLASS_II' | 'CLASS_III' | 'CLASS_IV' | 'CLASS_V'
export type DocumentType = 'CC' | 'CE' | 'TI' | 'PASSPORT' | 'NIT'
export type ContractType = 'INDEFINITE' | 'FIXED_TERM' | 'SERVICE' | 'APPRENTICESHIP' | 'TEMPORARY'
export type EmploymentStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'RETIRED'
export type DocumentCategory =
  | 'POLICY'
  | 'PROCEDURE'
  | 'CERTIFICATE'
  | 'TRAINING_EVIDENCE'
  | 'INCIDENT_EVIDENCE'
  | 'AUDIT_EVIDENCE'
  | 'MEDICAL'
  | 'OTHER'
export type DocumentStatus = 'DRAFT' | 'PUBLISHED' | 'EXPIRED' | 'ARCHIVED'
export type AuditStatus = 'PLANNED' | 'IN_PROGRESS' | 'CLOSED' | 'CANCELLED'
export type FindingSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL'
export type FindingStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED'
export type CorrectiveActionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE'
export type LegalNormStatus = 'ACTIVE' | 'INACTIVE' | 'SUPERSEDED'
export type LegalObligationFrequency = 'ONCE' | 'ANNUAL' | 'SEMIANNUAL' | 'QUARTERLY' | 'MONTHLY' | 'EVENT_BASED' | 'CONTINUOUS'
export type LegalRequirementStatus = 'PENDING' | 'COMPLIES' | 'PARTIAL' | 'NON_COMPLIANT' | 'NOT_APPLICABLE'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type AuthUser = {
  id: string
  name: string
  email: string
  role: Role
  companyId?: string
  activeCompanyId?: string
  mfaEnabled?: boolean
}

export type Company = {
  id: string
  name: string
  nit: string
  arl?: string
  riskClass: CompanyRiskClass
  economicActivity?: string
  city?: string
  department?: string
  address?: string
  phone?: string
  email?: string
  reportExportExpirationDays?: number
  reportExportRetentionDays?: number
  reportFailureRateAlertPercent?: number
  reportStorageAlertBytes?: number
  whatsappAlertsEnabled: boolean
  whatsappAlertPhone?: string
  isActive: boolean
  deletedAt?: string
}

export type Site = {
  id: string
  name: string
  code?: string
  address?: string
  city?: string
  department?: string
  isMain: boolean
  companyId: string
  isActive: boolean
  deletedAt?: string
  createdAt: string
  updatedAt: string
  company?: Pick<Company, 'id' | 'name' | 'nit'>
}

export type SiteFormValues = {
  name: string
  code: string
  address: string
  city: string
  department: string
  isMain: boolean
  companyId: string
}

export type Employee = {
  id: string
  firstName: string
  lastName: string
  documentType: DocumentType
  document: string
  position: string
  workCenter?: string
  contractType: ContractType
  employmentStatus: EmploymentStatus
  hireDate?: string
  email?: string
  phone?: string
  companyId: string
  siteId?: string
  isActive: boolean
  deletedAt?: string
  company?: Pick<Company, 'id' | 'name' | 'nit'>
  site?: Pick<Site, 'id' | 'name' | 'code'>
}

export type SystemUser = {
  id: string
  name: string
  email: string
  role: Role
  isActive: boolean
  deletedAt?: string
  companyId?: string
  company?: Pick<Company, 'id' | 'name' | 'nit'>
}

export type SgsstDocumentVersion = {
  id: string
  version: number
  fileUrl: string
  fileName?: string
  mimeType?: string
  notes?: string
  createdAt: string
}

export type SgsstDocument = {
  id: string
  name: string
  description?: string
  category: DocumentCategory
  status: DocumentStatus
  fileUrl: string
  fileName?: string
  mimeType?: string
  version: number
  expiresAt?: string
  companyId: string
  siteId?: string
  company?: Pick<Company, 'id' | 'name' | 'nit'>
  site?: Pick<Site, 'id' | 'name' | 'code'>
  versions?: SgsstDocumentVersion[]
}

export type AuditLog = {
  id: string
  action: string
  entity: string
  entityId?: string
  createdAt: string
  actor?: Pick<SystemUser, 'id' | 'name' | 'email' | 'role'>
}

export type AppNotification = {
  id: string
  title: string
  message: string
  type: 'INFO' | 'DOCUMENT_EXPIRING' | 'TRAINING_OVERDUE' | 'INCIDENT_OPEN' | 'TASK'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  entity?: string
  entityId?: string
  read: boolean
  readAt?: string
  createdAt: string
}

export type ExternalDeliveryProvider = 'WHATSAPP' | 'EMAIL' | 'TEAMS' | 'SLACK'
export type ExternalDeliveryStatus = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED'

export type ExternalDelivery = {
  id: string
  provider: ExternalDeliveryProvider
  status: ExternalDeliveryStatus
  target?: string
  subject?: string
  payload?: unknown
  response?: unknown
  error?: string
  entity?: string
  entityId?: string
  attemptCount: number
  maxAttempts: number
  nextAttemptAt?: string
  attemptedAt: string
  deliveredAt?: string
  createdAt: string
  updatedAt: string
  companyId?: string
  company?: Pick<Company, 'id' | 'name' | 'nit'>
}

export type ReportExportStatus = 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED' | 'EXPIRED'

export type ReportExport = {
  id: string
  kind: string
  format: 'csv' | 'pdf'
  status: ReportExportStatus
  requestedCompanyId?: string
  fileUrl?: string
  fileName?: string
  mimeType?: string
  size?: number
  jobId?: string
  error?: string
  requestedAt: string
  startedAt?: string
  completedAt?: string
  expiresAt?: string
  company?: Pick<Company, 'id' | 'name' | 'nit'>
  requestedBy?: Pick<SystemUser, 'id' | 'name' | 'email' | 'role'>
}

export type ReportExportMetrics = {
  totals: {
    total: number
    queued: number
    processing: number
    ready: number
    failed: number
    expired: number
    storageBytes: number
    averageGenerationSeconds: number
  }
  byCompany: Array<{
    companyId: string | null
    companyName: string
    total: number
    storageBytes: number
  }>
  failuresByKind: Array<{
    kind: string
    failed: number
  }>
}

export type ReportExportMetricSnapshot = {
  id: string
  date: string
  scopeKey: string
  total: number
  queued: number
  processing: number
  ready: number
  failed: number
  expired: number
  storageBytes: number
  averageGenerationSeconds: number
  companyId?: string
  company?: Pick<Company, 'id' | 'name' | 'nit'>
}

export type Incident = {
  id: string
  title: string
  description: string
  date: string
  status: IncidentStatus
  createdAt: string
  companyId: string
  siteId?: string
  company?: Pick<Company, 'id' | 'name' | 'nit'>
  site?: Pick<Site, 'id' | 'name' | 'code'>
}

export type Risk = {
  id: string
  title: string
  description?: string
  level: RiskLevel
  createdAt: string
  companyId: string
  siteId?: string
  /** Cargo asociado (profesiograma, #25.2). */
  position?: string
  company?: Pick<Company, 'id' | 'name' | 'nit'>
  site?: Pick<Site, 'id' | 'name' | 'code'>
}

export type Training = {
  id: string
  title: string
  description?: string
  date: string
  createdAt: string
  companyId: string
  siteId?: string
  company?: Pick<Company, 'id' | 'name' | 'nit'>
  site?: Pick<Site, 'id' | 'name' | 'code'>
}

export type CorrectiveAction = {
  id: string
  title: string
  responsible: string
  dueDate: string
  status: CorrectiveActionStatus
}

export type AuditFinding = {
  id: string
  title: string
  severity: FindingSeverity
  status: FindingStatus
  actions?: CorrectiveAction[]
}

export type SgsstAudit = {
  id: string
  title: string
  description?: string
  status: AuditStatus
  scope?: string
  auditorName?: string
  scheduledAt: string
  closedAt?: string
  result?: string
  companyId: string
  company?: Pick<Company, 'id' | 'name' | 'nit'>
  findings?: AuditFinding[]
}

export type EvaluationStatus = 'IN_PROGRESS' | 'COMPLETED'
export type EvaluationItemStatus = 'PENDING' | 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT' | 'NOT_APPLICABLE'

export type EvaluationItem = {
  id: string
  numeral?: string
  section?: string
  question: string
  maxScore: number
  score?: number | null
  status: EvaluationItemStatus
  notes?: string
  createdAt: string
  updatedAt: string
}

export type SgsstEvaluation = {
  id: string
  name: string
  standard: string
  riskClass: string
  period?: string
  status: EvaluationStatus
  score?: number | null
  maxScore?: number | null
  compliancePercent?: number | null
  notes?: string
  companyId: string
  createdAt: string
  updatedAt: string
  company?: Pick<Company, 'id' | 'name' | 'nit'>
  items?: EvaluationItem[]
}

export type SgsstEvaluationFormValues = {
  name: string
  riskClass: string
  period: string
  notes: string
  companyId: string
}

export type IndicatorDirection = 'LOWER_IS_BETTER' | 'HIGHER_IS_BETTER'

export type IndicatorTarget = {
  id: string
  indicatorId: string
  period: string
  target: number
}

export type IndicatorMeasurement = {
  id: string
  indicatorId: string
  period: string
  value: number
  notes?: string
  measuredAt: string
}

export type Indicator = {
  id: string
  name: string
  code?: string
  description?: string
  unit?: string
  value: number
  formulaDefinition?: string
  direction: IndicatorDirection
  companyId: string
  siteId?: string
  createdAt: string
  updatedAt: string
  company?: Pick<Company, 'id' | 'name' | 'nit'>
  site?: Pick<Site, 'id' | 'name' | 'code'>
  targets?: IndicatorTarget[]
  measurements?: IndicatorMeasurement[]
}

export type IndicatorFormValues = {
  name: string
  code: string
  description: string
  unit: string
  formulaDefinition: string
  direction: IndicatorDirection
  siteId: string
  companyId: string
}

export type IndicatorTargetInput = { period: string; target: number }

export type LegalNorm = {
  id: string
  code: string
  name: string
  type: string
  issuingEntity?: string
  status: LegalNormStatus
}

export type LegalRequirementMapping = {
  id: string
  moduleKey: string
  entityName?: string
  evidenceType?: string
  kpiKey?: string
  reportKey?: string
}

export type LegalEvidenceRequirement = {
  id: string
  evidenceName: string
  evidenceType: string
  mandatory: boolean
  frequency: LegalObligationFrequency
  retentionYears?: number
}

export type LegalRequirement = {
  id: string
  article?: string
  numeral?: string
  title: string
  description: string
  obligationType?: string
  frequency: LegalObligationFrequency
  appliesTo?: string
  riskLevel: RiskLevel
  active: boolean
  norm: LegalNorm
  mappings: LegalRequirementMapping[]
  evidenceRequirements: LegalEvidenceRequirement[]
}

export type LegalEvidenceLink = {
  id: string
  entity: string
  entityId: string
  status: LegalRequirementStatus
  comments?: string
  reviewedAt?: string
}

export type CompanyLegalRequirement = {
  id: string
  applies: boolean
  status: LegalRequirementStatus
  ownerId?: string
  dueDate?: string
  nextReviewAt?: string
  lastReviewedAt?: string
  score?: number
  notes?: string
  companyId: string
  company?: Pick<Company, 'id' | 'name' | 'nit'>
  requirement: LegalRequirement
  evidences: LegalEvidenceLink[]
}

export type LegalComplianceSummary = {
  companyId: string
  total: number
  applicable: number
  byStatus: Partial<Record<LegalRequirementStatus, number>>
  overdue: number
  complianceRate: number
  averageScore: number
}

export type LegalComplianceReports = {
  byNorm: Array<{
    normCode: string
    normName: string
    total: number
    complies: number
    partial: number
    nonCompliant: number
    pending: number
    overdue: number
    missingEvidence: number
    complianceRate: number
  }>
  openGaps: Array<{
    id: string
    normCode: string
    requirementTitle: string
    status: LegalRequirementStatus
    riskLevel: RiskLevel
    dueDate?: string
    modules: string[]
    notes?: string
  }>
  missingEvidence: Array<{
    id: string
    normCode: string
    requirementTitle: string
    riskLevel: RiskLevel
    missingCount: number
    requiredEvidence: string[]
    modules: string[]
    dueDate?: string
  }>
  criticalDeadlines: Array<{
    id: string
    normCode: string
    requirementTitle: string
    status: LegalRequirementStatus
    riskLevel: RiskLevel
    dueDate?: string
    overdue: boolean
  }>
  totals: {
    norms: number
    openGaps: number
    missingEvidence: number
    criticalDeadlines: number
  }
}

export type PageMeta = {
  page: number
  pageSize: number
  total: number
  totalPages: number
  unread?: number
}

export type Paginated<T> = {
  data: T[]
  meta: PageMeta
}

export type TableState = {
  page: number
  pageSize: number
  search: string
  isActive: 'all' | 'active' | 'inactive'
}

export type ReportExportFilters = {
  status: 'all' | ReportExportStatus
  companyId: string
  requestedById: string
  dateFrom: string
  dateTo: string
}

export type ExternalDeliveryFilters = {
  provider: 'all' | ExternalDeliveryProvider
  status: 'all' | ExternalDeliveryStatus
  companyId: string
}

// --- Contratistas (S11) ------------------------------------------------------

export type ContractorStatus = 'ACTIVE' | 'SUSPENDED' | 'BLOCKED'
export type ContractorWorkerStatus = 'ACTIVE' | 'INACTIVE'
export type ContractorDocumentStatus = 'PENDING' | 'VALID' | 'EXPIRED' | 'REJECTED'
/** S13.4: etapas del flujo de ingreso del contratista. */
export type ContractorEntryStatus = 'VALIDATION' | 'INDUCTION' | 'AUTHORIZED' | 'WORK' | 'CLOSED'

export type Contractor = {
  id: string
  name: string
  nit: string
  contact?: string
  phone?: string
  arl?: string
  activity?: string
  status: ContractorStatus
  entryStatus: ContractorEntryStatus
  companyId: string
  company?: Pick<Company, 'id' | 'name'>
  createdAt: string
  updatedAt: string
  _count?: { workers: number; documents: number }
}

export type ContractorWorker = {
  id: string
  document: string
  firstName: string
  lastName: string
  job?: string
  /** S13.2: sede donde ejecuta su actividad. */
  siteId?: string | null
  site?: Pick<Site, 'id' | 'name' | 'code'> | null
  inductedAt?: string | null
  status: ContractorWorkerStatus
  contractorId: string
  companyId: string
  contractor?: Pick<Contractor, 'id' | 'name' | 'nit' | 'status'>
}

export type ContractorDocument = {
  id: string
  documentType: string
  description?: string
  expiresAt?: string | null
  status: ContractorDocumentStatus
  contractorId: string
  evidenceId?: string | null
  companyId: string
  evidence?: Pick<SgsstDocument, 'id' | 'name'> & { status?: string; expiresAt?: string | null } | null
}

/** Respuesta de GET /contractors/:id/entry-authorization. */
export type ContractorEntryAuthorization = {
  contractor: (Pick<Contractor, 'id' | 'name'> & { status: string; entryStatus?: ContractorEntryStatus }) | null
  documentsTotal: number
  byDocumentStatus: Record<string, number>
  workersTotal: number
  workersActive: number
  canAuthorizeEntry: boolean
  blockingReasons: string[]
  expiredByDate: Array<Pick<ContractorDocument, 'id' | 'documentType' | 'expiresAt'>>
  workersWithoutInduction: number
  /** S13.4: etapa persistida del flujo y etapa siguiente (null si cerrado). */
  entryStatus: ContractorEntryStatus
  nextStage: ContractorEntryStatus | null
  documentsValidated: boolean
  workersInducted: boolean
}

export type ContractorFormValues = {
  name: string
  nit: string
  contact: string
  phone: string
  arl: string
  activity: string
  status: ContractorStatus
  companyId: string
}

export type ContractorWorkerFormValues = {
  document: string
  firstName: string
  lastName: string
  job: string
  siteId: string
  inductedAt: string
  status: ContractorWorkerStatus
  companyId: string
}

export type ContractorDocumentFormValues = {
  documentType: string
  description: string
  expiresAt: string
  status: ContractorDocumentStatus
  evidenceId: string
  companyId: string
}

// --- Panel de desarrollador (rol DEVELOPER) ----------------------------------

export type DeveloperDependency = 'ok' | 'error'

export type DeveloperOverview = {
  status: 'ok'
  service: string
  environment: string
  timestamp: string
  dependencies: {
    database: DeveloperDependency
    redis: DeveloperDependency
  }
  queues: {
    notifications: boolean
    reports: boolean
  }
}

export type DeveloperModuleInfo = {
  name: string
  enabled: boolean
  detail?: string
}

export type DeveloperModules = {
  modules: DeveloperModuleInfo[]
  platform: {
    environment: string
    companies: number
    users: number
    auditLogs: number
  }
}

export type DeveloperQueues = {
  notifications: {
    enabled: boolean
    worker: boolean
    cron: string
  }
  reports: {
    enabled: boolean
    worker: boolean
    cleanupCron: string
    metricsCron: string
  }
  redis: string
}

export type DeveloperAuditEntry = {
  id: string
  action: string
  entity: string
  entityId?: string | null
  createdAt: string
  actor?: { id: string; name: string; email: string; role: string } | null
}

export type DeveloperDiagnostics = {
  companies: { total: number; active: number }
  users: { total: number; active: number; developers: number }
  auditLogs: number
  database: 'reachable'
}

export type DeveloperErrorEvent = {
  timestamp: string
  level: 'error' | 'warn'
  context: string
  message: string
  trace?: string
  requestId?: string
}

export type DeveloperErrors = {
  data: DeveloperErrorEvent[]
  total: number
}

export type DeveloperPanelData = {
  overview: DeveloperOverview | null
  modules: DeveloperModules | null
  queues: DeveloperQueues | null
  audit: DeveloperAuditEntry[]
  diagnostics: DeveloperDiagnostics | null
  errors: DeveloperErrors | null
}

export type LegalComplianceFilters = {
  companyId: string
  status: 'all' | LegalRequirementStatus
  applies: 'all' | 'yes' | 'no'
}

export type ComplianceSummary = {
  pendingAudits: number
  openFindings: number
  overdueCorrectiveActions: number
  evaluationsCount: number
  evaluationsAvgCompliance: number | null
  indicatorsCount: number
  indicatorsOffTarget: number
}

export type DashboardSummary = {
  companiesCount: number
  employeesCount: number
  usersCount: number
  documentsCount: number
  criticalRisks: number
  openIncidents: number
  overdueTrainings: number
  upcomingTrainings: number
  inactiveCompanies: number
  inactiveEmployees: number
  inactiveUsers: number
  activeRate: number
  siteKpis?: SiteKpi[]
  compliance?: ComplianceSummary
}

export type CompanyFormValues = {
  name: string
  nit: string
  arl: string
  riskClass: CompanyRiskClass
  economicActivity: string
  city: string
  department: string
  address: string
  phone: string
  email: string
  reportExportExpirationDays: string
  reportExportRetentionDays: string
  reportFailureRateAlertPercent: string
  reportStorageAlertBytes: string
  whatsappAlertsEnabled: boolean
  whatsappAlertPhone: string
}

export type EmployeeFormValues = {
  firstName: string
  lastName: string
  documentType: DocumentType
  document: string
  position: string
  workCenter: string
  contractType: ContractType
  employmentStatus: EmploymentStatus
  hireDate: string
  email: string
  phone: string
  companyId: string
  siteId: string
}

export type UserFormValues = {
  name: string
  email: string
  password: string
  role: Role
  companyId: string
}

export type DocumentFormValues = {
  name: string
  description: string
  category: DocumentCategory
  status: DocumentStatus
  fileUrl: string
  fileName: string
  mimeType: string
  expiresAt: string
  companyId: string
  siteId: string
}

export type SgsstAuditFormValues = {
  title: string
  description: string
  status: AuditStatus
  scope: string
  auditorName: string
  scheduledAt: string
  result: string
  companyId: string
}

export type SiteKpi = {
  siteId: string
  name: string
  code?: string
  isMain: boolean
  employees: number
  criticalRisks: number
  openIncidents: number
  trainings: number
  documents: number
  inspections: number
  openFindings: number
}

export type UnplannedInspection = {
  id: string
  title: string
  reason: string
  area?: string
  status: InspectionStatus
  executedAt?: string
  result?: string
  createdAt: string
  updatedAt: string
  companyId: string
  siteId?: string
  inspectorId?: string
  inspector?: Pick<SystemUser, 'id' | 'name' | 'email'>
  company?: Pick<Company, 'id' | 'name' | 'nit'>
  site?: Pick<Site, 'id' | 'name' | 'code'>
  findings: InspectionFinding[]
}

export type UnplannedInspectionFormValues = {
  title: string
  reason: string
  area: string
  status: InspectionStatus
  siteId: string
  inspectorId: string
  companyId: string
}

export type UnsafeReportKind = 'UNSAFE_ACT' | 'UNSAFE_CONDITION'
export type UnsafeReportStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED'

export type UnsafeReport = {
  id: string
  kind: UnsafeReportKind
  description: string
  severity: InspectionFindingSeverity
  status: UnsafeReportStatus
  area?: string
  isAnonymous: boolean
  reporterName?: string
  closedAt?: string
  createdAt: string
  updatedAt: string
  companyId: string
  siteId?: string
  reporterId?: string
  reporter?: Pick<SystemUser, 'id' | 'name' | 'email'>
  company?: Pick<Company, 'id' | 'name' | 'nit'>
  site?: Pick<Site, 'id' | 'name' | 'code'>
  findings: InspectionFinding[]
}

export type UnsafeReportFormValues = {
  kind: UnsafeReportKind
  description: string
  severity: InspectionFindingSeverity
  area: string
  isAnonymous: boolean
  reporterName: string
  siteId: string
  companyId: string
}

export type PpeItem = {
  id: string
  name: string
  type?: string
  standard?: string
  size?: string
  usefulLifeDays?: number
  stockMin: number
  stock: number
  isActive: boolean
  companyId: string
}

// ---- Medicina laboral (S10) ----

export type MedicalExamType = 'INGRESO' | 'PERIODICO' | 'RETIRO' | 'POSTINCAPACIDAD' | 'CAMBIO_CARGO'
export type MedicalConcept = 'PENDIENTE' | 'APTO' | 'APTO_RESTRICCION' | 'NO_APTO'

export type MedicalProfile = {
  id: string
  position: string
  description?: string
  isActive: boolean
  companyId: string
  company?: Pick<Company, 'id' | 'name'>
  /** Riesgo del cargo en la matriz GTC-45 (#25.2). */
  riskId?: string
  risk?: { id: string; title: string; level: string }
  requirements: Array<{
    id: string
    examType: MedicalExamType
    periodicityMonths: number
    notes?: string
    derivedFromRiskId?: string
  }>
}

export type MedicalSurveillanceCohort = {
  id: string
  programId: string
  riskId?: string
  risk?: { id: string; title: string; level: string; position?: string }
  status: string
  derivedAt?: string
  lastReviewedAt?: string
  workersCount?: number
}

export type MedicalSurveillanceProgram = {
  id: string
  name: string
  riskType: string
  objective?: string
  status: string
  ownerId?: string
  owner?: { id: string; name: string; email: string } | null
  companyId: string
  cohorts: Array<MedicalSurveillanceCohort & { _count?: { workers: number } }>
}

/** Catalogo CIE-10 por empresa (#44). */
export type PveDiagnosis = {
  id: string
  code: string
  name: string
  category?: string
  active: boolean
  companyId: string
  _count?: { cases: number }
}

export type PveCaseStatus = 'SUSPECTED' | 'CONFIRMED' | 'CLOSED'

export type PveCase = {
  id: string
  status: PveCaseStatus
  reportedAt: string
  nextFollowUpAt?: string
  closedAt?: string
  absenceDays: number
  notes?: string
  employee?: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'document' | 'position'>
  program?: { id: string; name: string; riskType: string }
  cohort?: { id: string; status: string; lastReviewedAt?: string } | null
  diagnosis?: { id: string; code: string; name: string; category?: string }
  companyId: string
}

export type PveCaseFormValues = {
  employeeId: string
  programId: string
  cohortId: string
  diagnosisId: string
  status: string
  reportedAt: string
  nextFollowUpAt: string
  absenceDays: number
  notes: string
  companyId: string
}

export type PveDiagnosisFormValues = {
  code: string
  name: string
  category: string
  companyId: string
}

export type MedicalExam = {
  id: string
  examType: MedicalExamType
  concept: MedicalConcept
  scheduledAt?: string
  performedAt?: string
  nextDueAt?: string
  provider?: string
  employeeId?: string
  employee?: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'document' | 'position'>
  profileId?: string
  profile?: Pick<MedicalProfile, 'id' | 'position'>
}

export type MedicalRestriction = {
  id: string
  description: string
  startDate?: string
  endDate?: string
  liftedAt?: string
  liftedBy?: string
  status: 'ACTIVE' | 'LIFTED'
  employeeId: string
  employee?: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'document' | 'position'>
}

export type PpeDelivery = {
  id: string
  quantity: number
  deliveredAt: string
  dueReplacementAt?: string
  signature?: string
  notes?: string
  itemId: string
  item?: Pick<PpeItem, 'id' | 'name' | 'type' | 'standard' | 'size'>
  employeeId: string
  employee?: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'document' | 'position'>
  itemStock?: number
  stockBelowMin?: boolean
}

export type PpeItemFormValues = {
  name: string
  type: string
  standard: string
  size: string
  usefulLifeDays: string
  stockMin: string
  stock: string
  companyId: string
}

export type PpeDeliveryFormValues = {
  itemId: string
  employeeId: string
  quantity: string
  signature: string
  notes: string
  companyId: string
}

export type IncidentFormValues = {
  title: string
  description: string
  date: string
  status: IncidentStatus
  companyId: string
  siteId: string
}

export type RiskFormValues = {
  title: string
  description: string
  level: RiskLevel
  companyId: string
  siteId: string
}

export type TrainingFormValues = {
  title: string
  description: string
  date: string
  companyId: string
  siteId: string
}

export type AnnualWorkPlanStatus = 'DRAFT' | 'APPROVED' | 'IN_PROGRESS' | 'CLOSED'
export type AnnualActivityStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
export type AnnualActivityCycle = 'PLANEAR' | 'HACER' | 'VERIFICAR' | 'ACTUAR' | 'ACT'

export type AnnualPlanActivity = {
  id: string
  cycle: AnnualActivityCycle
  name: string
  frequency?: string
  dueDate?: string
  progress: number
  status: AnnualActivityStatus
  budget?: number
  planId: string
  companyId: string
  ownerId?: string
  owner?: Pick<SystemUser, 'id' | 'name' | 'email'>
  evidenceId?: string
  evidence?: Pick<SgsstDocument, 'id' | 'name' | 'fileName' | 'mimeType' | 'status'>
}

export type AnnualWorkPlan = {
  id: string
  year: number
  status: AnnualWorkPlanStatus
  notes?: string
  approvedById?: string
  approvedBy?: Pick<SystemUser, 'id' | 'name' | 'email'>
  approvedAt?: string
  createdAt: string
  updatedAt: string
  companyId: string
  company?: Pick<Company, 'id' | 'name' | 'nit'>
  activities?: AnnualPlanActivity[]
  planProgress?: number
}

export type MedicalProfileFormValues = {
  position: string
  description: string
  examType: string
  companyId: string
  riskId?: string
}

export type MedicalSurveillanceProgramFormValues = {
  name: string
  riskType: string
  objective: string
  companyId: string
}

export type MedicalExamFormValues = {
  examType: string
  employeeId: string
  scheduledAt: string
  performedAt: string
  nextDueAt: string
  concept: string
  provider: string
}

export type MedicalRestrictionFormValues = {
  description: string
  employeeId: string
  startDate: string
  endDate: string
}

export type AnnualWorkPlanFormValues = {
  year: string
  status: AnnualWorkPlanStatus
  notes: string
  companyId: string
}

export type AnnualActivityFormValues = {
  cycle: AnnualActivityCycle
  name: string
  frequency: string
  dueDate: string
  progress: string
  status: AnnualActivityStatus
  budget: string
  ownerId: string
  evidenceId: string
}

export type InspectionStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type InspectionFindingSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL'

export type InspectionItem = {
  id: string
  order: number
  section?: string
  question: string
  answer?: string
  notes?: string
}

export type InspectionFindingAction = {
  id: string
  title: string
  responsible: string
  dueDate: string
  status: CorrectiveActionStatus
}

export type InspectionFindingRisk = Pick<Risk, 'id' | 'title' | 'level'>

export type InspectionFinding = {
  id: string
  description: string
  severity: InspectionFindingSeverity
  status: FindingStatus
  actionId?: string
  action?: InspectionFindingAction
  riskId?: string
  risk?: InspectionFindingRisk
}

export type PlannedInspection = {
  id: string
  title: string
  type: string
  frequency?: string
  scheduledAt: string
  executedAt?: string
  result?: string
  status: InspectionStatus
  createdAt: string
  updatedAt: string
  companyId: string
  siteId?: string
  inspectorId?: string
  inspector?: Pick<SystemUser, 'id' | 'name' | 'email'>
  company?: Pick<Company, 'id' | 'name' | 'nit'>
  site?: Pick<Site, 'id' | 'name' | 'code'>
  items: InspectionItem[]
  findings: InspectionFinding[]
}

export type PlannedInspectionFormValues = {
  title: string
  type: string
  frequency: string
  scheduledAt: string
  status: InspectionStatus
  siteId: string
  inspectorId: string
  companyId: string
}

// --- Comites (S11): COPASST y Comite de Convivencia ---------------------------

export type CommitteeType = 'COPASST' | 'CONVIVENCIA'
export type CommitteeStatus = 'ACTIVE' | 'CLOSED'
export type CommitteeMemberRole = 'PRESIDENT' | 'SECRETARY' | 'PRINCIPAL' | 'SUPERNUMERARY'
export type CommitteeSeatType = 'PRINCIPAL' | 'ALTERNATE'
export type CommitteeMeetingStatus = 'SCHEDULED' | 'HELD' | 'CANCELLED'

export type CommitteeMember = {
  id: string
  role: CommitteeMemberRole
  seatType: CommitteeSeatType
  startDate: string
  endDate?: string | null
  committeeId: string
  employeeId: string
  companyId: string
  employee?: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'document' | 'position'>
}

export type CommitteeCommitment = {
  id: string
  description: string
  responsibleEmployeeId: string
  dueDate: string
  completedAt?: string | null
  meetingId: string
  companyId: string
  responsible?: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'position'>
}

export type CommitteeMeeting = {
  id: string
  number: number
  meetingAt: string
  agenda?: string
  notes?: string
  status: CommitteeMeetingStatus
  committeeId: string
  minutesDocumentId?: string | null
  minutesDocument?: Pick<SgsstDocument, 'id' | 'name'> & { status?: string; expiresAt?: string | null } | null
  commitments: CommitteeCommitment[]
  companyId: string
}

export type Committee = {
  id: string
  name: string
  type: CommitteeType
  periodStart: string
  periodEnd: string
  status: CommitteeStatus
  companyId: string
  createdAt: string
  updatedAt: string
  members?: CommitteeMember[]
  meetings?: CommitteeMeeting[]
  _count?: { members: number; meetings: number }
}

export type CommitteeFollowUp = {
  committee: { id: string; name: string; status: CommitteeStatus }
  overdueCount: number
  overdue: Array<{
    id: string
    description: string
    dueDate: string
    meetingId: string
    responsible?: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'position'>
  }>
}

export type CommitteeFormValues = {
  name: string
  type: CommitteeType
  periodStart: string
  periodEnd: string
  status: CommitteeStatus
  companyId: string
}

export type CommitteeMemberFormValues = {
  role: CommitteeMemberRole
  seatType: CommitteeSeatType
  startDate: string
  endDate: string
  employeeId: string
  companyId: string
}

export type CommitteeMeetingFormValues = {
  number: number | ''
  meetingAt: string
  agenda: string
  notes: string
  status: CommitteeMeetingStatus
  minutesDocumentId: string
  companyId: string
}

export type CommitteeCommitmentFormValues = {
  description: string
  responsibleEmployeeId: string
  dueDate: string
  companyId: string
}

// --- Emergencias (S12): brigadas, planes por sede y simulacros -----------------

export type EmergencyBrigadeRole =
  | 'JEFE_BRIGADA'
  | 'PREVENCION_INCENDIOS'
  | 'PRIMEROS_AUXILIOS'
  | 'EVACUACION_RESCATE'
  | 'BRIGADISTA'
export type EmergencyThreatRisk = 'LOW' | 'MEDIUM' | 'HIGH'
export type EmergencyResourceStatus = 'OPERATIVE' | 'MAINTENANCE' | 'EXPIRED'
export type EmergencyDrillStatus = 'PLANNED' | 'EXECUTED' | 'CLOSED' | 'CANCELLED'
export type EmergencyFindingSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL'

export type EmergencyBrigadeMember = {
  id: string
  role: EmergencyBrigadeRole
  formationCompletedAt?: string | null
  validUntil?: string | null
  brigadeId: string
  employeeId: string
  companyId: string
  employee?: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'document' | 'position'>
  brigade?: { id: string; name: string; siteId: string }
}

export type EmergencyBrigade = {
  id: string
  name: string
  siteId: string
  companyId: string
  createdAt: string
  updatedAt: string
  site?: Pick<Site, 'id' | 'name' | 'code'>
  members?: EmergencyBrigadeMember[]
  _count?: { members: number }
}

export type EmergencyThreat = {
  id: string
  type: string
  description?: string
  riskLevel: EmergencyThreatRisk
  planId: string
  companyId: string
}

export type EmergencyResource = {
  id: string
  resourceType: string
  location?: string
  quantity: number
  status: EmergencyResourceStatus
  lastInspectedAt?: string | null
  expiresAt?: string | null
  planId: string
  companyId: string
}

export type EmergencyPlan = {
  id: string
  name: string
  siteId: string
  responsibleEmployeeId?: string | null
  meetingPoint?: string
  routesDescription?: string
  procedures?: string
  vulnerabilityNotes?: string
  companyId: string
  createdAt: string
  updatedAt: string
  site?: Pick<Site, 'id' | 'name' | 'code'>
  responsible?: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'position'> | null
  threats?: EmergencyThreat[]
  resources?: EmergencyResource[]
  _count?: { threats: number; resources: number; drills: number }
}

export type EmergencyDrillFinding = {
  id: string
  description: string
  severity: EmergencyFindingSeverity
  actionDescription?: string
  actionResponsible?: string
  actionDueDate?: string | null
  closedAt?: string | null
  drillId: string
  companyId: string
}

export type EmergencyDrill = {
  id: string
  name: string
  scenario?: string
  planId: string
  plannedAt: string
  executedAt?: string | null
  durationMinutes?: number | null
  participants?: number | null
  resultNotes?: string
  status: EmergencyDrillStatus
  companyId: string
  createdAt: string
  updatedAt: string
  plan?: { id: string; name: string; site: { id: string; name: string } | null }
  findings?: EmergencyDrillFinding[]
  _count?: { findings: number }
}

export type EmergencyBrigadeFormValues = {
  name: string
  siteId: string
  companyId: string
}

export type EmergencyBrigadeMemberFormValues = {
  role: EmergencyBrigadeRole
  formationCompletedAt: string
  validUntil: string
  employeeId: string
  companyId: string
}

export type EmergencyPlanFormValues = {
  name: string
  siteId: string
  responsibleEmployeeId: string
  meetingPoint: string
  routesDescription: string
  procedures: string
  vulnerabilityNotes: string
  companyId: string
}

export type EmergencyThreatFormValues = {
  type: string
  description: string
  riskLevel: EmergencyThreatRisk
  companyId: string
}

export type EmergencyResourceFormValues = {
  resourceType: string
  location: string
  quantity: number | ''
  status: EmergencyResourceStatus
  lastInspectedAt: string
  expiresAt: string
  companyId: string
}

export type EmergencyDrillFormValues = {
  name: string
  scenario: string
  planId: string
  plannedAt: string
  companyId: string
}

export type EmergencyDrillFindingFormValues = {
  description: string
  severity: EmergencyFindingSeverity
  actionDescription: string
  actionResponsible: string
  actionDueDate: string
  companyId: string
}
