import type {
  AnnualActivityFormValues,
  AnnualWorkPlanFormValues,
  CompanyFormValues,
  DashboardSummary,
  PlannedInspectionFormValues,
  PpeDeliveryFormValues,
  PpeItemFormValues,
  MedicalProfileFormValues,
  MedicalExamFormValues,
  MedicalRestrictionFormValues,
  UnplannedInspectionFormValues,
  UnsafeReportFormValues,
  DocumentFormValues,
  EmployeeFormValues,
  IncidentFormValues,
  IndicatorFormValues,
  PageMeta,
  RiskFormValues,
  SgsstAuditFormValues,
  SgsstEvaluationFormValues,
  SiteFormValues,
  TableState,
  TrainingFormValues,
  UserFormValues,
  ReportExportMetrics,
} from '../types'

export const emptyCompany: CompanyFormValues = {
  name: '',
  nit: '',
  arl: '',
  riskClass: 'CLASS_I',
  economicActivity: '',
  city: '',
  department: '',
  address: '',
  phone: '',
  email: '',
  reportExportExpirationDays: '',
  reportExportRetentionDays: '',
  reportFailureRateAlertPercent: '',
  reportStorageAlertBytes: '',
  whatsappAlertsEnabled: false,
  whatsappAlertPhone: '',
}

export const emptyEmployee: EmployeeFormValues = {
  firstName: '',
  lastName: '',
  documentType: 'CC',
  document: '',
  position: '',
  workCenter: '',
  contractType: 'INDEFINITE',
  employmentStatus: 'ACTIVE',
  hireDate: '',
  email: '',
  phone: '',
  companyId: '',
  siteId: '',
}

export const emptySite: SiteFormValues = {
  name: '',
  code: '',
  address: '',
  city: '',
  department: '',
  isMain: false,
  companyId: '',
}

export const emptyUser: UserFormValues = {
  name: '',
  email: '',
  password: '',
  role: 'EMPLOYEE',
  companyId: '',
}

export const emptyDocument: DocumentFormValues = {
  name: '',
  description: '',
  category: 'OTHER',
  status: 'DRAFT',
  fileUrl: '',
  fileName: '',
  mimeType: '',
  expiresAt: '',
  companyId: '',
  siteId: '',
}

export const emptySgsstAudit: SgsstAuditFormValues = {
  title: '',
  description: '',
  status: 'PLANNED',
  scope: '',
  auditorName: '',
  scheduledAt: '',
  result: '',
  companyId: '',
}

export const emptySgsstEvaluation: SgsstEvaluationFormValues = {
  name: '',
  riskClass: 'I',
  period: '',
  notes: '',
  companyId: '',
}

export const emptyIndicator: IndicatorFormValues = {
  name: '',
  code: '',
  description: '',
  unit: '',
  formulaDefinition: '',
  direction: 'LOWER_IS_BETTER',
  siteId: '',
  companyId: '',
}

export const emptyIncident: IncidentFormValues = {
  title: '',
  description: '',
  date: '',
  status: 'PENDING',
  companyId: '',
  siteId: '',
}

export const emptyRisk: RiskFormValues = {
  title: '',
  description: '',
  level: 'LOW',
  companyId: '',
  siteId: '',
}

export const emptyTraining: TrainingFormValues = {
  title: '',
  description: '',
  date: '',
  companyId: '',
  siteId: '',
}

export const emptyAnnualWorkPlan: AnnualWorkPlanFormValues = {
  year: String(new Date().getFullYear()),
  status: 'DRAFT',
  notes: '',
  companyId: '',
}

export const emptyAnnualActivity: AnnualActivityFormValues = {
  cycle: 'ACT',
  name: '',
  frequency: '',
  dueDate: '',
  progress: '0',
  status: 'PENDING',
  budget: '',
  ownerId: '',
  evidenceId: '',
}

export const emptyPlannedInspection: PlannedInspectionFormValues = {
  title: '',
  type: 'LOCATIVE',
  frequency: '',
  scheduledAt: '',
  status: 'PLANNED',
  siteId: '',
  inspectorId: '',
  companyId: '',
}

export const emptyUnplannedInspection: UnplannedInspectionFormValues = {
  title: '',
  reason: '',
  area: '',
  status: 'PLANNED',
  siteId: '',
  inspectorId: '',
  companyId: '',
}

export const emptyUnsafeReport: UnsafeReportFormValues = {
  kind: 'UNSAFE_CONDITION',
  description: '',
  severity: 'MINOR',
  area: '',
  isAnonymous: false,
  reporterName: '',
  siteId: '',
  companyId: '',
}

export const emptyPpeItem: PpeItemFormValues = {
  name: '',
  type: '',
  standard: '',
  size: '',
  usefulLifeDays: '',
  stockMin: '0',
  stock: '0',
  companyId: '',
}

export const emptyPpeDelivery: PpeDeliveryFormValues = {
  itemId: '',
  employeeId: '',
  quantity: '1',
  signature: '',
  notes: '',
  companyId: '',
}

export const emptyMedicalProfile: MedicalProfileFormValues = {
  position: '',
  description: '',
  examType: 'INGRESO',
  companyId: '',
}

export const emptyMedicalExam: MedicalExamFormValues = {
  examType: 'PERIODICO',
  employeeId: '',
  scheduledAt: '',
  performedAt: '',
  nextDueAt: '',
  concept: 'PENDIENTE',
  provider: '',
}

export const emptyMedicalRestriction: MedicalRestrictionFormValues = {
  description: '',
  employeeId: '',
  startDate: '',
  endDate: '',
}

export const initialTableState: TableState = {
  page: 1,
  pageSize: 10,
  search: '',
  isActive: 'all',
}

export const emptyMeta: PageMeta = {
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,
}

export const emptySummary: DashboardSummary = {
  companiesCount: 0,
  employeesCount: 0,
  usersCount: 0,
  documentsCount: 0,
  criticalRisks: 0,
  openIncidents: 0,
  overdueTrainings: 0,
  upcomingTrainings: 0,
  inactiveCompanies: 0,
  inactiveEmployees: 0,
  inactiveUsers: 0,
  activeRate: 0,
  siteKpis: [],
}

export const emptyReportMetrics: ReportExportMetrics = {
  totals: {
    total: 0,
    queued: 0,
    processing: 0,
    ready: 0,
    failed: 0,
    expired: 0,
    storageBytes: 0,
    averageGenerationSeconds: 0,
  },
  byCompany: [],
  failuresByKind: [],
}
