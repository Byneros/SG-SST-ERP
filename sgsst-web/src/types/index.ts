export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'SST' | 'EMPLOYEE' | 'AUDITOR'
export type IncidentStatus = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED'
export type View = 'dashboard' | 'companies' | 'sites' | 'employees' | 'incidents' | 'risks' | 'trainings' | 'documents' | 'sgsstAudits' | 'sgsstEvaluations' | 'indicators' | 'legalCompliance' | 'reports' | 'users' | 'externalDeliveries' | 'audit'
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
  isActive: boolean
  deletedAt?: string
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
