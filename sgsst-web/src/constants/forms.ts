import type {
  CompanyFormValues,
  DashboardSummary,
  DocumentFormValues,
  EmployeeFormValues,
  IncidentFormValues,
  PageMeta,
  RiskFormValues,
  SgsstAuditFormValues,
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

export const emptyIncident: IncidentFormValues = {
  title: '',
  description: '',
  date: '',
  status: 'PENDING',
  companyId: '',
}

export const emptyRisk: RiskFormValues = {
  title: '',
  description: '',
  level: 'LOW',
  companyId: '',
}

export const emptyTraining: TrainingFormValues = {
  title: '',
  description: '',
  date: '',
  companyId: '',
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
