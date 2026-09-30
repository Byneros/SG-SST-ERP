import {
  Business,
  Description,
  ManageAccounts,
  People,
  ReportProblem,
  School,
  Security,
  SpaceDashboard,
  WarningAmber,
} from '@mui/icons-material'
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, CssBaseline, Stack, ThemeProvider, Typography } from '@mui/material'
import { Suspense, useEffect, useMemo, useState } from 'react'
import {
  api,
  clearSession,
  downloadDocument,
  downloadReport,
  downloadReportExport,
  getStoredSession,
  readApiError,
  scheduleReport,
  saveSession,
  setUnauthorizedHandler,
  type ReportFormat,
  type ReportKind,
} from './api/client'
import { ChangePasswordDialog, type ChangePasswordValues } from './auth/ChangePasswordDialog'
import { LoginPage } from './auth/LoginPage'
import { MfaSettingsDialog } from './auth/MfaSettingsDialog'
import { SsoConfigDialog, emptySsoConfig } from './auth/SsoConfigDialog'
import type { SsoConfigValues } from './auth/ssoConfig'
import {
  emptyAnnualWorkPlan,
  emptyCompany,
  emptyContractor,
  emptyContractorDocument,
  emptyContractorWorker,
  emptyDocument,
  emptyPlannedInspection,
  emptyPpeDelivery,
  emptyPpeItem,
  emptyMedicalProfile,
  emptyMedicalExam,
  emptyMedicalRestriction,
  emptyMedicalSurveillanceProgram,
  emptyUnsafeReport,
  emptyUnplannedInspection,
  emptyEmployee,
  emptyIncident,
  emptyIndicator,
  emptyMeta,
  emptyReportMetrics,
  emptyRisk,
  emptySgsstAudit,
  emptySgsstEvaluation,
  emptySite,
  emptySummary,
  emptyTraining,
  emptyUser,
  initialTableState,
} from './constants/forms'
import { AppLayout } from './layout/AppLayout'
import {
  AssistantChatPage,
  AuditPage,
  DeveloperPanelPage,
  ContractorsPage,
  ContractorDialog,
  ContractorWorkerDialog,
  ContractorDocumentDialog,
  ContractorDetailDialog,
  AnnualWorkPlanDialog,
  AnnualWorkPlansPage,
  PlannedInspectionDialog,
  PlannedInspectionsPage,
  UnplannedInspectionDialog,
  UnplannedInspectionsPage,
  UnsafeReportDialog,
  UnsafeReportsPage,
  PpeDeliveryDialog,
  PpeItemDialog,
  PpePage,
  MedicalProfileDialog,
  MedicalExamDialog,
  MedicalRestrictionDialog,
  MedicalSurveillanceProgramDialog,
  MedicalPage,
  ExternalDeliveriesPage,
  CompaniesPage,
  CompanyDialog,
  DashboardPage,
  DocumentDialog,
  DocumentsPage,
  EmployeeDialog,
  EmployeesPage,
  IncidentDialog,
  IndicatorDialog,
  IndicatorsPage,
  IncidentsPage,
  LegalCompliancePage,
  ReportExportsPage,
  RiskDialog,
  RisksPage,
  SgsstAuditDialog,
  SgsstEvaluationDialog,
  SgsstEvaluationsPage,
  SgsstAuditsPage,
  preloadAnnualWorkPlanDialog,
  preloadPlannedInspectionDialog,
  preloadUnplannedInspectionDialog,
  preloadUnsafeReportDialog,
  preloadPpeDialogs,
  preloadSgsstAuditDialog,
  preloadSgsstEvaluationDialog,
  preloadCompanyDialog,
  preloadContractorDialogs,
  preloadDocumentDialog,
  preloadEmployeeDialog,
  preloadIncidentDialog,
  preloadIndicatorDialog,
  preloadRiskDialog,
  preloadSiteDialog,
  preloadTrainingDialog,
  preloadUserDialog,
  preloadView,
  SiteDialog,
  SitesPage,
  TrainingDialog,
  TrainingsPage,
  UserDialog,
  UsersPage,
} from './routes/lazyRoutes'
import { theme } from './theme'
import { ViewErrorBoundary } from './components/ViewErrorBoundary'
import type {
  AnnualActivityFormValues,
  AnnualWorkPlan,
  AppNotification,
  AuditLog,
  Contractor,
  ContractorDocument,
  ContractorEntryAuthorization,
  ContractorWorker,
  DeveloperAuditEntry,
  DeveloperDiagnostics,
  DeveloperErrors,
  DeveloperModules,
  DeveloperOverview,
  DeveloperQueues,
  DeveloperPanelData,
  PlannedInspection,
  UnplannedInspection,
  UnsafeReport,
  PpeDelivery,
  PpeItem,
  MedicalProfile,
  MedicalExam,
  MedicalRestriction,
  MedicalSurveillanceProgram,
  MedicalProfileFormValues,
  MedicalExamFormValues,
  MedicalRestrictionFormValues,
  MedicalSurveillanceProgramFormValues,
  ExternalDelivery,
  ExternalDeliveryFilters,
  AuthUser,
  Company,
  DashboardSummary,
  SgsstDocument,
  Employee,
  Incident,
  Paginated,
  ReportExport,
  ReportExportFilters,
  ReportExportMetricSnapshot,
  ReportExportMetrics,
  Risk,
  SgsstAudit,
  SgsstEvaluation,
  Indicator,
  Site,
  SystemUser,
  Training,
  View,
  EvaluationItemStatus,
} from './types'
import { isPaginated, reportExportParams, sanitize, tableParams } from './utils'

/**
 * Vistas con filtro de sede persistido en la URL (hash routing minimo):
 * #/employees?site=<uuid|none> — sin react-router; solo lectura/escritura
 * del hash con replaceState para que las vistas filtradas sean compartibles.
 */const SITE_FILTER_VIEWS = ['employees', 'incidents', 'risks', 'trainings', 'documents', 'plannedInspections']
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALL_VIEWS: View[] = [
  'dashboard',
  'aiAssistant',
  'companies',
  'contractors',
  'developer',
  'sites',
  'employees',
  'incidents',
  'risks',
  'trainings',
  'documents',
  'sgsstAudits',
  'sgsstEvaluations',
  'indicators',
  'legalCompliance',
  'annualWorkPlans',
  'plannedInspections',
  'unplannedInspections',
  'unsafeReports',
  'ppe',
  'medical',
  'reports',
  'users',
  'externalDeliveries',
  'audit',
]

function readHashLocation(): { view: View; site: string } {
  const hash = window.location.hash.replace(/^#\/?/, '')
  const [path, query] = hash.split('?')
  const candidate = path ?? ''
  const view = (ALL_VIEWS as string[]).includes(candidate) ? (candidate as View) : 'dashboard'
  const rawSite = new URLSearchParams(query ?? '').get('site') ?? 'all'
  // Valor invalido -> 'all' (el backend responderia 404 a una sede inexistente).
  const site = rawSite === 'none' || rawSite === 'all' || UUID_PATTERN.test(rawSite) ? rawSite : 'all'
  return { view, site }
}

// Tokens que el callback SSO entrega en el fragmento (#access_token=...).
// Se lee una sola vez al arrancar, ANTES de que el efecto de routing reescriba el hash.
function consumeSsoFragment(): { token?: string; refreshToken?: string; user?: AuthUser; error?: boolean } {
  if (window.location.hash.includes('access_token=')) {
    const params = new URLSearchParams(window.location.hash.slice(1))
    const token = params.get('access_token') ?? undefined
    const refreshToken = params.get('refresh_token') ?? undefined
    const userRaw = params.get('user')
    let user: AuthUser | undefined
    try {
      user = userRaw ? (JSON.parse(userRaw) as AuthUser) : undefined
    } catch {
      user = undefined
    }
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    if (token && user) return { token, refreshToken, user }
    return { error: true }
  }
  if (window.location.search.includes('sso=error')) {
    window.history.replaceState(null, '', window.location.pathname)
    return { error: true }
  }
  return {}
}

function App() {
  const [ssoFragment] = useState(() => consumeSsoFragment())
  const [token, setToken] = useState(() => getStoredSession().token)
  const [user, setUser] = useState<AuthUser | null>(() => getStoredSession().user)
  const [initialHash] = useState(() => readHashLocation())
  const [view, setView] = useState<View>(initialHash.view)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  // S11 Contratistas: listado + sub-recursos + autorizacion de ingreso.
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [contractorMeta, setContractorMeta] = useState(emptyMeta)
  const [contractorTable, setContractorTable] = useState(initialTableState)
  const [contractorWorkers, setContractorWorkers] = useState<ContractorWorker[]>([])
  const [contractorDocuments, setContractorDocuments] = useState<ContractorDocument[]>([])
  const [contractorEntryAuth, setContractorEntryAuth] = useState<ContractorEntryAuthorization | null>(null)
  const [contractorEntryAuthLoading, setContractorEntryAuthLoading] = useState(false)
  // Panel de desarrollador (rol DEVELOPER): datos tecnicos de plataforma.
  const emptyDeveloperPanel: DeveloperPanelData = {
    overview: null,
    modules: null,
    queues: null,
    audit: [],
    diagnostics: null,
    errors: null,
  }
  const [developerPanel, setDeveloperPanel] = useState<DeveloperPanelData>(emptyDeveloperPanel)
  const [sites, setSites] = useState<Site[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [risks, setRisks] = useState<Risk[]>([])
  const [trainings, setTrainings] = useState<Training[]>([])
  const [documents, setDocuments] = useState<SgsstDocument[]>([])
  const [sgsstAudits, setSgsstAudits] = useState<SgsstAudit[]>([])
  const [sgsstEvaluations, setSgsstEvaluations] = useState<SgsstEvaluation[]>([])
  const [annualWorkPlans, setAnnualWorkPlans] = useState<AnnualWorkPlan[]>([])
  const [plannedInspections, setPlannedInspections] = useState<PlannedInspection[]>([])
  const [unplannedInspections, setUnplannedInspections] = useState<UnplannedInspection[]>([])
  const [unsafeReports, setUnsafeReports] = useState<UnsafeReport[]>([])
  const [ppeItems, setPpeItems] = useState<PpeItem[]>([])
  const [ppeDeliveries, setPpeDeliveries] = useState<PpeDelivery[]>([])
  const [indicators, setIndicators] = useState<Indicator[]>([])
  const [reportExports, setReportExports] = useState<ReportExport[]>([])
  const [reportMetrics, setReportMetrics] = useState<ReportExportMetrics>(emptyReportMetrics)
  const [reportMetricHistory, setReportMetricHistory] = useState<ReportExportMetricSnapshot[]>([])
  const [users, setUsers] = useState<SystemUser[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [notificationUnread, setNotificationUnread] = useState(0)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [externalDeliveries, setExternalDeliveries] = useState<ExternalDelivery[]>([])
  const [externalDeliveryMeta, setExternalDeliveryMeta] = useState(emptyMeta)
  const [externalDeliveryTable, setExternalDeliveryTable] = useState(initialTableState)
  const [externalDeliveryFilters, setExternalDeliveryFilters] = useState<ExternalDeliveryFilters>({ provider: 'all', status: 'all', companyId: '' })
  const [externalDeliveryDialog, setExternalDeliveryDialog] = useState<ExternalDelivery | null>(null)
  const [dashboardSummary, setDashboardSummary] = useState(emptySummary)
  const [companyMeta, setCompanyMeta] = useState(emptyMeta)
  const [siteMeta, setSiteMeta] = useState(emptyMeta)
  const [employeeMeta, setEmployeeMeta] = useState(emptyMeta)
  const [incidentMeta, setIncidentMeta] = useState(emptyMeta)
  const [riskMeta, setRiskMeta] = useState(emptyMeta)
  const [trainingMeta, setTrainingMeta] = useState(emptyMeta)
  const [documentMeta, setDocumentMeta] = useState(emptyMeta)
  const [sgsstAuditMeta, setSgsstAuditMeta] = useState(emptyMeta)
  const [sgsstEvaluationMeta, setSgsstEvaluationMeta] = useState(emptyMeta)
  const [annualWorkPlanMeta, setAnnualWorkPlanMeta] = useState(emptyMeta)
  const [plannedInspectionMeta, setPlannedInspectionMeta] = useState(emptyMeta)
  const [unplannedInspectionMeta, setUnplannedInspectionMeta] = useState(emptyMeta)
  const [unsafeReportMeta, setUnsafeReportMeta] = useState(emptyMeta)
  const [ppeMeta, setPpeMeta] = useState(emptyMeta)
  const [indicatorMeta, setIndicatorMeta] = useState(emptyMeta)
  const [reportExportMeta, setReportExportMeta] = useState(emptyMeta)
  const [userMeta, setUserMeta] = useState(emptyMeta)
  const [auditMeta, setAuditMeta] = useState(emptyMeta)
  const [companyTable, setCompanyTable] = useState(initialTableState)
  const [siteTable, setSiteTable] = useState(initialTableState)
  const [employeeTable, setEmployeeTable] = useState(initialTableState)
  // Filtro de sede inicial desde la URL (compartible); 'all' si no hay hash.
  const [employeeSiteFilter, setEmployeeSiteFilter] = useState(initialHash.view === 'employees' ? initialHash.site : 'all')
  const [incidentTable, setIncidentTable] = useState(initialTableState)
  const [incidentSiteFilter, setIncidentSiteFilter] = useState(initialHash.view === 'incidents' ? initialHash.site : 'all')
  const [riskTable, setRiskTable] = useState(initialTableState)
  const [riskSiteFilter, setRiskSiteFilter] = useState(initialHash.view === 'risks' ? initialHash.site : 'all')
  const [trainingTable, setTrainingTable] = useState(initialTableState)
  const [trainingSiteFilter, setTrainingSiteFilter] = useState(initialHash.view === 'trainings' ? initialHash.site : 'all')
  const [documentTable, setDocumentTable] = useState(initialTableState)
  const [documentSiteFilter, setDocumentSiteFilter] = useState(initialHash.view === 'documents' ? initialHash.site : 'all')
  const [sgsstAuditTable, setSgsstAuditTable] = useState(initialTableState)
  const [annualWorkPlanTable, setAnnualWorkPlanTable] = useState(initialTableState)
  const [plannedInspectionTable, setPlannedInspectionTable] = useState(initialTableState)
  const [plannedInspectionSiteFilter, setPlannedInspectionSiteFilter] = useState(initialHash.view === 'plannedInspections' ? initialHash.site : 'all')
  const [unplannedInspectionTable, setUnplannedInspectionTable] = useState(initialTableState)
  const [sgsstEvaluationTable, setSgsstEvaluationTable] = useState(initialTableState)
  const [indicatorTable, setIndicatorTable] = useState(initialTableState)
  const [reportExportTable, setReportExportTable] = useState(initialTableState)
  const [reportExportFilters, setReportExportFilters] = useState<ReportExportFilters>({
    status: 'all',
    companyId: '',
    requestedById: '',
    dateFrom: '',
    dateTo: '',
  })
  const [userTable, setUserTable] = useState(initialTableState)
  const [auditTable, setAuditTable] = useState(initialTableState)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [login, setLogin] = useState({ email: '', password: '' })
  const [mfaToken, setMfaToken] = useState('')
  const [mfa, setMfa] = useState({ code: '' })
  const [mfaSettingsOpen, setMfaSettingsOpen] = useState(false)
  const [mfaSetup, setMfaSetup] = useState({ secret: '', otpauthUrl: '', code: '' })
  const [bootstrapOpen, setBootstrapOpen] = useState(false)
  const [ssoOptions, setSsoOptions] = useState<Array<{ companyId: string; companyName: string; protocol: string }>>([])
  const [ssoOptionsOpen, setSsoOptionsOpen] = useState(false)
  const [ssoConfigOpen, setSsoConfigOpen] = useState(false)
  const [ssoConfigCompany, setSsoConfigCompany] = useState<Company | null>(null)
  const [ssoConfigured, setSsoConfigured] = useState(false)
  const [ssoProviderId, setSsoProviderId] = useState('')
  const [ssoConfigValues, setSsoConfigValues] = useState<SsoConfigValues>(emptySsoConfig)
  const [bootstrap, setBootstrap] = useState({ name: '', email: '', password: '' })
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Aceptar',
    confirmColor: 'primary' as 'error' | 'success' | 'primary',
    onConfirm: () => {},
  })
  const [passwordForm, setPasswordForm] = useState<ChangePasswordValues>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [companyDialog, setCompanyDialog] = useState<{ open: boolean; item?: Company }>({ open: false })
  const [contractorDialog, setContractorDialog] = useState<{ open: boolean; item?: Contractor }>({ open: false })
  const [contractorDetail, setContractorDetail] = useState<Contractor | null>(null)
  const [contractorWorkerDialog, setContractorWorkerDialog] = useState<{ open: boolean; item?: ContractorWorker }>({ open: false })
  const [contractorDocumentDialog, setContractorDocumentDialog] = useState<{ open: boolean; item?: ContractorDocument }>({ open: false })
  const [siteDialog, setSiteDialog] = useState<{ open: boolean; item?: Site }>({ open: false })
  const [employeeDialog, setEmployeeDialog] = useState<{ open: boolean; item?: Employee }>({ open: false })
  const [incidentDialog, setIncidentDialog] = useState<{ open: boolean; item?: Incident }>({ open: false })
  const [riskDialog, setRiskDialog] = useState<{ open: boolean; item?: Risk }>({ open: false })
  const [trainingDialog, setTrainingDialog] = useState<{ open: boolean; item?: Training }>({ open: false })
  const [documentDialog, setDocumentDialog] = useState<{ open: boolean; item?: SgsstDocument }>({ open: false })
  const [sgsstAuditDialog, setSgsstAuditDialog] = useState<{ open: boolean; item?: SgsstAudit }>({ open: false })
  const [sgsstEvaluationDialog, setSgsstEvaluationDialog] = useState<{ open: boolean; item?: SgsstEvaluation }>({ open: false })
  const [annualWorkPlanDialog, setAnnualWorkPlanDialog] = useState<{ open: boolean; item?: AnnualWorkPlan }>({ open: false })
  const [plannedInspectionDialog, setPlannedInspectionDialog] = useState<{ open: boolean; item?: PlannedInspection }>({ open: false })
  const [unplannedInspectionDialog, setUnplannedInspectionDialog] = useState<{ open: boolean; item?: UnplannedInspection }>({ open: false })
  const [unsafeReportDialog, setUnsafeReportDialog] = useState<{ open: boolean; item?: UnsafeReport }>({ open: false })
  const [ppeItemDialog, setPpeItemDialog] = useState<{ open: boolean; item?: PpeItem }>({ open: false })
  const [ppeDeliveryDialogOpen, setPpeDeliveryDialogOpen] = useState(false)
  const [indicatorDialog, setIndicatorDialog] = useState<{ open: boolean; item?: Indicator }>({ open: false })
  const [userDialog, setUserDialog] = useState<{ open: boolean; item?: SystemUser }>({ open: false })
  const [companyForm, setCompanyForm] = useState(emptyCompany)
  const [contractorForm, setContractorForm] = useState(emptyContractor)
  const [contractorWorkerForm, setContractorWorkerForm] = useState(emptyContractorWorker)
  const [contractorDocumentForm, setContractorDocumentForm] = useState(emptyContractorDocument)
  const [siteForm, setSiteForm] = useState(emptySite)
  const [employeeForm, setEmployeeForm] = useState(emptyEmployee)
  const [incidentForm, setIncidentForm] = useState(emptyIncident)
  const [riskForm, setRiskForm] = useState(emptyRisk)
  const [trainingForm, setTrainingForm] = useState(emptyTraining)
  const [documentForm, setDocumentForm] = useState(emptyDocument)
  const [sgsstAuditForm, setSgsstAuditForm] = useState(emptySgsstAudit)
  const [sgsstEvaluationForm, setSgsstEvaluationForm] = useState(emptySgsstEvaluation)
  const [annualWorkPlanForm, setAnnualWorkPlanForm] = useState(emptyAnnualWorkPlan)
  const [plannedInspectionForm, setPlannedInspectionForm] = useState(emptyPlannedInspection)
  const [unplannedInspectionForm, setUnplannedInspectionForm] = useState(emptyUnplannedInspection)
  const [unsafeReportForm, setUnsafeReportForm] = useState(emptyUnsafeReport)
  const [ppeItemForm, setPpeItemForm] = useState(emptyPpeItem)
  const [ppeDeliveryForm, setPpeDeliveryForm] = useState(emptyPpeDelivery)
  const [medicalProfiles, setMedicalProfiles] = useState<MedicalProfile[]>([])
  const [medicalExams, setMedicalExams] = useState<MedicalExam[]>([])
  const [medicalRestrictions, setMedicalRestrictions] = useState<MedicalRestriction[]>([])
  const [medicalProfileDialog, setMedicalProfileDialog] = useState(false)
  const [medicalExamDialog, setMedicalExamDialog] = useState<{ open: boolean; exam?: MedicalExam }>({ open: false })
  const [medicalRestrictionDialog, setMedicalRestrictionDialog] = useState(false)
  const [surveillancePrograms, setSurveillancePrograms] = useState<MedicalSurveillanceProgram[]>([])
  const [surveillanceProgramDialog, setSurveillanceProgramDialog] = useState(false)
  const [surveillanceProgramForm, setSurveillanceProgramForm] = useState<MedicalSurveillanceProgramFormValues>(emptyMedicalSurveillanceProgram)
  const [medicalProfileForm, setMedicalProfileForm] = useState<MedicalProfileFormValues>(emptyMedicalProfile)
  const [medicalExamForm, setMedicalExamForm] = useState<MedicalExamFormValues>(emptyMedicalExam)
  const [medicalRestrictionForm, setMedicalRestrictionForm] = useState<MedicalRestrictionFormValues>(emptyMedicalRestriction)
  const [indicatorForm, setIndicatorForm] = useState(emptyIndicator)
  const [userForm, setUserForm] = useState(emptyUser)

  const isPlatformAdmin = user?.role === 'SUPER_ADMIN'
  const isEmployee = user?.role === 'EMPLOYEE'
  const activeCompanyId = user?.activeCompanyId ?? user?.companyId
  const canManageCompanies = isPlatformAdmin || user?.role === 'ADMIN' || user?.role === 'SST' || user?.role === 'AUDITOR'
  // S11 Contratistas: lectura para ADMIN/SST/AUDITOR/EMPLOYEE; gestion y
  // autorizacion de ingreso sin EMPLOYEE (mismo criterio del backend).
  const canViewContractors = isPlatformAdmin || user?.role === 'ADMIN' || user?.role === 'SST' || user?.role === 'AUDITOR' || user?.role === 'EMPLOYEE'
  const canManageContractors = isPlatformAdmin || user?.role === 'ADMIN' || user?.role === 'SST'
  const canViewEntryAuth = canManageContractors || user?.role === 'AUDITOR'
  const canManageEmployees = isPlatformAdmin || user?.role === 'ADMIN' || user?.role === 'SST'
  // Autoservicio: el trabajador reporta incidentes y consulta riesgos/capacitaciones.
  const canManageOperations = isPlatformAdmin || user?.role === 'ADMIN' || user?.role === 'SST'
  const canReportIncidents = isPlatformAdmin || user?.role === 'ADMIN' || user?.role === 'SST' || user?.role === 'EMPLOYEE'
  const canManageSites = isPlatformAdmin || user?.role === 'ADMIN' || user?.role === 'SST'
  // Sedes siguen la misma visibilidad que documentos/auditorias SG-SST (lectura
  // tambien para AUDITOR; EMPLOYEE no navega esta vista).
  const canViewSites = isPlatformAdmin || user?.role === 'ADMIN' || user?.role === 'SST' || user?.role === 'AUDITOR'
  const canViewDocuments = isPlatformAdmin || user?.role === 'ADMIN' || user?.role === 'SST' || user?.role === 'AUDITOR'
  const canViewReports = isPlatformAdmin || user?.role === 'ADMIN' || user?.role === 'SST' || user?.role === 'AUDITOR'
  // Plan Anual de Trabajo (S8): misma visibilidad que documentos/evaluaciones;
  // EMPLOYEE no navega esta vista (selectView lo bloquea).
  const canViewAnnualPlans = canViewDocuments
  // S9.3/S9.4: reportes de actos/condiciones y EPP con la misma visibilidad que
  // operaciones; el reporte directo tambien lo hace EMPLOYEE (canal de participacion).
  const canViewUnsafeReports = canViewAnnualPlans || isEmployee
  const canReportUnsafe = canManageOperations || isEmployee
  // Medicina laboral (S10): datos sensibles de salud. Sin EMPLOYEE; solo
  // ADMIN/SST para gestion y AUDITOR/SUPER_ADMIN en modo consulta.
  const canViewMedical = isPlatformAdmin || user?.role === 'ADMIN' || user?.role === 'SST' || user?.role === 'AUDITOR'
  const canManageMedical = canManageOperations
  // EMPLOYEE consulta datos y dashboard, pero no genera exports (solo-backoffice).
  const canExportReports = canViewReports
  const canViewReportHistory = isPlatformAdmin
  const canManageDocuments = isPlatformAdmin || user?.role === 'ADMIN' || user?.role === 'SST'
  const canDeleteEmployees = isPlatformAdmin || user?.role === 'ADMIN'
  const canViewUsers = isPlatformAdmin || user?.role === 'ADMIN' || user?.role === 'SST'
  const canManageUsers = isPlatformAdmin || user?.role === 'ADMIN'
  const canViewAudit = isPlatformAdmin || user?.role === 'ADMIN' || user?.role === 'AUDITOR'
  // Panel tecnico: exclusivo del rol de plataforma DEVELOPER.
  const isDeveloper = user?.role === 'DEVELOPER'
  // Asistente IA (Sprint 16): los mismos roles autorizados por el backend.
  // EMPLOYEE queda fuera (el backend responde 403 a sus consultas de datos).
  const canUseAssistant = isPlatformAdmin || user?.role === 'ADMIN' || user?.role === 'SST' || user?.role === 'AUDITOR'
  const canRetryDeliveries = user?.role === 'ADMIN'

  const selectedTitle =
    view === 'dashboard'
      ? 'Dashboard'
      : view === 'aiAssistant'
        ? 'Asistente inteligente'
        : view === 'companies'
        ? 'Empresas'
        : view === 'contractors'
          ? 'Contratistas'
        : view === 'developer'
          ? 'Panel de desarrollador'
        : view === 'sites'
          ? 'Sedes'
          : view === 'employees'
          ? 'Empleados'
          : view === 'incidents'
            ? 'Incidentes'
            : view === 'risks'
              ? 'Riesgos'
              : view === 'trainings'
                ? 'Capacitaciones'
                : view === 'documents'
                  ? 'Documentos'
                  : view === 'sgsstAudits'
                    ? 'Auditorias SG-SST'
                    : view === 'sgsstEvaluations'
                      ? 'Evaluacion Res. 0312'
                      : view === 'indicators'
                        ? 'Indicadores SG-SST'
                    : view === 'legalCompliance'
                      ? 'Mapa normativo'                      : view === 'annualWorkPlans'
                        ? 'Plan Anual de Trabajo'
                        : view === 'plannedInspections'
                          ? 'Inspecciones planeadas'
                          : view === 'unplannedInspections'
                            ? 'Inspecciones no planeadas'
                            : view === 'reports'
                            ? 'Mis reportes'
                        : view === 'users'
                          ? 'Usuarios'
                          : 'Auditoria'

  const stats = useMemo(
    () => [
      { label: 'Empresas activas', value: dashboardSummary.companiesCount, icon: <Business /> },
      { label: 'Empleados activos', value: dashboardSummary.employeesCount, icon: <People /> },
      { label: 'Riesgos criticos', value: dashboardSummary.criticalRisks, icon: <WarningAmber /> },
      { label: 'Incidentes abiertos', value: dashboardSummary.openIncidents, icon: <ReportProblem /> },
      { label: 'Capacitaciones vencidas', value: dashboardSummary.overdueTrainings, icon: <School /> },
      { label: 'Documentos activos', value: dashboardSummary.documentsCount, icon: <Description /> },
      { label: 'Rol de sesion', value: user?.role ?? '-', icon: <Security /> },
      { label: 'Usuarios activos', value: dashboardSummary.usersCount, icon: <ManageAccounts /> },
      { label: 'Registros activos', value: `${dashboardSummary.activeRate}%`, icon: <SpaceDashboard /> },
    ],
    [dashboardSummary, user?.role],
  )

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken('')
      setUser(null)
      resetWorkspace()
      setError('La sesion expiro. Inicia sesion nuevamente.')
    })
  }, [])

  useEffect(() => {
    if (token) {
      void loadData()
    }
  }, [token, companyTable, contractorTable, siteTable, employeeTable, employeeSiteFilter, incidentTable, incidentSiteFilter, riskTable, riskSiteFilter, trainingTable, trainingSiteFilter, documentTable, documentSiteFilter, sgsstAuditTable, sgsstEvaluationTable, annualWorkPlanTable, plannedInspectionTable, plannedInspectionSiteFilter, indicatorTable, reportExportTable, reportExportFilters, userTable, auditTable, externalDeliveryTable, externalDeliveryFilters])

  // La URL refleja vista + filtro de sede (sin entradas de historial).
  useEffect(() => {
    const params = new URLSearchParams()
    if ((SITE_FILTER_VIEWS as string[]).includes(view)) {
      const siteFilter =
        view === 'employees'
          ? employeeSiteFilter
          : view === 'incidents'
            ? incidentSiteFilter
            : view === 'risks'
              ? riskSiteFilter
              : view === 'trainings'
                ? trainingSiteFilter
                : view === 'plannedInspections'
                  ? plannedInspectionSiteFilter
                  : documentSiteFilter
      if (siteFilter !== 'all') {
        params.set('site', siteFilter)
      }
    }
    const query = params.toString()
    const nextHash = `#/${view}${query ? `?${query}` : ''}`
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', nextHash)
    }
  }, [view, employeeSiteFilter, incidentSiteFilter, riskSiteFilter, trainingSiteFilter, documentSiteFilter, plannedInspectionSiteFilter])

  async function loadData(refreshDashboard = false) {
    setLoading(true)
    setError('')
    try {
      const hasCompanyScope = isPlatformAdmin || Boolean(activeCompanyId)
      const companyRequest =
        canManageCompanies
          ? api.get<Paginated<Company>>('/companies', { params: tableParams(companyTable) })
          : hasCompanyScope
            ? api.get<Company>(`/companies/${activeCompanyId}`)
            : Promise.resolve({ data: [] as Company[] })
      // S11 Contratistas: paginado; la empresa la resuelve el backend desde el
      // JWT (resolveCompanyScope) y el DTO no acepta companyId en el query.
      const contractorRequest = canViewContractors && hasCompanyScope
        ? api.get<Paginated<Contractor>>('/contractors', { params: tableParams(contractorTable) })
        : Promise.resolve({ data: { data: [] as Contractor[], meta: emptyMeta } })
      const siteRequest = (canViewSites || isEmployee) && hasCompanyScope
        ? api.get<Paginated<Site>>('/sites', {
            params: {
              ...tableParams(siteTable),
              ...(isPlatformAdmin ? {} : { companyId: activeCompanyId }),
            },
          })
        : Promise.resolve({ data: { data: [] as Site[], meta: emptyMeta } })
      const employeeRequest = hasCompanyScope
        ? api.get<Paginated<Employee>>('/employees', {
            params: {
              ...tableParams(employeeTable),
              ...(isPlatformAdmin ? {} : { companyId: activeCompanyId }),
              ...(employeeSiteFilter !== 'all' ? { siteId: employeeSiteFilter } : {}),
            },
          })
        : Promise.resolve({ data: { data: [] as Employee[], meta: emptyMeta } })
      const incidentsRequest = hasCompanyScope
        ? api.get<Paginated<Incident>>('/incidents', {
            params: {
              ...tableParams(incidentTable),
              ...(isPlatformAdmin ? {} : { companyId: activeCompanyId }),
              ...(incidentSiteFilter !== 'all' ? { siteId: incidentSiteFilter } : {}),
            },
          })
        : Promise.resolve({ data: { data: [] as Incident[], meta: emptyMeta } })
      const risksRequest = hasCompanyScope
        ? api.get<Paginated<Risk>>('/risks', {
            params: {
              ...tableParams(riskTable),
              ...(isPlatformAdmin ? {} : { companyId: activeCompanyId }),
              ...(riskSiteFilter !== 'all' ? { siteId: riskSiteFilter } : {}),
            },
          })
        : Promise.resolve({ data: { data: [] as Risk[], meta: emptyMeta } })
      const trainingsRequest = hasCompanyScope
        ? api.get<Paginated<Training>>('/trainings', {
            params: {
              ...tableParams(trainingTable),
              ...(isPlatformAdmin ? {} : { companyId: activeCompanyId }),
              ...(trainingSiteFilter !== 'all' ? { siteId: trainingSiteFilter } : {}),
            },
          })
        : Promise.resolve({ data: { data: [] as Training[], meta: emptyMeta } })
      const userRequest = canViewUsers && hasCompanyScope
        ? api.get<Paginated<SystemUser>>('/users', {
            params: {
              ...tableParams(userTable),
              ...(isPlatformAdmin ? {} : { companyId: activeCompanyId }),
            },
          })
        : Promise.resolve({ data: { data: [] as SystemUser[], meta: emptyMeta } })
      const documentRequest = canViewDocuments && hasCompanyScope
        ? api.get<Paginated<SgsstDocument>>('/documents', {
            params: {
              ...tableParams(documentTable),
              ...(isPlatformAdmin ? {} : { companyId: activeCompanyId }),
              ...(documentSiteFilter !== 'all' ? { siteId: documentSiteFilter } : {}),
            },
          })
        : Promise.resolve({ data: { data: [] as SgsstDocument[], meta: emptyMeta } })
      const auditRequest = canViewAudit
        ? api.get<Paginated<AuditLog>>('/audit-logs', { params: tableParams(auditTable) })
        : Promise.resolve({ data: { data: [] as AuditLog[], meta: emptyMeta } })
      const externalDeliveryRequest = canRetryDeliveries && hasCompanyScope
        ? api.get<Paginated<ExternalDelivery>>('/notifications/external-deliveries', {
            params: {
              ...tableParams(externalDeliveryTable),
              ...(externalDeliveryFilters.provider !== 'all' ? { provider: externalDeliveryFilters.provider } : {}),
              ...(externalDeliveryFilters.status !== 'all' ? { status: externalDeliveryFilters.status } : {}),
              ...(isPlatformAdmin
                ? externalDeliveryFilters.companyId
                  ? { companyId: externalDeliveryFilters.companyId } : {}
                : { companyId: activeCompanyId }),
            },
          })
        : Promise.resolve({ data: { data: [] as ExternalDelivery[], meta: emptyMeta } })
      const sgsstAuditRequest = canViewDocuments && hasCompanyScope
        ? api.get<Paginated<SgsstAudit>>('/sgsst-audits', {
            params: {
              ...tableParams(sgsstAuditTable),
              ...(isPlatformAdmin ? {} : { companyId: activeCompanyId }),
            },
          })
        : Promise.resolve({ data: { data: [] as SgsstAudit[], meta: emptyMeta } })
      const sgsstEvaluationRequest = canViewDocuments && hasCompanyScope
        ? api.get<Paginated<SgsstEvaluation>>('/sgsst-evaluations', {
            params: {
              ...tableParams(sgsstEvaluationTable),
              ...(isPlatformAdmin ? {} : { companyId: activeCompanyId }),
            },
          })
        : Promise.resolve({ data: { data: [] as SgsstEvaluation[], meta: emptyMeta } })
      const indicatorRequest = canViewDocuments && hasCompanyScope
        ? api.get<Paginated<Indicator>>('/indicators', {
            params: {
              ...tableParams(indicatorTable),
              ...(isPlatformAdmin ? {} : { companyId: activeCompanyId }),
            },
          })
        : Promise.resolve({ data: { data: [] as Indicator[], meta: emptyMeta } })
      const annualWorkPlanRequest = canViewAnnualPlans && hasCompanyScope
        ? api.get<AnnualWorkPlan[]>('/annual-work-plans', {
            params: isPlatformAdmin ? {} : { companyId: activeCompanyId },
          })
        : Promise.resolve({ data: [] as AnnualWorkPlan[] })
      const plannedInspectionRequest = canViewAnnualPlans && hasCompanyScope
        ? api.get<PlannedInspection[]>('/planned-inspections', {
            params: {
              ...(isPlatformAdmin ? {} : { companyId: activeCompanyId }),
              ...(plannedInspectionSiteFilter !== 'all' ? { siteId: plannedInspectionSiteFilter } : {}),
            },
          })
        : Promise.resolve({ data: [] as PlannedInspection[] })
      const unplannedInspectionRequest = canViewAnnualPlans && hasCompanyScope
        ? api.get<UnplannedInspection[]>('/unplanned-inspections', {
            params: isPlatformAdmin ? {} : { companyId: activeCompanyId },
          })
        : Promise.resolve({ data: [] as UnplannedInspection[] })
      const unsafeReportRequest = canViewUnsafeReports && hasCompanyScope
        ? api.get<UnsafeReport[]>('/unsafe-reports', {
            params: isPlatformAdmin ? {} : { companyId: activeCompanyId },
          })
        : Promise.resolve({ data: [] as UnsafeReport[] })
      const ppeItemsRequest = canViewAnnualPlans && hasCompanyScope
        ? api.get<PpeItem[]>('/ppe/items', {
            params: isPlatformAdmin ? {} : { companyId: activeCompanyId },
          })
        : Promise.resolve({ data: [] as PpeItem[] })
      const ppeDeliveriesRequest = canViewAnnualPlans && hasCompanyScope
        ? api.get<PpeDelivery[]>('/ppe/deliveries', {
            params: isPlatformAdmin ? {} : { companyId: activeCompanyId },
          })
        : Promise.resolve({ data: [] as PpeDelivery[] })
      const medicalProfilesRequest = canViewMedical && hasCompanyScope
        ? api.get<MedicalProfile[]>('/medical/profiles', {
            params: isPlatformAdmin ? {} : { companyId: activeCompanyId },
          })
        : Promise.resolve({ data: [] as MedicalProfile[] })
      const medicalExamsRequest = canViewMedical && hasCompanyScope
        ? api.get<MedicalExam[]>('/medical/exams', {
            params: isPlatformAdmin ? {} : { companyId: activeCompanyId },
          })
        : Promise.resolve({ data: [] as MedicalExam[] })
      const medicalRestrictionsRequest = canViewMedical && hasCompanyScope
        ? api.get<MedicalRestriction[]>('/medical/restrictions', {
            params: isPlatformAdmin ? {} : { companyId: activeCompanyId },
          })
        : Promise.resolve({ data: [] as MedicalRestriction[] })
      const surveillanceProgramsRequest = canViewMedical && hasCompanyScope
        ? api.get<MedicalSurveillanceProgram[]>('/medical/surveillance-programs', {
            params: isPlatformAdmin ? {} : { companyId: activeCompanyId },
          })
        : Promise.resolve({ data: [] as MedicalSurveillanceProgram[] })
      const reportExportsRequest = canViewReports && hasCompanyScope
        ? api.get<Paginated<ReportExport>>('/reports/exports', {
            params: reportExportParams(reportExportTable, reportExportFilters),
          })
        : Promise.resolve({ data: { data: [] as ReportExport[], meta: emptyMeta } })
      const reportMetricsRequest = canViewReports && hasCompanyScope
        ? api.get<ReportExportMetrics>('/reports/metrics', {
            params: reportExportParams(reportExportTable, reportExportFilters),
          })
        : Promise.resolve({ data: emptyReportMetrics })
      const reportMetricHistoryRequest = canViewReportHistory && hasCompanyScope
        ? api.get<ReportExportMetricSnapshot[]>('/reports/metrics/history', {
            params: reportExportParams(reportExportTable, reportExportFilters),
          })
        : Promise.resolve({ data: [] as ReportExportMetricSnapshot[] })
      const notificationRequest = hasCompanyScope
        ? api.get<Paginated<AppNotification>>('/notifications', {
            params: { page: 1, pageSize: 8 },
          })
        : Promise.resolve({ data: { data: [] as AppNotification[], meta: { unread: 0 } } })
      const summaryRequest = hasCompanyScope
        ? api.get<DashboardSummary>('/dashboard/summary', {
            params: { refresh: refreshDashboard || undefined },
          })
        : Promise.resolve({ data: emptySummary })
      const [
        companyResponse,
        contractorResponse,
        siteResponse,
        employeeResponse,
        incidentsResponse,
        risksResponse,
        trainingsResponse,
        documentResponse,
        sgsstAuditResponse,
        sgsstEvaluationResponse,
        indicatorResponse,
        annualWorkPlanResponse,
        plannedInspectionResponse,
        unplannedInspectionResponse,
        unsafeReportResponse,
        ppeItemsResponse,
        ppeDeliveriesResponse,
        medicalProfilesResponse,
        medicalExamsResponse,
        medicalRestrictionsResponse,
        surveillanceProgramsResponse,
        reportExportsResponse,
        reportMetricsResponse,
        reportMetricHistoryResponse,
        userResponse,
        auditResponse,
        externalDeliveryResponse,
        notificationResponse,
        summaryResponse,
      ] = await Promise.all([
        companyRequest,
        contractorRequest,
        siteRequest,
        employeeRequest,
        incidentsRequest,
        risksRequest,
        trainingsRequest,
        documentRequest,
        sgsstAuditRequest,
        sgsstEvaluationRequest,
        indicatorRequest,
        annualWorkPlanRequest,
        plannedInspectionRequest,
        unplannedInspectionRequest,
        unsafeReportRequest,
        ppeItemsRequest,
        ppeDeliveriesRequest,
        medicalProfilesRequest,
        medicalExamsRequest,
        medicalRestrictionsRequest,
        surveillanceProgramsRequest,
        reportExportsRequest,
        reportMetricsRequest,
        reportMetricHistoryRequest,
        userRequest,
        auditRequest,
        externalDeliveryRequest,
        notificationRequest,
        summaryRequest,
      ])

      if (isPaginated<Company>(companyResponse.data)) {
        setCompanies(companyResponse.data.data)
        setCompanyMeta(companyResponse.data.meta)
      } else {
        const data = Array.isArray(companyResponse.data) ? companyResponse.data : [companyResponse.data]
        setCompanies(data)
        setCompanyMeta({ ...emptyMeta, total: data.length, totalPages: 1 })
      }
      if (isPaginated<Contractor>(contractorResponse.data)) {
        setContractors(contractorResponse.data.data)
        setContractorMeta(contractorResponse.data.meta)
      } else {
        setContractors([])
        setContractorMeta(emptyMeta)
      }
      setSites(siteResponse.data.data)
      setSiteMeta(siteResponse.data.meta)
      setEmployees(employeeResponse.data.data)
      setEmployeeMeta(employeeResponse.data.meta)
      // incidents/risks/trainings devuelven arrays planos (sin paginacion).
      const incidentRows = isPaginated<Incident>(incidentsResponse.data)
        ? incidentsResponse.data.data
        : Array.isArray(incidentsResponse.data)
          ? incidentsResponse.data
          : []
      setIncidents(incidentRows)
      setIncidentMeta(
        isPaginated<Incident>(incidentsResponse.data)
          ? incidentsResponse.data.meta
          : { ...emptyMeta, total: incidentRows.length, totalPages: 1 },
      )
      const riskRows = isPaginated<Risk>(risksResponse.data)
        ? risksResponse.data.data
        : Array.isArray(risksResponse.data)
          ? risksResponse.data
          : []
      setRisks(riskRows)
      setRiskMeta(
        isPaginated<Risk>(risksResponse.data)
          ? risksResponse.data.meta
          : { ...emptyMeta, total: riskRows.length, totalPages: 1 },
      )
      const trainingRows = isPaginated<Training>(trainingsResponse.data)
        ? trainingsResponse.data.data
        : Array.isArray(trainingsResponse.data)
          ? trainingsResponse.data
          : []
      setTrainings(trainingRows)
      setTrainingMeta(
        isPaginated<Training>(trainingsResponse.data)
          ? trainingsResponse.data.meta
          : { ...emptyMeta, total: trainingRows.length, totalPages: 1 },
      )
      setDocuments(documentResponse.data.data)
      setDocumentMeta(documentResponse.data.meta)
      setSgsstAudits(sgsstAuditResponse.data.data)
      setSgsstAuditMeta(sgsstAuditResponse.data.meta)
      setSgsstEvaluations(sgsstEvaluationResponse.data.data)
      setSgsstEvaluationMeta(sgsstEvaluationResponse.data.meta)
      setIndicators(indicatorResponse.data.data)
      setIndicatorMeta(indicatorResponse.data.meta)
      // El API de planes anuales devuelve array plano (sin paginacion).
      const planRows = Array.isArray(annualWorkPlanResponse.data) ? annualWorkPlanResponse.data : []
      setAnnualWorkPlans(planRows)
      setAnnualWorkPlanMeta({ ...emptyMeta, total: planRows.length, totalPages: 1 })
      // Inspecciones: array plano, filtro de sede aplicado en el servidor.
      const inspectionRows = Array.isArray(plannedInspectionResponse.data) ? plannedInspectionResponse.data : []
      setPlannedInspections(inspectionRows)
      setPlannedInspectionMeta({ ...emptyMeta, total: inspectionRows.length, totalPages: 1 })
      const unplannedRows = Array.isArray(unplannedInspectionResponse.data) ? unplannedInspectionResponse.data : []
      setUnplannedInspections(unplannedRows)
      setUnplannedInspectionMeta({ ...emptyMeta, total: unplannedRows.length, totalPages: 1 })
      const unsafeRows = Array.isArray(unsafeReportResponse.data) ? unsafeReportResponse.data : []
      setUnsafeReports(unsafeRows)
      setUnsafeReportMeta({ ...emptyMeta, total: unsafeRows.length, totalPages: 1 })
      const ppeItemRows = Array.isArray(ppeItemsResponse.data) ? ppeItemsResponse.data : []
      setPpeItems(ppeItemRows)
      setPpeMeta({ ...emptyMeta, total: ppeItemRows.length, totalPages: 1 })
      const ppeDeliveryRows = Array.isArray(ppeDeliveriesResponse.data) ? ppeDeliveriesResponse.data : []
      setPpeDeliveries(ppeDeliveryRows)
      const medicalProfileRows = Array.isArray(medicalProfilesResponse.data) ? medicalProfilesResponse.data : []
      setMedicalProfiles(medicalProfileRows)
      const medicalExamRows = Array.isArray(medicalExamsResponse.data) ? medicalExamsResponse.data : []
      setMedicalExams(medicalExamRows)
      const medicalRestrictionRows = Array.isArray(medicalRestrictionsResponse.data) ? medicalRestrictionsResponse.data : []
      setMedicalRestrictions(medicalRestrictionRows)
      setSurveillancePrograms(Array.isArray(surveillanceProgramsResponse.data) ? surveillanceProgramsResponse.data : [])
      setReportExports(reportExportsResponse.data.data)
      setReportExportMeta(reportExportsResponse.data.meta)
      setReportMetrics(reportMetricsResponse.data)
      setReportMetricHistory(reportMetricHistoryResponse.data)
      setUsers(userResponse.data.data)
      setUserMeta(userResponse.data.meta)
      setAuditLogs(auditResponse.data.data)
      if (isPaginated<ExternalDelivery>(externalDeliveryResponse.data)) {
        setExternalDeliveries(externalDeliveryResponse.data.data)
        setExternalDeliveryMeta(externalDeliveryResponse.data.meta)
      }
      setAuditMeta(auditResponse.data.meta)
      setNotifications(notificationResponse.data.data)
      setNotificationUnread(notificationResponse.data.meta.unread ?? 0)
      setDashboardSummary({ ...emptySummary, ...summaryResponse.data, siteKpis: summaryResponse.data.siteKpis ?? [] })
    } catch (currentError) {
      setError(readApiError(currentError))
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin() {
    setLoading(true)
    setError('')
    try {
      const response = await api.post('/auth/login', login)
      if (response.data.mfaRequired) {
        setMfaToken(response.data.mfaToken)
        setMfa({ code: '' })
        return
      }
      saveSession(response.data.accessToken, response.data.user, response.data.refreshToken)
      setToken(response.data.accessToken)
      setUser(response.data.user)
    } catch (currentError) {
      setError(readApiError(currentError))
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyMfa() {
    setLoading(true)
    setError('')
    try {
      const response = await api.post('/auth/verify-mfa', { mfaToken, code: mfa.code })
      saveSession(response.data.accessToken, response.data.user, response.data.refreshToken)
      setToken(response.data.accessToken)
      setUser(response.data.user)
      setMfaToken('')
      setMfa({ code: '' })
    } catch (currentError) {
      setError(readApiError(currentError))
    } finally {
      setLoading(false)
    }
  }

  // --- SSO OIDC ----------------------------------------------------------------
  // El callback del backend regresa a "https://<web>/{redirect}#access_token=...".
  // El fragmento se consume en el primer render (consumeSsoFragment), antes de que
  // el efecto de routing reescriba el hash con la vista activa.
  useEffect(() => {
    if (ssoFragment.token && ssoFragment.user) {
      saveSession(ssoFragment.token, ssoFragment.user, ssoFragment.refreshToken)
      setToken(ssoFragment.token)
      setUser(ssoFragment.user)
    } else if (ssoFragment.error) {
      setError('El ingreso con SSO fallo. Intenta de nuevo o usa tus credenciales.')
    }
  }, [ssoFragment])

  async function handleSsoOptionsOpen() {
    setSsoOptionsOpen(true)
    try {
      const response = await api.get('/sso/login-options')
      setSsoOptions(response.data)
    } catch {
      setSsoOptions([])
    }
  }

  function handleSsoCompanySelected(option: { companyId: string; protocol: string }) {
    setSsoOptionsOpen(false)
    // SAML: el backend responde con la URL del binding redirect del IdP; el
    // endpoint y el flujo (RelayState) cambian segun protocolo.
    const endpoint = option.protocol === 'SAML'
      ? `/auth/sso/saml/${option.companyId}/authorize`
      : '/auth/sso/authorize'
    void api
      .get(endpoint, { params: { companyId: option.companyId, redirect: '/' } })
      .then((response: { data: { authorizationUrl: string } }) => {
        window.location.href = response.data.authorizationUrl
      })
      .catch(() => setError('No fue posible iniciar el ingreso SSO'))
  }

  async function openSsoConfig(company: Company) {
    setSsoConfigCompany(company)
    setSsoConfigOpen(true)
    setSsoConfigValues(emptySsoConfig)
    setSsoProviderId('')
    try {
      const response = await api.get('/sso/providers', { params: { companyId: company.id } })
      setSsoConfigured(Boolean(response.data.configured))
      setSsoProviderId(response.data.id ?? '')
      if (response.data.configured) {
        setSsoConfigValues({
          protocol: response.data.protocol ?? 'OIDC',
          issuer: response.data.issuer ?? '',
          clientId: response.data.clientId ?? '',
          clientSecret: '',
          authorizationEndpoint: response.data.authorizationEndpoint ?? '',
          tokenEndpoint: response.data.tokenEndpoint ?? '',
          jwksUri: response.data.jwksUri ?? '',
          userinfoEndpoint: response.data.userinfoEndpoint ?? '',
          scopes: response.data.scopes ?? 'openid email profile',
          idpEntityId: response.data.idpEntityId ?? '',
          idpSsoUrl: response.data.idpSsoUrl ?? '',
          idpCertificate: response.data.idpCertificate ?? '',
          spEntityId: response.data.spEntityId ?? '',
          defaultRole: response.data.defaultRole ?? 'EMPLOYEE',
          // El backend guarda el mapeo como JSON; se muestra formateado.
          roleGroups: response.data.roleGroups
            ? JSON.stringify(response.data.roleGroups, null, 2)
            : '',
          isActive: response.data.isActive ?? true,
        })
      }
    } catch {
      setSsoConfigured(false)
    }
  }

  async function saveSsoConfig() {
    if (!ssoConfigCompany) return
    // Mapeo grupo->rol: se valida el JSON antes de enviar (feedback inmediato);
    // vacio = sin overrides (null limpia el mapeo en el backend).
    let roleGroups: Record<string, string> | null = null
    if (ssoConfigValues.roleGroups.trim()) {
      try {
        roleGroups = JSON.parse(ssoConfigValues.roleGroups) as Record<string, string>
      } catch {
        setError('El mapeo de roles por grupo no es JSON valido.')
        return
      }
    }
    // Los campos vacios van como undefined (el DTO los trata como opcionales).
    const isSaml = ssoConfigValues.protocol === 'SAML'
    // Los campos vacios van como undefined (el DTO los trata como opcionales);
    // solo se envian los campos del protocolo elegido.
    const payload = {
      protocol: ssoConfigValues.protocol,
      // OIDC
      issuer: isSaml ? undefined : ssoConfigValues.issuer,
      clientId: isSaml ? undefined : ssoConfigValues.clientId,
      clientSecret: isSaml ? undefined : ssoConfigValues.clientSecret || undefined,
      authorizationEndpoint: isSaml ? undefined : ssoConfigValues.authorizationEndpoint,
      tokenEndpoint: isSaml ? undefined : ssoConfigValues.tokenEndpoint,
      jwksUri: isSaml ? undefined : ssoConfigValues.jwksUri || undefined,
      userinfoEndpoint: isSaml ? undefined : ssoConfigValues.userinfoEndpoint || undefined,
      scopes: isSaml ? undefined : ssoConfigValues.scopes || undefined,
      // SAML
      idpEntityId: isSaml ? ssoConfigValues.idpEntityId || undefined : undefined,
      idpSsoUrl: isSaml ? ssoConfigValues.idpSsoUrl : undefined,
      idpCertificate: isSaml ? ssoConfigValues.idpCertificate : undefined,
      spEntityId: isSaml ? ssoConfigValues.spEntityId || undefined : undefined,
      defaultRole: ssoConfigValues.defaultRole,
      roleGroups,
      isActive: ssoConfigValues.isActive,
    }
    await saveRecord(() =>
      ssoConfigured && ssoProviderId
        ? api.patch(`/sso/providers/${ssoProviderId}`, payload).then()
        : api.post('/sso/providers', { companyId: ssoConfigCompany.id, ...payload }).then(),
    )
    setSsoConfigOpen(false)
  }

  async function handleBootstrap() {
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/bootstrap-admin', { ...bootstrap, role: 'ADMIN' })
      setBootstrapOpen(false)
      setLogin({ email: bootstrap.email, password: bootstrap.password })
    } catch (currentError) {
      setError(readApiError(currentError))
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    void api.post('/auth/logout').catch(() => undefined)
    clearSession()
    setToken('')
    setUser(null)
    setMfaToken('')
    resetWorkspace()
  }

  async function setupMfa() {
    setLoading(true)
    setError('')
    try {
      const response = await api.post('/auth/mfa/setup')
      setMfaSetup({ secret: response.data.secret, otpauthUrl: response.data.otpauthUrl, code: '' })
    } catch (currentError) {
      setError(readApiError(currentError))
    } finally {
      setLoading(false)
    }
  }

  async function enableMfa() {
    await saveRecord(async () => {
      await api.post('/auth/mfa/enable', { code: mfaSetup.code })
      setUser((current) => (current ? { ...current, mfaEnabled: true } : current))
      setMfaSettingsOpen(false)
      setMfaSetup({ secret: '', otpauthUrl: '', code: '' })
    })
  }

  async function disableMfa() {
    await saveRecord(async () => {
      await api.post('/auth/mfa/disable', { code: mfaSetup.code })
      setUser((current) => (current ? { ...current, mfaEnabled: false } : current))
      setMfaSettingsOpen(false)
      setMfaSetup({ secret: '', otpauthUrl: '', code: '' })
    })
  }

  async function changePassword() {
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      setPasswordDialogOpen(false)
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      logout()
      setError('Contrasena actualizada. Inicia sesion nuevamente.')
    } catch (currentError) {
      setError(readApiError(currentError))
    } finally {
      setLoading(false)
    }
  }

  function resetWorkspace() {
    setCompanies([])
    setSites([])
    setEmployees([])
    setIncidents([])
    setRisks([])
    setTrainings([])
    setDocuments([])
    setSgsstAudits([])
    setAnnualWorkPlans([])
    setPlannedInspections([])
    setUnplannedInspections([])
    setUnsafeReports([])
    setPpeItems([])
    setPpeDeliveries([])
    setMedicalProfiles([])
    setMedicalExams([])
    setMedicalRestrictions([])
    setReportExports([])
    setReportMetrics(emptyReportMetrics)
    setReportMetricHistory([])
    setUsers([])
    setNotifications([])
    setNotificationUnread(0)
    setAuditLogs([])
    setExternalDeliveries([])
    setExternalDeliveryMeta(emptyMeta)
    setDashboardSummary(emptySummary)
    setView('dashboard')
  }

  function openCompanyForm(item?: Company) {
    setCompanyForm(
      item
        ? {
            name: item.name,
            nit: item.nit,
            arl: item.arl ?? '',
            riskClass: item.riskClass,
            economicActivity: item.economicActivity ?? '',
            city: item.city ?? '',
            department: item.department ?? '',
            address: item.address ?? '',
            phone: item.phone ?? '',
            email: item.email ?? '',
            reportExportExpirationDays: item.reportExportExpirationDays?.toString() ?? '',
            reportExportRetentionDays: item.reportExportRetentionDays?.toString() ?? '',
            reportFailureRateAlertPercent: item.reportFailureRateAlertPercent?.toString() ?? '',
            reportStorageAlertBytes: item.reportStorageAlertBytes?.toString() ?? '',
            whatsappAlertsEnabled: item.whatsappAlertsEnabled,
            whatsappAlertPhone: item.whatsappAlertPhone ?? '',
          }
        : emptyCompany,
    )
    setCompanyDialog({ open: true, item })
    preloadCompanyDialog()
  }

  // --- Panel de desarrollador -------------------------------------------------

  async function loadDeveloperPanel() {
    setLoading(true)
    setError('')
    try {
      const [overview, modules, queues, audit, diagnostics, errors] = await Promise.all([
        api.get<DeveloperOverview>('/developer/overview'),
        api.get<DeveloperModules>('/developer/modules'),
        api.get<DeveloperQueues>('/developer/queues'),
        api.get<{ data: DeveloperAuditEntry[] }>('/developer/audit'),
        api.get<DeveloperDiagnostics>('/developer/diagnostics'),
        api.get<DeveloperErrors>('/developer/errors'),
      ])
      setDeveloperPanel({
        overview: overview.data,
        modules: modules.data,
        queues: queues.data,
        audit: Array.isArray(audit.data?.data) ? audit.data.data : [],
        diagnostics: diagnostics.data,
        errors: errors.data,
      })
    } catch (currentError) {
      setError(readApiError(currentError))
    } finally {
      setLoading(false)
    }
  }

  // --- Contratistas (S11) -----------------------------------------------------

  function openContractorForm(item?: Contractor) {
    setContractorForm(
      item
        ? {
            name: item.name,
            nit: item.nit,
            contact: item.contact ?? '',
            phone: item.phone ?? '',
            arl: item.arl ?? '',
            activity: item.activity ?? '',
            status: item.status,
            companyId: item.companyId,
          }
        : { ...emptyContractor, companyId: activeCompanyId ?? companies[0]?.id ?? '' },
    )
    setContractorDialog({ open: true, item })
    preloadContractorDialogs()
  }

  async function saveContractor() {
    await saveRecord(async () => {
      const payload = sanitize(contractorForm) as Record<string, unknown>
      if (contractorDialog.item) {
        await api.patch(`/contractors/${contractorDialog.item.id}`, payload)
      } else {
        await api.post('/contractors', payload)
      }
      setContractorDialog({ open: false })
    })
  }

  function confirmDeleteContractor(contractor: Contractor) {
    openConfirmDialog(
      'Eliminar contratista',
      `¿Seguro que deseas eliminar el contratista ${contractor.name}? Se eliminan tambien su personal y documentos.`,
      'Eliminar',
      'error',
      () => { void removeContractor(contractor.id) },
    )
  }

  async function removeContractor(id: string) {
    await saveRecord(() => api.delete(`/contractors/${id}`).then())
  }

  /** Abre el detalle y carga personal + documentos del contratista. */
  async function openContractorDetail(item: Contractor) {
    setContractorDetail(item)
    setContractorWorkers([])
    setContractorDocuments([])
    try {
      const [workersResponse, documentsResponse] = await Promise.all([
        api.get<ContractorWorker[]>(`/contractors/${item.id}/workers`),
        api.get<ContractorDocument[]>(`/contractors/${item.id}/documents`),
      ])
      setContractorWorkers(Array.isArray(workersResponse.data) ? workersResponse.data : [])
      setContractorDocuments(Array.isArray(documentsResponse.data) ? documentsResponse.data : [])
    } catch (currentError) {
      setError(readApiError(currentError))
      setContractorDetail(null)
    }
  }

  /** Consulta la autorizacion de ingreso: la decision viene del backend. */
  async function openEntryAuthorization(item: Contractor) {
    setContractorEntryAuth(null)
    setContractorEntryAuthLoading(true)
    try {
      const response = await api.get<ContractorEntryAuthorization>(`/contractors/${item.id}/entry-authorization`)
      setContractorEntryAuth(response.data)
    } catch (currentError) {
      setError(readApiError(currentError))
    } finally {
      setContractorEntryAuthLoading(false)
    }
  }

  function openContractorWorkerForm(item?: ContractorWorker) {
    if (!contractorDetail) return
    setContractorWorkerForm(
      item
        ? {
            document: item.document,
            firstName: item.firstName,
            lastName: item.lastName,
            job: item.job ?? '',
            inductedAt: item.inductedAt?.slice(0, 10) ?? '',
            status: item.status,
            companyId: item.companyId,
          }
        : { ...emptyContractorWorker, companyId: contractorDetail.companyId },
    )
    setContractorWorkerDialog({ open: true, item })
  }

  async function saveContractorWorker() {
    if (!contractorDetail) return
    await saveRecord(async () => {
      const payload = sanitize(contractorWorkerForm) as Record<string, unknown>
      if (contractorWorkerDialog.item) {
        await api.patch(`/contractors/${contractorDetail.id}/workers/${contractorWorkerDialog.item.id}`, payload)
      } else {
        await api.post(`/contractors/${contractorDetail.id}/workers`, payload)
      }
      setContractorWorkerDialog({ open: false })
      await openContractorDetail(contractorDetail)
    })
  }

  function confirmDeleteContractorWorker(worker: ContractorWorker) {
    openConfirmDialog(
      'Eliminar personal',
      `¿Seguro que deseas eliminar a ${worker.firstName} ${worker.lastName}?`,
      'Eliminar',
      'error',
      () => { void removeContractorWorker(worker.id) },
    )
  }

  async function removeContractorWorker(id: string) {
    if (!contractorDetail) return
    await saveRecord(async () => {
      await api.delete(`/contractors/${contractorDetail.id}/workers/${id}`)
      await openContractorDetail(contractorDetail)
    })
  }

  function openContractorDocumentForm(item?: ContractorDocument) {
    if (!contractorDetail) return
    setContractorDocumentForm(
      item
        ? {
            documentType: item.documentType,
            description: item.description ?? '',
            expiresAt: item.expiresAt?.slice(0, 10) ?? '',
            status: item.status,
            evidenceId: item.evidenceId ?? '',
            companyId: item.companyId,
          }
        : { ...emptyContractorDocument, companyId: contractorDetail.companyId },
    )
    setContractorDocumentDialog({ open: true, item })
  }

  async function saveContractorDocument() {
    if (!contractorDetail) return
    await saveRecord(async () => {
      const payload = sanitize(contractorDocumentForm) as Record<string, unknown>
      if (contractorDocumentDialog.item) {
        await api.patch(`/contractors/${contractorDetail.id}/documents/${contractorDocumentDialog.item.id}`, payload)
      } else {
        await api.post(`/contractors/${contractorDetail.id}/documents`, payload)
      }
      setContractorDocumentDialog({ open: false })
      await openContractorDetail(contractorDetail)
    })
  }

  function confirmDeleteContractorDocument(document: ContractorDocument) {
    openConfirmDialog(
      'Eliminar documento',
      `¿Seguro que deseas eliminar el documento ${document.documentType}?`,
      'Eliminar',
      'error',
      () => { void removeContractorDocument(document.id) },
    )
  }

  async function removeContractorDocument(id: string) {
    if (!contractorDetail) return
    await saveRecord(async () => {
      await api.delete(`/contractors/${contractorDetail.id}/documents/${id}`)
      await openContractorDetail(contractorDetail)
    })
  }

  function openSiteForm(item?: Site) {
    setSiteForm(
      item
        ? {
            name: item.name,
            code: item.code ?? '',
            address: item.address ?? '',
            city: item.city ?? '',
            department: item.department ?? '',
            isMain: item.isMain,
            companyId: item.companyId,
          }
        : { ...emptySite, companyId: activeCompanyId ?? companies[0]?.id ?? '' },
    )
    setSiteDialog({ open: true, item })
    preloadSiteDialog()
  }

  function openEmployeeForm(item?: Employee) {
    setEmployeeForm(
      item
        ? {
            firstName: item.firstName,
            lastName: item.lastName,
            documentType: item.documentType,
            document: item.document,
            position: item.position,
            workCenter: item.workCenter ?? '',
            contractType: item.contractType,
            employmentStatus: item.employmentStatus,
            hireDate: item.hireDate?.slice(0, 10) ?? '',
            email: item.email ?? '',
            phone: item.phone ?? '',
            companyId: item.companyId,
            siteId: item.siteId ?? '',
          }
        : { ...emptyEmployee, companyId: activeCompanyId ?? companies[0]?.id ?? '' },
    )
    setEmployeeDialog({ open: true, item })
    preloadEmployeeDialog()
  }

  function openIncidentForm(item?: Incident) {
    setIncidentForm(
      item
        ? {
            title: item.title,
            description: item.description,
            date: item.date.slice(0, 10),
            status: item.status,
            companyId: item.companyId,
            siteId: item.siteId ?? '',
          }
        : { ...emptyIncident, companyId: activeCompanyId ?? companies[0]?.id ?? '' },
    )
    setIncidentDialog({ open: true, item })
    preloadIncidentDialog()
  }

  function openRiskForm(item?: Risk) {
    setRiskForm(
      item
        ? {
            title: item.title,
            description: item.description ?? '',
            level: item.level,
            companyId: item.companyId,
            siteId: item.siteId ?? '',
          }
        : { ...emptyRisk, companyId: activeCompanyId ?? companies[0]?.id ?? '' },
    )
    setRiskDialog({ open: true, item })
    preloadRiskDialog()
  }

  function openTrainingForm(item?: Training) {
    setTrainingForm(
      item
        ? {
            title: item.title,
            description: item.description ?? '',
            date: item.date.slice(0, 10),
            companyId: item.companyId,
            siteId: item.siteId ?? '',
          }
        : { ...emptyTraining, companyId: activeCompanyId ?? companies[0]?.id ?? '' },
    )
    setTrainingDialog({ open: true, item })
    preloadTrainingDialog()
  }

  function openUserForm(item?: SystemUser) {
    setUserForm(
      item
        ? {
            name: item.name,
            email: item.email,
            password: '',
            role: item.role,
            companyId: item.companyId ?? '',
          }
        : { ...emptyUser, companyId: companies[0]?.id ?? '' },
    )
    setUserDialog({ open: true, item })
    preloadUserDialog()
  }

  function openDocumentForm(item?: SgsstDocument) {
    setDocumentForm(
      item
        ? {
            name: item.name,
            description: item.description ?? '',
            category: item.category,
            status: item.status,
            fileUrl: item.fileUrl,
            fileName: item.fileName ?? '',
            mimeType: item.mimeType ?? '',
            expiresAt: item.expiresAt?.slice(0, 10) ?? '',
            companyId: item.companyId,
            siteId: item.siteId ?? '',
          }
        : { ...emptyDocument, companyId: activeCompanyId ?? companies[0]?.id ?? '' },
    )
    setDocumentDialog({ open: true, item })
    preloadDocumentDialog()
  }

  function openSgsstAuditForm(item?: SgsstAudit) {
    setSgsstAuditForm(
      item
        ? {
            title: item.title,
            description: item.description ?? '',
            status: item.status,
            scope: item.scope ?? '',
            auditorName: item.auditorName ?? '',
            scheduledAt: item.scheduledAt.slice(0, 10),
            result: item.result ?? '',
            companyId: item.companyId,
          }
        : { ...emptySgsstAudit, companyId: activeCompanyId ?? companies[0]?.id ?? '' },
    )
    setSgsstAuditDialog({ open: true, item })
    preloadSgsstAuditDialog()
  }

  async function saveCompany() {
    await saveRecord(async () => {
      if (companyDialog.item) {
        await api.patch(`/companies/${companyDialog.item.id}`, normalizeCompanyForm())
      } else {
        await api.post('/companies', normalizeCompanyForm())
      }
      setCompanyDialog({ open: false })
    })
  }

  async function saveSite() {
    await saveRecord(async () => {
      if (siteDialog.item) {
        await api.patch(`/sites/${siteDialog.item.id}`, sanitize(siteForm))
      } else {
        await api.post('/sites', sanitize(siteForm))
      }
      setSiteDialog({ open: false })
    })
  }

  function confirmDeleteSite(site: Site) {
    openConfirmDialog(
      'Eliminar sede',
      `¿Seguro que deseas eliminar la sede ${site.name}? Esta acción no se puede deshacer.`,
      'Eliminar',
      'error',
      () => { void removeSite(site.id) },
    )
  }

  async function removeSite(id: string) {
    await saveRecord(() => api.delete(`/sites/${id}`).then())
  }

  function normalizeCompanyForm() {
    const payload = sanitize(companyForm) as Record<string, unknown>
    ;[
      'reportExportExpirationDays',
      'reportExportRetentionDays',
      'reportFailureRateAlertPercent',
      'reportStorageAlertBytes',
    ].forEach((field) => {
      const value = companyForm[field as keyof typeof companyForm]
      payload[field] = value ? Number(value) : null
    })
    payload.whatsappAlertsEnabled = companyForm.whatsappAlertsEnabled
    payload.whatsappAlertPhone = companyForm.whatsappAlertPhone.trim() || null
    return payload
  }

  const duplicateEmployeeDocument =
    employeeForm.document.trim().length > 0 &&
    employees.some(
      (employee) =>
        employee.document.trim().toLowerCase() === employeeForm.document.trim().toLowerCase() &&
        employee.id !== employeeDialog.item?.id,
    )

  const employeeDocumentError = duplicateEmployeeDocument ? 'Este documento ya está registrado para otro empleado.' : ''

  async function saveEmployee() {
    if (employeeDocumentError) {
      setError(employeeDocumentError)
      return
    }

    await saveRecord(async () => {
      // siteId '' = sin sede; el backend interpreta null como desasignacion.
      const payload = sanitize(employeeForm) as Record<string, unknown>
      if (employeeDialog.item && !employeeForm.siteId) {
        const current = employees.find((item) => item.id === employeeDialog.item?.id)
        if (current?.siteId) {
          payload.siteId = null
        }
      }
      if (employeeDialog.item) {
        await api.patch(`/employees/${employeeDialog.item.id}`, payload)
      } else {
        await api.post('/employees', payload)
      }
      setEmployeeDialog({ open: false })
    })
  }

  async function saveIncident() {
    await saveRecord(async () => {
      // siteId '' = sin sede; el backend interpreta null como desasignacion.
      const payload = sanitize(incidentForm) as Record<string, unknown>
      if (incidentDialog.item && !incidentForm.siteId) {
        const current = incidents.find((item) => item.id === incidentDialog.item?.id)
        if (current?.siteId) {
          payload.siteId = null
        }
      }
      if (incidentDialog.item) {
        await api.patch(`/incidents/${incidentDialog.item.id}`, payload)
      } else {
        // El estado inicial lo fija el backend (PENDING); no se envia en creacion.
        const { status: _status, ...createPayload } = payload
        await api.post('/incidents', createPayload)
      }
      setIncidentDialog({ open: false })
    })
  }

  async function saveRisk() {
    await saveRecord(async () => {
      // siteId '' = sin sede; el backend interpreta null como desasignacion.
      const payload = sanitize(riskForm) as Record<string, unknown>
      if (riskDialog.item && !riskForm.siteId) {
        const current = risks.find((item) => item.id === riskDialog.item?.id)
        if (current?.siteId) {
          payload.siteId = null
        }
      }
      if (riskDialog.item) {
        await api.patch(`/risks/${riskDialog.item.id}`, payload)
      } else {
        await api.post('/risks', payload)
      }
      setRiskDialog({ open: false })
    })
  }

  async function saveTraining() {
    await saveRecord(async () => {
      // siteId '' = sin sede; el backend interpreta null como desasignacion.
      const payload = sanitize(trainingForm) as Record<string, unknown>
      if (trainingDialog.item && !trainingForm.siteId) {
        const current = trainings.find((item) => item.id === trainingDialog.item?.id)
        if (current?.siteId) {
          payload.siteId = null
        }
      }
      if (trainingDialog.item) {
        await api.patch(`/trainings/${trainingDialog.item.id}`, payload)
      } else {
        await api.post('/trainings', payload)
      }
      setTrainingDialog({ open: false })
    })
  }

  async function saveUser() {
    await saveRecord(async () => {
      const payload = sanitize(userForm)
      if (userDialog.item) {
        const { password: _password, ...updatePayload } = payload
        await api.patch(`/users/${userDialog.item.id}`, updatePayload)
      } else {
        await api.post('/users', payload)
      }
      setUserDialog({ open: false })
    })
  }

  async function saveDocument() {
    await saveRecord(async () => {
      // siteId '' = sin sede; el backend interpreta null como desasignacion.
      const payload = sanitize(documentForm) as Record<string, unknown>
      if (documentDialog.item && !documentForm.siteId) {
        const current = documents.find((item) => item.id === documentDialog.item?.id)
        if (current?.siteId) {
          payload.siteId = null
        }
      }
      if (documentDialog.item) {
        await api.patch(`/documents/${documentDialog.item.id}`, payload)
      } else {
        await api.post('/documents', payload)
      }
      setDocumentDialog({ open: false })
    })
  }

  async function saveSgsstAudit() {
    await saveRecord(async () => {
      if (sgsstAuditDialog.item) {
        await api.patch(`/sgsst-audits/${sgsstAuditDialog.item.id}`, sanitize(sgsstAuditForm))
      } else {
        await api.post('/sgsst-audits', sanitize(sgsstAuditForm))
      }
      setSgsstAuditDialog({ open: false })
    })
  }

  async function uploadDocumentFile(file: File) {
    setLoading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await api.post('/documents/upload', formData)
      setDocumentForm((current) => ({
        ...current,
        fileUrl: response.data.fileUrl,
        fileName: response.data.fileName,
        mimeType: response.data.mimeType,
      }))
    } catch (currentError) {
      setError(readApiError(currentError))
    } finally {
      setLoading(false)
    }
  }

  async function saveRecord(action: () => Promise<void>) {
    setLoading(true)
    setError('')
    try {
      await action()
      await loadData(true)
    } catch (currentError) {
      setError(readApiError(currentError))
    } finally {
      setLoading(false)
    }
  }

  function openConfirmDialog(
    title: string,
    message: string,
    confirmLabel = 'Aceptar',
    confirmColor: 'error' | 'success' | 'primary' = 'primary',
    onConfirm: () => void | Promise<void> = () => {},
  ) {
    setConfirmDialog({ open: true, title, message, confirmLabel, confirmColor, onConfirm })
  }

  async function handleConfirmDialog() {
    const action = confirmDialog.onConfirm
    setConfirmDialog((current) => ({ ...current, open: false }))
    await action()
  }

  function confirmDeleteCompany(company: Company) {
    openConfirmDialog(
      'Eliminar empresa',
      `¿Seguro que deseas eliminar la empresa ${company.name}? Esta acción no se puede deshacer.`,
      'Eliminar',
      'error',
      () => { void removeCompany(company.id) },
    )
  }

  async function removeCompany(id: string) {
    await saveRecord(() => api.delete(`/companies/${id}`).then())
  }

  function confirmRestoreCompany(company: Company) {
    openConfirmDialog(
      'Restaurar empresa',
      `¿Seguro que deseas restaurar la empresa ${company.name}?`,
      'Restaurar',
      'success',
      () => { void restoreCompany(company.id) },
    )
  }

  function confirmHardDeleteCompany(company: Company) {
    openConfirmDialog(
      'Eliminar empresa permanentemente',
      `¿Seguro que deseas eliminar permanentemente la empresa ${company.name}? Esta acción no se puede deshacer.`,
      'Eliminar',
      'error',
      () => { void hardRemoveCompany(company.id) },
    )
  }

  async function restoreCompany(id: string) {
    await saveRecord(() => api.patch(`/companies/${id}`, { isActive: true }).then())
  }

  async function hardRemoveCompany(id: string) {
    await saveRecord(() => api.delete(`/companies/${id}/permanent`).then())
  }

  function confirmDeleteEmployee(employee: Employee) {
    openConfirmDialog(
      'Eliminar empleado',
      `¿Seguro que deseas eliminar a ${employee.firstName} ${employee.lastName}? Esta acción no se puede deshacer.`,
      'Eliminar',
      'error',
      () => { void removeEmployee(employee.id) },
    )
  }

  async function removeEmployee(id: string) {
    await saveRecord(() => api.delete(`/employees/${id}`).then())
  }

  function confirmDeleteIncident(incident: Incident) {
    openConfirmDialog(
      'Eliminar incidente',
      `¿Seguro que deseas eliminar el incidente ${incident.title}? Esta acción no se puede deshacer.`,
      'Eliminar',
      'error',
      () => { void removeIncident(incident.id) },
    )
  }

  async function removeIncident(id: string) {
    await saveRecord(() => api.delete(`/incidents/${id}`).then())
  }

  function confirmDeleteRisk(risk: Risk) {
    openConfirmDialog(
      'Eliminar riesgo',
      `¿Seguro que deseas eliminar el riesgo ${risk.title}? Esta acción no se puede deshacer.`,
      'Eliminar',
      'error',
      () => { void removeRisk(risk.id) },
    )
  }

  async function removeRisk(id: string) {
    await saveRecord(() => api.delete(`/risks/${id}`).then())
  }

  function confirmDeleteTraining(training: Training) {
    openConfirmDialog(
      'Eliminar capacitacion',
      `¿Seguro que deseas eliminar la capacitacion ${training.title}? Esta acción no se puede deshacer.`,
      'Eliminar',
      'error',
      () => { void removeTraining(training.id) },
    )
  }

  async function removeTraining(id: string) {
    await saveRecord(() => api.delete(`/trainings/${id}`).then())
  }

  function confirmRestoreEmployee(employee: Employee) {
    openConfirmDialog(
      'Restaurar empleado',
      `¿Seguro que deseas restaurar a ${employee.firstName} ${employee.lastName}?`,
      'Restaurar',
      'success',
      () => { void restoreEmployee(employee.id) },
    )
  }

  async function restoreEmployee(id: string) {
    await saveRecord(() => api.patch(`/employees/${id}`, { isActive: true }).then())
  }

  function confirmDeleteDocument(documentItem: SgsstDocument) {
    openConfirmDialog(
      'Eliminar documento',
      `¿Seguro que deseas eliminar el documento ${documentItem.name}? Esta acción no se puede deshacer.`,
      'Eliminar',
      'error',
      () => { void removeDocument(documentItem.id) },
    )
  }

  async function removeDocument(id: string) {
    await saveRecord(() => api.delete(`/documents/${id}`).then())
  }

  function openSgsstEvaluationForm(item?: SgsstEvaluation) {
    setSgsstEvaluationForm(
      item
        ? {
            name: item.name,
            riskClass: item.riskClass,
            period: item.period ?? '',
            notes: item.notes ?? '',
            companyId: item.companyId,
          }
        : { ...emptySgsstEvaluation, companyId: activeCompanyId ?? companies[0]?.id ?? '' },
    )
    setSgsstEvaluationDialog({ open: true, item })
    preloadSgsstEvaluationDialog()
  }

  async function saveAnnualWorkPlan() {
    await saveRecord(async () => {
      const payload = {
        year: Number(annualWorkPlanForm.year),
        status: annualWorkPlanForm.status,
        notes: annualWorkPlanForm.notes || undefined,
        companyId: annualWorkPlanForm.companyId,
      }
      if (annualWorkPlanDialog.item) {
        await api.patch(`/annual-work-plans/${annualWorkPlanDialog.item.id}`, payload)
        setAnnualWorkPlanDialog({ open: false })
      } else {
        const created = await api.post<AnnualWorkPlan>('/annual-work-plans', payload)
        // El dialogo queda abierto sobre el plan creado para agregar actividades.
        setAnnualWorkPlanForm({
          year: String(created.data.year),
          status: created.data.status,
          notes: created.data.notes ?? '',
          companyId: created.data.companyId,
        })
        setAnnualWorkPlanDialog({ open: true, item: { ...created.data, activities: [] } })
      }
    })
  }

  async function saveSgsstEvaluation() {
    await saveRecord(async () => {
      if (sgsstEvaluationDialog.item) {
        await api.patch(`/sgsst-evaluations/${sgsstEvaluationDialog.item.id}`, sanitize(sgsstEvaluationForm))
        setSgsstEvaluationDialog({ open: false })
      } else {
        const created = await api.post<SgsstEvaluation>('/sgsst-evaluations', sanitize(sgsstEvaluationForm))
        setSgsstEvaluationForm({
          name: created.data.name,
          riskClass: created.data.riskClass,
          period: created.data.period ?? '',
          notes: created.data.notes ?? '',
          companyId: created.data.companyId,
        })
        // El dialogo queda abierto sobre la evaluacion creada para responder items.
        setSgsstEvaluationDialog({ open: true, item: created.data })
      }
    })
  }

  async function updateEvaluationItem(itemId: string, payload: { status: EvaluationItemStatus; notes?: string }) {
    await saveRecord(async () => {
      // La respuesta trae la evaluacion recalculada (score/compliancePercent).
      const updated = await api.patch<SgsstEvaluation>(`/sgsst-evaluations/items/${itemId}`, payload)
      setSgsstEvaluationDialog({ open: true, item: updated.data })
    })
  }

  async function addEvaluationItem(evaluationId: string, payload: { numeral?: string; section?: string; question: string; maxScore?: number }) {
    await saveRecord(async () => {
      // addItems devuelve la evaluacion completa con los items creados.
      const updated = await api.post<SgsstEvaluation>(`/sgsst-evaluations/${evaluationId}/items`, { items: [payload] })
      setSgsstEvaluationDialog({ open: true, item: updated.data })
    })
  }

  function openAnnualWorkPlanForm(item?: AnnualWorkPlan) {
    setAnnualWorkPlanForm(
      item
        ? {
            year: String(item.year),
            status: item.status,
            notes: item.notes ?? '',
            companyId: item.companyId,
          }
        : { ...emptyAnnualWorkPlan, companyId: activeCompanyId ?? companies[0]?.id ?? '' },
    )
    setAnnualWorkPlanDialog({ open: true, item })
    preloadAnnualWorkPlanDialog()
  }

  async function loadAnnualPlanActivities(planId: string) {
    // Refresca el item del dialogo con actividades + % de avance del plan.
    try {
      const response = await api.get<{ data: AnnualWorkPlan['activities']; planProgress: number | null }>(
        `/annual-work-plans/${planId}/activities`,
      )
      setAnnualWorkPlanDialog((current) =>
        current.item && current.item.id === planId
          ? {
              ...current,
              item: {
                ...current.item,
                activities: response.data.data,
                planProgress: response.data.planProgress ?? undefined,
              },
            }
          : current,
      )
    } catch (currentError) {
      setError(readApiError(currentError))
    }
  }

  async function addAnnualPlanActivity(planId: string, values: AnnualActivityFormValues) {
    await saveRecord(async () => {
      await api.post(`/annual-work-plans/${planId}/activities`, {
        cycle: values.cycle,
        name: values.name,
        frequency: values.frequency || undefined,
        dueDate: values.dueDate || undefined,
        progress: values.progress === '' ? undefined : Number(values.progress),
        status: values.status,
        budget: values.budget === '' ? undefined : Number(values.budget),
        ownerId: values.ownerId || undefined,
        evidenceId: values.evidenceId || undefined,
        planId,
      })
      await loadAnnualPlanActivities(planId)
    })
  }

  async function updateAnnualPlanActivity(planId: string, activityId: string, payload: Partial<AnnualActivityFormValues>) {
    await saveRecord(async () => {
      await api.patch(`/annual-work-plans/${planId}/activities/${activityId}`, {
        ...(payload.progress !== undefined ? { progress: payload.progress === '' ? undefined : Number(payload.progress) } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(payload.evidenceId !== undefined ? { evidenceId: payload.evidenceId || null } : {}),
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.dueDate !== undefined ? { dueDate: payload.dueDate || null } : {}),
        ...(payload.ownerId !== undefined ? { ownerId: payload.ownerId || null } : {}),
      })
      await loadAnnualPlanActivities(planId)
    })
  }

  function confirmDeleteAnnualWorkPlan(plan: AnnualWorkPlan) {
    openConfirmDialog(
      'Eliminar plan anual',
      `¿Seguro que deseas eliminar el plan anual ${plan.year}? Esta acción no se puede deshacer.`,
      'Eliminar',
      'error',
      () => { void removeAnnualWorkPlan(plan.id) },
    )
  }

  async function removeAnnualWorkPlan(id: string) {
    await saveRecord(() => api.delete(`/annual-work-plans/${id}`).then())
  }

  function confirmDeleteAnnualPlanActivity(planId: string, activityId: string) {
    openConfirmDialog(
      'Eliminar actividad',
      '¿Seguro que deseas eliminar esta actividad del plan? Esta acción no se puede deshacer.',
      'Eliminar',
      'error',
      () => { void removeAnnualPlanActivity(planId, activityId) },
    )
  }

  async function removeAnnualPlanActivity(planId: string, activityId: string) {
    await saveRecord(async () => {
      await api.delete(`/annual-work-plans/${planId}/activities/${activityId}`)
      await loadAnnualPlanActivities(planId)
    })
  }

  function openPlannedInspectionForm(item?: PlannedInspection) {
    setPlannedInspectionForm(
      item
        ? {
            title: item.title,
            type: item.type,
            frequency: item.frequency ?? '',
            scheduledAt: item.scheduledAt.slice(0, 10),
            status: item.status,
            siteId: item.siteId ?? '',
            inspectorId: item.inspectorId ?? '',
            companyId: item.companyId,
          }
        : { ...emptyPlannedInspection, companyId: activeCompanyId ?? companies[0]?.id ?? '' },
    )
    setPlannedInspectionDialog({ open: true, item })
    preloadPlannedInspectionDialog()
  }

  async function loadPlannedInspection(inspectionId: string) {
    // Refresca el item del dialogo con items/hallazgos/acciones actualizados.
    try {
      const response = await api.get<PlannedInspection>(`/planned-inspections/${inspectionId}`)
      setPlannedInspectionDialog((current) =>
        current.item && current.item.id === inspectionId
          ? { ...current, item: response.data }
          : current,
      )
    } catch (currentError) {
      setError(readApiError(currentError))
    }
  }

  async function savePlannedInspection() {
    await saveRecord(async () => {
      const payload = {
        title: plannedInspectionForm.title,
        type: plannedInspectionForm.type,
        frequency: plannedInspectionForm.frequency || undefined,
        scheduledAt: plannedInspectionForm.scheduledAt,
        status: plannedInspectionForm.status,
        siteId: plannedInspectionForm.siteId || undefined,
        inspectorId: plannedInspectionForm.inspectorId || undefined,
        companyId: plannedInspectionForm.companyId,
      }
      if (plannedInspectionDialog.item) {
        await api.patch(`/planned-inspections/${plannedInspectionDialog.item.id}`, payload)
        setPlannedInspectionDialog({ open: false })
      } else {
        const created = await api.post<PlannedInspection>('/planned-inspections', payload)
        // El dialogo queda abierto para responder el checklist.
        setPlannedInspectionForm({
          title: created.data.title,
          type: created.data.type,
          frequency: created.data.frequency ?? '',
          scheduledAt: created.data.scheduledAt.slice(0, 10),
          status: created.data.status,
          siteId: created.data.siteId ?? '',
          inspectorId: created.data.inspectorId ?? '',
          companyId: created.data.companyId,
        })
        setPlannedInspectionDialog({ open: true, item: created.data })
      }
    })
  }

  function confirmDeletePlannedInspection(inspection: PlannedInspection) {
    openConfirmDialog(
      'Eliminar inspeccion',
      `¿Seguro que deseas eliminar la inspeccion ${inspection.title}? Esta acción no se puede deshacer.`,
      'Eliminar',
      'error',
      () => { void removePlannedInspection(inspection.id) },
    )
  }

  async function removePlannedInspection(id: string) {
    await saveRecord(() => api.delete(`/planned-inspections/${id}`).then())
  }

  async function updatePlannedInspectionItem(inspectionId: string, itemId: string, payload: { answer: string; notes?: string }) {
    await saveRecord(async () => {
      await api.patch(`/planned-inspections/items/${itemId}?inspectionId=${inspectionId}`, payload)
      await loadPlannedInspection(inspectionId)
    })
  }

  async function addPlannedInspectionItem(inspectionId: string, question: string) {
    // Los items se agregan via PATCH de la inspeccion con items adicionales
    // no aplica: el API soporta crear items en el POST inicial; para agregar
    // post-creacion se usa el endpoint de respuesta por item con creacion.
    await saveRecord(async () => {
      // El API espera el array `questions` (creacion en lote).
      await api.post(`/planned-inspections/${inspectionId}/items`, { questions: [question] })
      await loadPlannedInspection(inspectionId)
    })
  }

  async function addPlannedInspectionFinding(inspectionId: string, description: string, severity: string) {
    await saveRecord(async () => {
      await api.post(`/planned-inspections/${inspectionId}/findings`, { description, severity })
      await loadPlannedInspection(inspectionId)
    })
  }

  async function addPlannedInspectionAction(findingId: string) {
    const title = window.prompt('Titulo de la accion correctiva')
    if (!title) return
    const responsible = window.prompt('Responsable') || 'Responsable SST'
    const dueDate = window.prompt('Fecha compromiso (YYYY-MM-DD)') || new Date().toISOString().slice(0, 10)
    await saveRecord(async () => {
      await api.post(`/planned-inspections/findings/${findingId}/actions`, { title, responsible, dueDate })
    })
  }

  function openUnplannedInspectionForm(item?: UnplannedInspection) {
    setUnplannedInspectionForm(
      item
        ? {
            title: item.title,
            reason: item.reason,
            area: item.area ?? '',
            status: item.status,
            siteId: item.siteId ?? '',
            inspectorId: item.inspectorId ?? '',
            companyId: item.companyId,
          }
        : { ...emptyUnplannedInspection, companyId: activeCompanyId ?? companies[0]?.id ?? '' },
    )
    setUnplannedInspectionDialog({ open: true, item })
    preloadUnplannedInspectionDialog()
  }

  async function saveUnplannedInspection() {
    await saveRecord(async () => {
      const payload = {
        title: unplannedInspectionForm.title,
        reason: unplannedInspectionForm.reason,
        area: unplannedInspectionForm.area || undefined,
        status: unplannedInspectionForm.status,
        siteId: unplannedInspectionForm.siteId || undefined,
        inspectorId: unplannedInspectionForm.inspectorId || undefined,
        companyId: unplannedInspectionForm.companyId,
      }
      if (unplannedInspectionDialog.item) {
        await api.patch(`/unplanned-inspections/${unplannedInspectionDialog.item.id}`, payload)
      } else {
        await api.post('/unplanned-inspections', payload)
      }
      setUnplannedInspectionDialog({ open: false })
    })
  }

  function confirmDeleteUnplannedInspection(inspection: UnplannedInspection) {
    openConfirmDialog(
      'Eliminar inspeccion',
      `¿Seguro que deseas eliminar la inspeccion ${inspection.title}? Esta acción no se puede deshacer.`,
      'Eliminar',
      'error',
      () => { void removeUnplannedInspection(inspection.id) },
    )
  }

  async function removeUnplannedInspection(id: string) {
    await saveRecord(() => api.delete(`/unplanned-inspections/${id}`).then())
  }

  async function addUnplannedInspectionFinding(inspectionId: string, description: string, severity: string, riskLevel?: string) {
    await saveRecord(() =>
      api.post(`/unplanned-inspections/${inspectionId}/findings`, {
        description,
        severity,
        ...(riskLevel ? { riskLevel } : {}),
      }).then(),
    )
  }

  async function addUnplannedInspectionAction(findingId: string) {
    const title = window.prompt('Titulo de la accion correctiva')
    if (!title) return
    const responsible = window.prompt('Responsable') || 'Responsable SST'
    const dueDate = window.prompt('Fecha compromiso (YYYY-MM-DD)') || new Date().toISOString().slice(0, 10)
    await saveRecord(() => api.post(`/unplanned-inspections/findings/${findingId}/actions`, { title, responsible, dueDate }).then())
  }

  function openUnsafeReportForm(item?: UnsafeReport) {
    setUnsafeReportForm(
      item
        ? {
            kind: item.kind,
            description: item.description,
            severity: item.severity,
            area: item.area ?? '',
            isAnonymous: item.isAnonymous,
            reporterName: item.reporterName ?? '',
            siteId: item.siteId ?? '',
            companyId: item.companyId,
          }
        : { ...emptyUnsafeReport, companyId: activeCompanyId ?? companies[0]?.id ?? '' },
    )
    setUnsafeReportDialog({ open: true, item })
    preloadUnsafeReportDialog()
  }

  async function saveUnsafeReport() {
    await saveRecord(async () => {
      const payload = {
        kind: unsafeReportForm.kind,
        description: unsafeReportForm.description,
        severity: unsafeReportForm.severity,
        area: unsafeReportForm.area || undefined,
        siteId: unsafeReportForm.siteId || undefined,
        isAnonymous: unsafeReportForm.isAnonymous,
        reporterName: unsafeReportForm.reporterName || undefined,
        companyId: unsafeReportForm.companyId,
      }
      if (unsafeReportDialog.item) {
        // El update no reenvia datos de anonimato (decididos al crear).
        await api.patch(`/unsafe-reports/${unsafeReportDialog.item.id}`, {
          kind: payload.kind,
          description: payload.description,
          severity: payload.severity,
          area: payload.area,
          siteId: payload.siteId,
        })
      } else {
        await api.post('/unsafe-reports', payload)
      }
      setUnsafeReportDialog({ open: false })
    })
  }

  function confirmDeleteUnsafeReport(report: UnsafeReport) {
    openConfirmDialog(
      'Eliminar reporte',
      `¿Seguro que deseas eliminar este reporte? Esta acción no se puede deshacer.`,
      'Eliminar',
      'error',
      () => { void removeUnsafeReport(report.id) },
    )
  }

  async function removeUnsafeReport(id: string) {
    await saveRecord(() => api.delete(`/unsafe-reports/${id}`).then())
  }

  async function addUnsafeReportAction(findingId: string) {
    const title = window.prompt('Titulo de la accion correctiva/educativa')
    if (!title) return
    const responsible = window.prompt('Responsable') || 'Responsable SST'
    const dueDate = window.prompt('Fecha compromiso (YYYY-MM-DD)') || new Date().toISOString().slice(0, 10)
    await saveRecord(() => api.post(`/unsafe-reports/findings/${findingId}/actions`, { title, responsible, dueDate }).then())
  }

  function openPpeItemForm(item?: PpeItem) {
    setPpeItemForm(
      item
        ? {
            name: item.name,
            type: item.type ?? '',
            standard: item.standard ?? '',
            size: item.size ?? '',
            usefulLifeDays: item.usefulLifeDays?.toString() ?? '',
            stockMin: item.stockMin.toString(),
            stock: item.stock.toString(),
            companyId: item.companyId,
          }
        : { ...emptyPpeItem, companyId: activeCompanyId ?? companies[0]?.id ?? '' },
    )
    setPpeItemDialog({ open: true, item })
    preloadPpeDialogs()
  }

  async function savePpeItem() {
    await saveRecord(async () => {
      const payload = {
        name: ppeItemForm.name,
        type: ppeItemForm.type || undefined,
        standard: ppeItemForm.standard || undefined,
        size: ppeItemForm.size || undefined,
        usefulLifeDays: ppeItemForm.usefulLifeDays === '' ? undefined : Number(ppeItemForm.usefulLifeDays),
        stockMin: ppeItemForm.stockMin === '' ? undefined : Number(ppeItemForm.stockMin),
        stock: ppeItemForm.stock === '' ? undefined : Number(ppeItemForm.stock),
        companyId: ppeItemForm.companyId,
      }
      if (ppeItemDialog.item) {
        await api.patch(`/ppe/items/${ppeItemDialog.item.id}`, payload)
      } else {
        await api.post('/ppe/items', payload)
      }
      setPpeItemDialog({ open: false })
    })
  }

  function confirmDeletePpeItem(item: PpeItem) {
    openConfirmDialog(
      'Eliminar elemento EPP',
      `¿Seguro que deseas eliminar ${item.name} del catalogo? Esta acción no se puede deshacer.`,
      'Eliminar',
      'error',
      () => { void removePpeItem(item.id) },
    )
  }

  async function removePpeItem(id: string) {
    await saveRecord(() => api.delete(`/ppe/items/${id}`).then())
  }

  function openPpeDeliveryForm() {
    setPpeDeliveryForm({ ...emptyPpeDelivery, companyId: activeCompanyId ?? companies[0]?.id ?? '' })
    setPpeDeliveryDialogOpen(true)
    preloadPpeDialogs()
  }

  async function savePpeDelivery() {
    await saveRecord(async () => {
      const response = await api.post<PpeDelivery>('/ppe/deliveries', {
        itemId: ppeDeliveryForm.itemId,
        employeeId: ppeDeliveryForm.employeeId,
        quantity: ppeDeliveryForm.quantity === '' ? undefined : Number(ppeDeliveryForm.quantity),
        signature: ppeDeliveryForm.signature || undefined,
        notes: ppeDeliveryForm.notes || undefined,
        companyId: ppeDeliveryForm.companyId,
      })
      if (response.data.stockBelowMin) {
        setError(`Atencion: el stock quedo por debajo del minimo (${response.data.itemStock} unidades).`)
      }
      setPpeDeliveryDialogOpen(false)
    })
  }

  // ---- Medicina laboral (S10) ----

  function openMedicalProfileForm() {
    setMedicalProfileForm({ ...emptyMedicalProfile, companyId: activeCompanyId ?? companies[0]?.id ?? '' })
    setMedicalProfileDialog(true)
  }

  async function saveMedicalProfile() {
    await saveRecord(async () => {
      const created = await api.post<MedicalProfile>('/medical/profiles', {
        position: medicalProfileForm.position,
        description: medicalProfileForm.description || undefined,
        companyId: medicalProfileForm.companyId,
        requirements: [{ examType: medicalProfileForm.examType }],
      })
      if (medicalProfileForm.examType !== 'INGRESO') {
        // Ademas del requisito del profesiograma, programa el primer examen.
        await api.post('/medical/exams', {
          examType: medicalProfileForm.examType,
          employeeId: '',
          scheduledAt: null,
          profileId: created.data.id,
        }).catch(() => undefined)
      }
      setMedicalProfileDialog(false)
    })
  }

  function openMedicalExamForm(exam?: MedicalExam) {
    setMedicalExamForm(
      exam
        ? {
            examType: exam.examType,
            employeeId: exam.employeeId ?? '',
            scheduledAt: exam.scheduledAt ? exam.scheduledAt.slice(0, 10) : '',
            performedAt: exam.performedAt ? exam.performedAt.slice(0, 10) : '',
            nextDueAt: exam.nextDueAt ? exam.nextDueAt.slice(0, 10) : '',
            concept: exam.concept,
            provider: exam.provider ?? '',
          }
        : { ...emptyMedicalExam },
    )
    setMedicalExamDialog({ open: true, exam })
  }

  async function saveMedicalExam() {
    await saveRecord(async () => {
      const payload = {
        examType: medicalExamForm.examType,
        employeeId: medicalExamForm.employeeId,
        scheduledAt: medicalExamForm.scheduledAt || undefined,
        concept: medicalExamForm.concept,
        provider: medicalExamForm.provider || undefined,
      }
      if (medicalExamDialog.exam) {
        // Registrar resultado: concepto ocupacional, fechas de realizacion y proxima.
        await api.patch(`/medical/exams/${medicalExamDialog.exam.id}`, {
          concept: medicalExamForm.concept,
          performedAt: medicalExamForm.performedAt || null,
          nextDueAt: medicalExamForm.nextDueAt || null,
        })
      } else {
        await api.post('/medical/exams', payload)
      }
      setMedicalExamDialog({ open: false })
    })
  }

  async function removeMedicalExam(id: string) {
    await saveRecord(() => api.delete(`/medical/exams/${id}`))
  }

  function openMedicalRestrictionForm() {
    setMedicalRestrictionForm({ ...emptyMedicalRestriction })
    setMedicalRestrictionDialog(true)
  }

  async function saveMedicalRestriction() {
    await saveRecord(async () => {
      await api.post('/medical/restrictions', {
        description: medicalRestrictionForm.description,
        employeeId: medicalRestrictionForm.employeeId,
        startDate: medicalRestrictionForm.startDate || undefined,
        endDate: medicalRestrictionForm.endDate || undefined,
      })
      setMedicalRestrictionDialog(false)
    })
  }

  async function liftMedicalRestriction(id: string) {
    await saveRecord(() => api.patch(`/medical/restrictions/${id}/lift`))
  }

  // --- Derivacion #25.2 y vigilancia S10.4 --------------------------------

  async function deriveMedicalRequirements(profileId: string) {
    try {
      const response = await api.post<{
        profileId: string
        position: string
        worstRiskLevel: string
        created: { examType: string; periodicityMonths: number }[]
      }>(`/medical/profiles/${profileId}/derive-requirements`, {
        companyId: isPlatformAdmin ? undefined : activeCompanyId,
      })
      await loadData()
      return { worstRiskLevel: response.data.worstRiskLevel, created: response.data.created }
    } catch {
      return null
    }
  }

  function openSurveillanceProgramForm() {
    setSurveillanceProgramForm({
      ...emptyMedicalSurveillanceProgram,
      companyId: activeCompanyId ?? companies[0]?.id ?? '',
    })
    setSurveillanceProgramDialog(true)
  }

  async function saveSurveillanceProgram() {
    await saveRecord(async () => {
      await api.post('/medical/surveillance-programs', {
        name: surveillanceProgramForm.name,
        riskType: surveillanceProgramForm.riskType,
        objective: surveillanceProgramForm.objective || undefined,
        companyId: surveillanceProgramForm.companyId,
      })
      setSurveillanceProgramDialog(false)
    })
  }

  async function deriveSurveillanceCohort(programId: string, riskId: string) {
    try {
      const response = await api.post<{
        cohortId: string
        workersCount: number
        reviewed: boolean
      }>(`/medical/surveillance-programs/${programId}/cohorts/derive`, {
        riskId,
        companyId: isPlatformAdmin ? undefined : activeCompanyId,
      })
      await loadData()
      return { workersCount: response.data.workersCount, reviewed: response.data.reviewed }
    } catch {
      return null
    }
  }

  async function reviewSurveillanceCohort(cohortId: string) {
    await saveRecord(() => api.patch(`/medical/surveillance-cohorts/${cohortId}`, { status: 'CLOSED' }))
  }

  async function exportSurveillanceReport(format: 'pdf' | 'csv') {
    await downloadReport('surveillance', format, isPlatformAdmin ? undefined : activeCompanyId)
  }

  function confirmDeleteMedicalExam(exam: MedicalExam) {
    openConfirmDialog(
      'Eliminar examen',
      `¿Seguro que deseas eliminar el examen ${exam.examType} del ${exam.scheduledAt ? new Date(exam.scheduledAt).toLocaleDateString() : 'sin fecha'}? Esta acción no se puede deshacer.`,
      'Eliminar',
      'error',
      () => { void removeMedicalExam(exam.id) },
    )
  }

  function openIndicatorForm(item?: Indicator) {
    setIndicatorForm(
      item
        ? {
            name: item.name,
            code: item.code ?? '',
            description: item.description ?? '',
            unit: item.unit ?? '',
            formulaDefinition: item.formulaDefinition ?? '',
            direction: item.direction,
            siteId: item.siteId ?? '',
            companyId: item.companyId,
          }
        : { ...emptyIndicator, companyId: activeCompanyId ?? companies[0]?.id ?? '' },
    )
    setIndicatorDialog({ open: true, item })
  }

  async function saveIndicator() {
    await saveRecord(async () => {
      if (indicatorDialog.item) {
        await api.patch(`/indicators/${indicatorDialog.item.id}`, sanitize(indicatorForm))
        setIndicatorDialog({ open: false })
      } else {
        const created = await api.post<Indicator>('/indicators', sanitize(indicatorForm))
        setIndicatorForm({
          name: created.data.name,
          code: created.data.code ?? '',
          description: created.data.description ?? '',
          unit: created.data.unit ?? '',
          formulaDefinition: created.data.formulaDefinition ?? '',
          direction: created.data.direction,
          siteId: created.data.siteId ?? '',
          companyId: created.data.companyId,
        })
        // El dialogo queda abierto sobre el indicador creado para registrar metas y mediciones.
        setIndicatorDialog({ open: true, item: created.data })
      }
    })
  }

  async function setIndicatorTargets(indicatorId: string, targets: { period: string; target: number }[]) {
    await saveRecord(async () => {
      await api.put(`/indicators/${indicatorId}/targets`, { targets })
    })
  }

  async function addIndicatorMeasurement(indicatorId: string, payload: { measurements: { period: string; value: number; notes?: string }[] }) {
    await saveRecord(async () => {
      // addMeasurements devuelve el indicador con el value vigente recalculado.
      const updated = await api.post<Indicator>(`/indicators/${indicatorId}/measurements`, payload)
      setIndicatorDialog({ open: true, item: updated.data })
    })
  }

  function confirmDeleteIndicator(indicator: Indicator) {
    openConfirmDialog(
      'Eliminar indicador',
      `¿Seguro que deseas eliminar el indicador ${indicator.name || indicator.id}? Esta acción no se puede deshacer.`,
      'Eliminar',
      'error',
      () => { void removeIndicator(indicator.id) },
    )
  }

  async function removeIndicator(id: string) {
    await saveRecord(() => api.delete(`/indicators/${id}`).then())
  }

  function confirmDeleteSgsstEvaluation(evaluation: SgsstEvaluation) {
    openConfirmDialog(
      'Eliminar evaluación',
      `¿Seguro que deseas eliminar la evaluación ${evaluation.name || evaluation.id}? Esta acción no se puede deshacer.`,
      'Eliminar',
      'error',
      () => { void removeSgsstEvaluation(evaluation.id) },
    )
  }

  async function removeSgsstEvaluation(id: string) {
    await saveRecord(() => api.delete(`/sgsst-evaluations/${id}`).then())
  }

  async function retryDelivery(id: string) {
    await saveRecord(() => api.post(`/notifications/external-deliveries/${id}/retry`).then())
  }

  function confirmDeleteSgsstAudit(audit: SgsstAudit) {
    openConfirmDialog(
      'Eliminar auditoría',
      `¿Seguro que deseas eliminar la auditoría ${audit.title || audit.id}? Esta acción no se puede deshacer.`,
      'Eliminar',
      'error',
      () => { void removeSgsstAudit(audit.id) },
    )
  }

  async function removeSgsstAudit(id: string) {
    await saveRecord(() => api.delete(`/sgsst-audits/${id}`).then())
  }

  async function addFinding(auditId: string) {
    const title = window.prompt('Titulo del hallazgo')
    if (!title) return
    await saveRecord(() => api.post(`/sgsst-audits/${auditId}/findings`, { title, severity: 'MINOR' }).then())
  }

  async function addAction(findingId: string) {
    const title = window.prompt('Titulo de la accion correctiva')
    if (!title) return
    const responsible = window.prompt('Responsable') || 'Responsable SST'
    const dueDate = window.prompt('Fecha compromiso (YYYY-MM-DD)') || new Date().toISOString().slice(0, 10)
    await saveRecord(() => api.post(`/sgsst-audits/findings/${findingId}/actions`, { title, responsible, dueDate }).then())
  }

  function confirmCloseSgsstAudit(audit: SgsstAudit) {
    openConfirmDialog(
      'Cerrar auditoría',
      `¿Seguro que deseas cerrar la auditoría ${audit.title || audit.id}?`,
      'Cerrar',
      'success',
      () => { void closeSgsstAudit(audit) },
    )
  }

  async function closeSgsstAudit(item: SgsstAudit) {
    await saveRecord(() => api.patch(`/sgsst-audits/${item.id}`, { status: 'CLOSED', closedAt: new Date().toISOString() }).then())
  }

  function confirmDeleteUser(userItem: SystemUser) {
    openConfirmDialog(
      'Eliminar usuario',
      `¿Seguro que deseas eliminar al usuario ${userItem.name}? Esta acción no se puede deshacer.`,
      'Eliminar',
      'error',
      () => { void removeUser(userItem.id) },
    )
  }

  async function removeUser(id: string) {
    await saveRecord(() => api.delete(`/users/${id}`).then())
  }

  function confirmRestoreUser(userItem: SystemUser) {
    openConfirmDialog(
      'Restaurar usuario',
      `¿Seguro que deseas restaurar al usuario ${userItem.name}?`,
      'Restaurar',
      'success',
      () => { void restoreUser(userItem.id) },
    )
  }

  async function restoreUser(id: string) {
    await saveRecord(() => api.patch(`/users/${id}`, { isActive: true }).then())
  }

  async function markNotificationRead(id: string) {
    await saveRecord(() => api.patch(`/notifications/${id}/read`).then())
  }

  async function markAllNotificationsRead() {
    await saveRecord(() => api.patch('/notifications/read-all').then())
  }

  async function generateNotifications() {
    await saveRecord(() => api.post('/notifications/generate-due-alerts').then())
  }

  async function handleDownloadReport(kind: ReportKind, format: ReportFormat) {
    setLoading(true)
    setError('')
    try {
      await downloadReport(kind, format, isPlatformAdmin ? undefined : activeCompanyId)
    } catch (currentError) {
      setError(readApiError(currentError))
    } finally {
      setLoading(false)
    }
  }

  async function handleDownloadDocument(documentItem: SgsstDocument) {
    setLoading(true)
    setError('')
    try {
      await downloadDocument(documentItem.id, documentItem.fileName ?? documentItem.name)
    } catch (currentError) {
      setError(readApiError(currentError))
    } finally {
      setLoading(false)
    }
  }

  async function handleScheduleReport(kind: ReportKind, format: ReportFormat) {
    setLoading(true)
    setError('')
    try {
      await scheduleReport(kind, format, isPlatformAdmin ? undefined : activeCompanyId)
      await loadData(true)
    } catch (currentError) {
      setError(readApiError(currentError))
    } finally {
      setLoading(false)
    }
  }

  async function retryReportExport(id: string) {
    await saveRecord(() => api.post(`/reports/exports/${id}/retry`).then())
  }

  async function handleDownloadReportExport(reportExport: ReportExport) {
    setLoading(true)
    setError('')
    try {
      await downloadReportExport(reportExport.id, reportExport.fileName ?? 'reporte')
    } catch (currentError) {
      setError(readApiError(currentError))
    } finally {
      setLoading(false)
    }
  }

  async function handleSwitchCompany(companyId: string | null) {
    setLoading(true)
    setError('')
    try {
      const response = await api.post('/auth/active-company', { companyId })
      saveSession(response.data.accessToken, response.data.user, response.data.refreshToken)
      setToken(response.data.accessToken)
      setUser(response.data.user)
      await loadData(true)
    } catch (currentError) {
      setError(readApiError(currentError))
    } finally {
      setLoading(false)
    }
  }

  function selectView(nextView: View) {
    // Defensa en profundidad: el backend es la autoridad, aqui solo evitamos
    // navegaciones que producirian 403 para roles sin permisos.
    // Nota: 'contractors' SI esta permitido para EMPLOYEE (lectura, igual que el backend).
    const employeeBlocked: View[] = ['aiAssistant', 'companies', 'documents', 'sgsstAudits', 'sgsstEvaluations', 'indicators', 'legalCompliance', 'annualWorkPlans', 'ppe', 'medical', 'reports', 'users', 'externalDeliveries', 'audit', 'sites', 'developer']
    if (isEmployee && employeeBlocked.includes(nextView)) {
      return
    }
    setView(nextView)
    setMobileOpen(false)
  }

  // KPI de sede clickeable: abre Empleados con el filtro de esa sede aplicado.
  // Helper: aplica (o limpia) el filtro de sede de la vista indicada.
  function applySiteFilter(
    target: 'employees' | 'incidents' | 'risks' | 'trainings' | 'documents' | 'plannedInspections',
    siteId: string,
  ) {
    const pageSetter =
      target === 'employees'
        ? setEmployeeTable
        : target === 'incidents'
          ? setIncidentTable
          : target === 'risks'
            ? setRiskTable
            : target === 'trainings'
              ? setTrainingTable
              : target === 'plannedInspections'
                ? setPlannedInspectionTable
                : setDocumentTable
    const filterSetter =
      target === 'employees'
        ? setEmployeeSiteFilter
        : target === 'incidents'
          ? setIncidentSiteFilter
          : target === 'risks'
            ? setRiskSiteFilter
            : target === 'trainings'
              ? setTrainingSiteFilter
              : target === 'plannedInspections'
                ? setPlannedInspectionSiteFilter
                : setDocumentSiteFilter
    pageSetter((current) => ({ ...current, page: 1 }))
    filterSetter(siteId)
  }

  // KPI de sede clickeable: abre la vista destino con el filtro de esa sede.
  function openSiteView(
    target: 'employees' | 'incidents' | 'risks' | 'trainings' | 'documents' | 'plannedInspections',
    siteId: string,
  ) {
    if (!siteId) return
    applySiteFilter(target, siteId)
    setView(target)
    setMobileOpen(false)
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog((current) => ({ ...current, open: false }))}>
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{confirmDialog.message}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog((current) => ({ ...current, open: false }))}>Cancelar</Button>
          <Button color={confirmDialog.confirmColor} variant="contained" onClick={() => { void handleConfirmDialog() }}>
            {confirmDialog.confirmLabel}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Opciones de SSO: fuera del condicional de sesion para que sea accesible desde LoginPage. */}
      <Dialog open={ssoOptionsOpen} onClose={() => setSsoOptionsOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Ingresar con SSO</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1}>
            {ssoOptions.length === 0 && (
              <Typography color="text.secondary">No hay empresas con SSO configurado.</Typography>
            )}
            {ssoOptions.map((option) => (
              <Button
                key={option.companyId}
                variant="outlined"
                onClick={() => handleSsoCompanySelected(option)}
              >
                {option.companyName}
              </Button>
            ))}
          </Stack>
        </DialogContent>
      </Dialog>
      {!user || !token ? (
        <LoginPage
          login={login}
          mfa={mfa}
          mfaRequired={Boolean(mfaToken)}
          bootstrap={bootstrap}
          bootstrapOpen={bootstrapOpen}
          error={error}
          loading={loading}
          onLoginChange={setLogin}
          onMfaChange={setMfa}
          onBootstrapChange={setBootstrap}
          onBootstrapOpen={() => setBootstrapOpen(true)}
          onBootstrapClose={() => setBootstrapOpen(false)}
          onLogin={handleLogin}
          onVerifyMfa={handleVerifyMfa}
          onBootstrap={handleBootstrap}
          onSsoLogin={handleSsoOptionsOpen}
        />
      ) : (
        <AppLayout
          user={user}
          companies={companies}
          activeCompanyId={activeCompanyId}
          view={view}
          selectedTitle={selectedTitle}
          mobileOpen={mobileOpen}
          loading={loading}
          error={error}
          canViewUsers={canViewUsers}
          canViewContractors={canViewContractors}
          canViewSites={canViewSites}
          canViewDocuments={canViewDocuments}
          canViewAnnualPlans={canViewAnnualPlans}
          canViewInspections={canViewAnnualPlans || isEmployee}
          canViewUnsafeReports={canViewUnsafeReports}
          canViewMedical={canViewMedical}
          canViewReports={canViewReports}
          canViewAudit={canViewAudit}
          isDeveloper={isDeveloper}
          canUseAssistant={canUseAssistant}
          canRetryDeliveries={canRetryDeliveries}
          canGenerateNotifications={canManageDocuments}
          notifications={notifications}
          notificationUnread={notificationUnread}
          onMobileOpen={() => setMobileOpen(true)}
          onMobileClose={() => setMobileOpen(false)}
          onSelectView={selectView}
          onPreloadView={preloadView}
          onRefresh={() => loadData(true)}
          onSwitchCompany={handleSwitchCompany}
          onMarkNotificationRead={markNotificationRead}
          onMarkAllNotificationsRead={markAllNotificationsRead}
          onGenerateNotifications={generateNotifications}
          onChangePassword={() => setPasswordDialogOpen(true)}
          onMfaSettings={() => {
            setMfaSettingsOpen(true)
            if (!mfaSetup.secret) void setupMfa()
          }}
          onLogout={logout}
        >
          <ViewErrorBoundary>
          <Suspense fallback={null}>
            {view === 'dashboard' && (
              <DashboardPage
                stats={stats}
                companies={companies}
                employees={employees}
                // El desglose por sede es del alcance de empresa: SUPER_ADMIN (global) no lo ve.
                siteKpis={isPlatformAdmin ? [] : dashboardSummary.siteKpis ?? []}
                compliance={dashboardSummary.compliance}
                onOpenSite={(siteId) => openSiteView('employees', siteId)}
                onOpenSiteIncidents={(siteId) => openSiteView('incidents', siteId)}
                onOpenSiteRisks={(siteId) => openSiteView('risks', siteId)}
                onOpenSiteTrainings={(siteId) => openSiteView('trainings', siteId)}
                onOpenSiteDocuments={(siteId) => openSiteView('documents', siteId)}
                onOpenSiteInspections={(siteId) => {
                  // El KPI de inspecciones abre la vista de planeadas filtrada.
                  applySiteFilter('plannedInspections', siteId)
                  setView('plannedInspections')
                  setMobileOpen(false)
                }}
                activeCompanyName={companies.find((company) => company.id === activeCompanyId)?.name}
                canExport={canExportReports}
                onDownloadReport={(format) => handleDownloadReport('summary', format)}
                onScheduleReport={(format) => handleScheduleReport('summary', format)}
              />
            )}
            {view === 'companies' && (
              <CompaniesPage
                companies={companies}
                meta={companyMeta}
                tableState={companyTable}
                canManage={canManageCompanies}
                onTableChange={setCompanyTable}
                onCreate={() => openCompanyForm()}
                onPreloadCreate={preloadCompanyDialog}
                onEdit={openCompanyForm}
                onConfigureSso={openSsoConfig}
                onDelete={(id) => {
                  const company = companies.find((item) => item.id === id)
                  if (company) {
                    confirmDeleteCompany(company)
                  }
                }}
                onRestore={(id) => {
                  const company = companies.find((item) => item.id === id)
                  if (company) {
                    confirmRestoreCompany(company)
                  }
                }}
                onDeletePermanent={(id) => {
                  const company = companies.find((item) => item.id === id)
                  if (company) {
                    confirmHardDeleteCompany(company)
                  }
                }}
                activeCompanyName={companies.find((company) => company.id === activeCompanyId)?.name}
              />
            )}
            {view === 'contractors' && (
              <ContractorsPage
                contractors={contractors}
                meta={contractorMeta}
                tableState={contractorTable}
                canManage={canManageContractors}
                canViewEntryAuth={canViewEntryAuth}
                onTableChange={setContractorTable}
                onCreate={() => openContractorForm()}
                onPreloadCreate={preloadContractorDialogs}
                onEdit={openContractorForm}
                onDelete={confirmDeleteContractor}
                onOpenEntryAuth={openEntryAuthorization}
                entryAuth={contractorEntryAuth}
                entryAuthLoading={contractorEntryAuthLoading}
                onCloseEntryAuth={() => setContractorEntryAuth(null)}
                activeCompanyName={companies.find((company) => company.id === activeCompanyId)?.name}
              />
            )}
            {view === 'sites' && (
              <SitesPage
                sites={sites}
                meta={siteMeta}
                tableState={siteTable}
                canManage={canManageSites}
                onTableChange={setSiteTable}
                onCreate={() => openSiteForm()}
                onPreloadCreate={preloadSiteDialog}
                onEdit={openSiteForm}
                onDelete={(id) => {
                  const site = sites.find((item) => item.id === id)
                  if (site) {
                    confirmDeleteSite(site)
                  }
                }}
                activeCompanyName={companies.find((company) => company.id === activeCompanyId)?.name}
              />
            )}
            {view === 'employees' && (
              <EmployeesPage
                employees={employees}
                meta={employeeMeta}
                tableState={employeeTable}
                canManage={canManageEmployees}
                canDelete={canDeleteEmployees}
                canExport={canExportReports}
                sites={sites}
                siteFilter={employeeSiteFilter}
                onSiteFilterChange={(siteId) => applySiteFilter('employees', siteId)}
                onTableChange={setEmployeeTable}
                onCreate={() => openEmployeeForm()}
                onPreloadCreate={preloadEmployeeDialog}
                onEdit={openEmployeeForm}
                onDelete={(id) => {
                  const employee = employees.find((item) => item.id === id)
                  if (employee) {
                    confirmDeleteEmployee(employee)
                  }
                }}
                onRestore={(id) => {
                  const employee = employees.find((item) => item.id === id)
                  if (employee) {
                    confirmRestoreEmployee(employee)
                  }
                }}
                onDownloadReport={(format) => handleDownloadReport('employees', format)}
                onScheduleReport={(format) => handleScheduleReport('employees', format)}
                activeCompanyName={companies.find((company) => company.id === activeCompanyId)?.name}
              />
            )}
            {view === 'incidents' && (
              <IncidentsPage
                incidents={incidents}
                meta={incidentMeta}
                tableState={incidentTable}
                canManage={canReportIncidents}
                canEdit={canManageOperations}
                sites={sites}
                siteFilter={incidentSiteFilter}
                onSiteFilterChange={(siteId) => applySiteFilter('incidents', siteId)}
                onTableChange={setIncidentTable}
                onCreate={() => openIncidentForm()}
                onPreloadCreate={preloadIncidentDialog}
                onEdit={openIncidentForm}
                onDelete={(id) => {
                  const incident = incidents.find((item) => item.id === id)
                  if (incident) {
                    confirmDeleteIncident(incident)
                  }
                }}
                activeCompanyName={companies.find((company) => company.id === activeCompanyId)?.name}
              />
            )}
            {view === 'risks' && (
              <RisksPage
                risks={risks}
                meta={riskMeta}
                tableState={riskTable}
                canManage={canManageOperations}
                sites={sites}
                siteFilter={riskSiteFilter}
                onSiteFilterChange={(siteId) => applySiteFilter('risks', siteId)}
                onTableChange={setRiskTable}
                onCreate={() => openRiskForm()}
                onPreloadCreate={preloadRiskDialog}
                onEdit={openRiskForm}
                onDelete={(id) => {
                  const risk = risks.find((item) => item.id === id)
                  if (risk) {
                    confirmDeleteRisk(risk)
                  }
                }}
                activeCompanyName={companies.find((company) => company.id === activeCompanyId)?.name}
              />
            )}
            {view === 'trainings' && (
              <TrainingsPage
                trainings={trainings}
                meta={trainingMeta}
                tableState={trainingTable}
                canManage={canManageOperations}
                sites={sites}
                siteFilter={trainingSiteFilter}
                onSiteFilterChange={(siteId) => applySiteFilter('trainings', siteId)}
                onTableChange={setTrainingTable}
                onCreate={() => openTrainingForm()}
                onPreloadCreate={preloadTrainingDialog}
                onEdit={openTrainingForm}
                onDelete={(id) => {
                  const training = trainings.find((item) => item.id === id)
                  if (training) {
                    confirmDeleteTraining(training)
                  }
                }}
                activeCompanyName={companies.find((company) => company.id === activeCompanyId)?.name}
              />
            )}
            {view === 'documents' && (
              <DocumentsPage
                documents={documents}
                meta={documentMeta}
                tableState={documentTable}
                canManage={canManageDocuments}
                canExport={canExportReports}
                sites={sites}
                siteFilter={documentSiteFilter}
                onSiteFilterChange={(siteId) => applySiteFilter('documents', siteId)}
                onTableChange={setDocumentTable}
                onCreate={() => openDocumentForm()}
                onPreloadCreate={preloadDocumentDialog}
                onEdit={openDocumentForm}
                onDelete={(id) => {
                  const documentItem = documents.find((item) => item.id === id)
                  if (documentItem) {
                    confirmDeleteDocument(documentItem)
                  }
                }}
                onDownload={handleDownloadDocument}
                onDownloadReport={(format) => handleDownloadReport('expired-documents', format)}
                onScheduleReport={(format) => handleScheduleReport('expired-documents', format)}
                activeCompanyName={companies.find((company) => company.id === activeCompanyId)?.name}
              />
            )}
            {view === 'sgsstAudits' && (
              <SgsstAuditsPage
                audits={sgsstAudits}
                meta={sgsstAuditMeta}
                tableState={sgsstAuditTable}
                canManage={canManageDocuments}
                canExport={canExportReports}
                onTableChange={setSgsstAuditTable}
                onCreate={() => openSgsstAuditForm()}
                onPreloadCreate={preloadSgsstAuditDialog}
                onEdit={openSgsstAuditForm}
                onDelete={(id) => {
                  const audit = sgsstAudits.find((item) => item.id === id)
                  if (audit) {
                    confirmDeleteSgsstAudit(audit)
                  }
                }}
                onAddFinding={addFinding}
                onAddAction={addAction}
                onCloseAudit={(item) => confirmCloseSgsstAudit(item)}
                onDownloadReport={(format) => handleDownloadReport('audits', format)}
                onScheduleReport={(format) => handleScheduleReport('audits', format)}
                activeCompanyName={companies.find((company) => company.id === activeCompanyId)?.name}
              />
            )}
            {view === 'sgsstEvaluations' && (
              <SgsstEvaluationsPage
                evaluations={sgsstEvaluations}
                meta={sgsstEvaluationMeta}
                tableState={sgsstEvaluationTable}
                canManage={canManageDocuments}
                onTableChange={setSgsstEvaluationTable}
                onCreate={() => openSgsstEvaluationForm()}
                onPreloadCreate={preloadSgsstEvaluationDialog}
                onEdit={openSgsstEvaluationForm}
                onDelete={(id) => {
                  const evaluation = sgsstEvaluations.find((item) => item.id === id)
                  if (evaluation) {
                    confirmDeleteSgsstEvaluation(evaluation)
                  }
                }}
                activeCompanyName={companies.find((company) => company.id === activeCompanyId)?.name}
              />
            )}
            {view === 'indicators' && (
              <IndicatorsPage
                indicators={indicators}
                meta={indicatorMeta}
                tableState={indicatorTable}
                canManage={canManageDocuments}
                onTableChange={setIndicatorTable}
                onCreate={() => openIndicatorForm()}
                onPreloadCreate={preloadIndicatorDialog}
                onEdit={openIndicatorForm}
                onDelete={(id) => {
                  const indicator = indicators.find((item) => item.id === id)
                  if (indicator) {
                    confirmDeleteIndicator(indicator)
                  }
                }}
                activeCompanyName={companies.find((company) => company.id === activeCompanyId)?.name}
              />
            )}
            {view === 'annualWorkPlans' && canViewAnnualPlans && (
              <AnnualWorkPlansPage
                plans={annualWorkPlans}
                meta={annualWorkPlanMeta}
                tableState={annualWorkPlanTable}
                canManage={canManageDocuments}
                onTableChange={setAnnualWorkPlanTable}
                onCreate={() => openAnnualWorkPlanForm()}
                onPreloadCreate={preloadAnnualWorkPlanDialog}
                onEdit={openAnnualWorkPlanForm}
                onDelete={(id) => {
                  const plan = annualWorkPlans.find((item) => item.id === id)
                  if (plan) {
                    confirmDeleteAnnualWorkPlan(plan)
                  }
                }}
                canExport={canExportReports}
                onDownloadReport={(format) => handleDownloadReport('annual-plan', format)}
                onScheduleReport={(format) => handleScheduleReport('annual-plan', format)}
                activeCompanyName={companies.find((company) => company.id === activeCompanyId)?.name}
              />
            )}
            {view === 'plannedInspections' && canViewAnnualPlans && (
              <PlannedInspectionsPage
                inspections={plannedInspections}
                meta={plannedInspectionMeta}
                tableState={plannedInspectionTable}
                canManage={canManageOperations}
                sites={sites}
                siteFilter={plannedInspectionSiteFilter}
                onSiteFilterChange={(siteId) => applySiteFilter('plannedInspections', siteId)}
                onTableChange={setPlannedInspectionTable}
                onCreate={() => openPlannedInspectionForm()}
                onPreloadCreate={preloadPlannedInspectionDialog}
                onEdit={openPlannedInspectionForm}
                onDelete={(id) => {
                  const inspection = plannedInspections.find((item) => item.id === id)
                  if (inspection) {
                    confirmDeletePlannedInspection(inspection)
                  }
                }}
                activeCompanyName={companies.find((company) => company.id === activeCompanyId)?.name}
              />
            )}
            {view === 'unplannedInspections' && canViewAnnualPlans && (
              <UnplannedInspectionsPage
                inspections={unplannedInspections}
                meta={unplannedInspectionMeta}
                tableState={unplannedInspectionTable}
                canManage={canManageOperations}
                onTableChange={setUnplannedInspectionTable}
                onCreate={() => openUnplannedInspectionForm()}
                onPreloadCreate={preloadUnplannedInspectionDialog}
                onEdit={openUnplannedInspectionForm}
                onDelete={(id) => {
                  const inspection = unplannedInspections.find((item) => item.id === id)
                  if (inspection) {
                    confirmDeleteUnplannedInspection(inspection)
                  }
                }}
                onAddFinding={addUnplannedInspectionFinding}
                onAddAction={addUnplannedInspectionAction}
                loading={loading}
                activeCompanyName={companies.find((company) => company.id === activeCompanyId)?.name}
              />
            )}
            {view === 'unsafeReports' && canViewUnsafeReports && (
              <UnsafeReportsPage
                reports={unsafeReports}
                meta={unsafeReportMeta}
                tableState={unplannedInspectionTable}
                canManage={canManageOperations}
                canReport={canReportUnsafe}
                onTableChange={setUnplannedInspectionTable}
                onCreate={() => openUnsafeReportForm()}
                onPreloadCreate={preloadUnsafeReportDialog}
                onEdit={openUnsafeReportForm}
                onDelete={(id) => {
                  const report = unsafeReports.find((item) => item.id === id)
                  if (report) {
                    confirmDeleteUnsafeReport(report)
                  }
                }}
                onAddAction={addUnsafeReportAction}
                loading={loading}
                activeCompanyName={companies.find((company) => company.id === activeCompanyId)?.name}
              />
            )}
            {view === 'ppe' && canViewAnnualPlans && (
              <PpePage
                items={ppeItems}
                deliveries={ppeDeliveries}
                itemMeta={ppeMeta}
                tableState={plannedInspectionTable}
                canManage={canManageOperations}
                employees={employees.map((employee) => ({
                  id: employee.id,
                  firstName: employee.firstName,
                  lastName: employee.lastName,
                  document: employee.document,
                }))}
                onTableChange={setPlannedInspectionTable}
                onCreateItem={() => openPpeItemForm()}
                onPreloadCreateItem={preloadPpeDialogs}
                onEditItem={openPpeItemForm}
                onDeleteItem={(id) => {
                  const item = ppeItems.find((entry) => entry.id === id)
                  if (item) {
                    confirmDeletePpeItem(item)
                  }
                }}
                onNewDelivery={openPpeDeliveryForm}
                onEmployeeExpediente={() => undefined}
                activeCompanyName={companies.find((company) => company.id === activeCompanyId)?.name}
              />
            )}
            {view === 'medical' && canViewMedical && (
              <MedicalPage
                profiles={medicalProfiles}
                exams={medicalExams}
                restrictions={medicalRestrictions}
                surveillancePrograms={surveillancePrograms}
                surveillanceRisks={risks.map((risk) => ({
                  id: risk.id,
                  title: risk.title,
                  level: risk.level,
                  position: risk.position,
                }))}
                canManage={canManageMedical}
                companies={companies}
                onNewProfile={openMedicalProfileForm}
                onNewExam={() => openMedicalExamForm()}
                onEditExam={openMedicalExamForm}
                onDeleteExam={(id) => {
                  const exam = medicalExams.find((entry) => entry.id === id)
                  if (exam) {
                    confirmDeleteMedicalExam(exam)
                  }
                }}
                onNewRestriction={openMedicalRestrictionForm}
                onLiftRestriction={liftMedicalRestriction}
                onDeriveRequirements={deriveMedicalRequirements}
                onNewSurveillanceProgram={openSurveillanceProgramForm}
                onDeriveCohort={deriveSurveillanceCohort}
                onReviewCohort={reviewSurveillanceCohort}
                onExportSurveillance={(format) => { void exportSurveillanceReport(format) }}
                activeCompanyName={companies.find((company) => company.id === activeCompanyId)?.name}
              />
            )}
            {view === 'legalCompliance' && canViewDocuments && (
              <LegalCompliancePage
                user={user}
                companies={companies}
                activeCompanyName={companies.find((company) => company.id === activeCompanyId)?.name}
              />
            )}
            {view === 'reports' && (
              <ReportExportsPage
                exports={reportExports}
                meta={reportExportMeta}
                tableState={reportExportTable}
                filters={reportExportFilters}
                metrics={reportMetrics}
                history={reportMetricHistory}
                companies={companies}
                users={users}
                onTableChange={setReportExportTable}
                onFiltersChange={(filters) => {
                  setReportExportTable((current) => ({ ...current, page: 1 }))
                  setReportExportFilters(filters)
                }}
                onRetry={retryReportExport}
                onDownload={handleDownloadReportExport}
                activeCompanyName={companies.find((company) => company.id === activeCompanyId)?.name}
              />
            )}
            {view === 'users' && (
              <UsersPage
                users={users}
                meta={userMeta}
                tableState={userTable}
                canManage={canManageUsers}
                currentUserId={user.id}
                onTableChange={setUserTable}
                onCreate={() => openUserForm()}
                onPreloadCreate={preloadUserDialog}
                onEdit={openUserForm}
                onDelete={(id) => {
                  const userItem = users.find((item) => item.id === id)
                  if (userItem) {
                    confirmDeleteUser(userItem)
                  }
                }}
                onRestore={(id) => {
                  const userItem = users.find((item) => item.id === id)
                  if (userItem) {
                    confirmRestoreUser(userItem)
                  }
                }}
                activeCompanyName={companies.find((company) => company.id === activeCompanyId)?.name}
              />
            )}
            {view === 'audit' && (
              <AuditPage logs={auditLogs} meta={auditMeta} tableState={auditTable} onTableChange={setAuditTable} />
            )}
            {view === 'developer' && isDeveloper && (
              <DeveloperPanelPage
                data={developerPanel}
                loading={loading}
                onRefresh={() => { void loadDeveloperPanel() }}
              />
            )}
            {view === 'aiAssistant' && <AssistantChatPage />}
            {view === 'externalDeliveries' && canRetryDeliveries && (
              <ExternalDeliveriesPage
                deliveries={externalDeliveries}
                meta={externalDeliveryMeta}
                tableState={externalDeliveryTable}
                filters={externalDeliveryFilters}
                companies={companies}
                onTableChange={setExternalDeliveryTable}
                onFiltersChange={setExternalDeliveryFilters}
                onRetry={(id) => retryDelivery(id)}
                onRetryAll={() => retryDelivery('all')}
                onOpen={setExternalDeliveryDialog}
                selected={externalDeliveryDialog}
                onClose={() => setExternalDeliveryDialog(null)}
              />            )}
            <SsoConfigDialog              companyId={ssoConfigCompany?.id ?? ''}
              companyName={ssoConfigCompany?.name ?? ''}
              open={ssoConfigOpen}
              loading={loading}
              configured={ssoConfigured}
              values={ssoConfigValues}
              onChange={setSsoConfigValues}
              onClose={() => setSsoConfigOpen(false)}
              onSave={() => { void saveSsoConfig() }}
            />
            <CompanyDialog
              open={companyDialog.open}
              editing={Boolean(companyDialog.item)}
              values={companyForm}
              loading={loading}
              onChange={setCompanyForm}
              onClose={() => setCompanyDialog({ open: false })}
              onSave={saveCompany}
            />
            <ContractorDialog
              open={contractorDialog.open}
              editing={Boolean(contractorDialog.item)}
              values={contractorForm}
              companies={companies}
              loading={loading}
              canPickCompany={isPlatformAdmin}
              onChange={setContractorForm}
              onClose={() => setContractorDialog({ open: false })}
              onSave={saveContractor}
            />
            <ContractorDetailDialog
              contractor={contractorDetail}
              workers={contractorWorkers}
              documents={contractorDocuments}
              loading={loading}
              canManage={canManageContractors}
              onAddWorker={() => openContractorWorkerForm()}
              onEditWorker={openContractorWorkerForm}
              onDeleteWorker={confirmDeleteContractorWorker}
              onAddDocument={() => openContractorDocumentForm()}
              onEditDocument={openContractorDocumentForm}
              onDeleteDocument={confirmDeleteContractorDocument}
              onClose={() => setContractorDetail(null)}
            />
            <ContractorWorkerDialog
              open={contractorWorkerDialog.open}
              editing={Boolean(contractorWorkerDialog.item)}
              values={contractorWorkerForm}
              companies={companies}
              loading={loading}
              canPickCompany={isPlatformAdmin}
              onChange={setContractorWorkerForm}
              onClose={() => setContractorWorkerDialog({ open: false })}
              onSave={saveContractorWorker}
            />
            <ContractorDocumentDialog
              open={contractorDocumentDialog.open}
              editing={Boolean(contractorDocumentDialog.item)}
              values={contractorDocumentForm}
              companies={companies}
              loading={loading}
              canPickCompany={isPlatformAdmin}
              onChange={setContractorDocumentForm}
              onClose={() => setContractorDocumentDialog({ open: false })}
              onSave={saveContractorDocument}
            />
            <SiteDialog
              open={siteDialog.open}
              editing={Boolean(siteDialog.item)}
              values={siteForm}
              companies={companies}
              loading={loading}
              canPickCompany={isPlatformAdmin}
              onChange={setSiteForm}
              onClose={() => setSiteDialog({ open: false })}
              onSave={saveSite}
            />
            <EmployeeDialog
              open={employeeDialog.open}
              editing={Boolean(employeeDialog.item)}
              values={employeeForm}
              companies={companies}
              sites={sites}
              loading={loading}
              canPickCompany={isPlatformAdmin}
              documentError={employeeDocumentError}
              onChange={setEmployeeForm}
              onClose={() => setEmployeeDialog({ open: false })}
              onSave={saveEmployee}
            />
            <IncidentDialog
              open={incidentDialog.open}
              editing={Boolean(incidentDialog.item)}
              values={incidentForm}
              companies={companies}
              sites={sites}
              loading={loading}
              canPickCompany={isPlatformAdmin}
              onChange={setIncidentForm}
              onClose={() => setIncidentDialog({ open: false })}
              onSave={saveIncident}
            />
            <RiskDialog
              open={riskDialog.open}
              editing={Boolean(riskDialog.item)}
              values={riskForm}
              companies={companies}
              sites={sites}
              loading={loading}
              canPickCompany={isPlatformAdmin}
              onChange={setRiskForm}
              onClose={() => setRiskDialog({ open: false })}
              onSave={saveRisk}
            />
            <TrainingDialog
              open={trainingDialog.open}
              editing={Boolean(trainingDialog.item)}
              values={trainingForm}
              companies={companies}
              sites={sites}
              loading={loading}
              canPickCompany={isPlatformAdmin}
              onChange={setTrainingForm}
              onClose={() => setTrainingDialog({ open: false })}
              onSave={saveTraining}
            />
            <UserDialog
              open={userDialog.open}
              editing={Boolean(userDialog.item)}
              values={userForm}
              companies={companies}
              loading={loading}
              onChange={setUserForm}
              onClose={() => setUserDialog({ open: false })}
              onSave={saveUser}
            />
            <DocumentDialog
              open={documentDialog.open}
              editing={Boolean(documentDialog.item)}
              values={documentForm}
              companies={companies}
              sites={sites}
              loading={loading}
              canPickCompany={isPlatformAdmin}
              onChange={setDocumentForm}
              onUpload={uploadDocumentFile}
              onClose={() => setDocumentDialog({ open: false })}
              onSave={saveDocument}
            />
            <SgsstAuditDialog
              open={sgsstAuditDialog.open}
              editing={Boolean(sgsstAuditDialog.item)}
              values={sgsstAuditForm}
              companies={companies}
              loading={loading}
              canPickCompany={isPlatformAdmin}
              onChange={setSgsstAuditForm}
              onClose={() => setSgsstAuditDialog({ open: false })}
              onSave={saveSgsstAudit}
            />
            <SgsstEvaluationDialog
              open={sgsstEvaluationDialog.open}
              editing={Boolean(sgsstEvaluationDialog.item)}
              values={sgsstEvaluationForm}
              companies={companies}
              item={sgsstEvaluationDialog.item}
              loading={loading}
              canPickCompany={isPlatformAdmin}
              canRespond={canManageDocuments}
              onChange={setSgsstEvaluationForm}
              onClose={() => setSgsstEvaluationDialog({ open: false })}
              onSave={saveSgsstEvaluation}
              onUpdateItem={updateEvaluationItem}
              onAddItem={addEvaluationItem}
            />
            <IndicatorDialog
              open={indicatorDialog.open}
              editing={Boolean(indicatorDialog.item)}
              values={indicatorForm}
              companies={companies}
              sites={sites}
              indicator={indicatorDialog.item}
              loading={loading}
              canPickCompany={isPlatformAdmin}
              canManage={canManageDocuments}
              onChange={setIndicatorForm}
              onClose={() => setIndicatorDialog({ open: false })}
              onSave={saveIndicator}
              onSetTargets={setIndicatorTargets}
              onAddMeasurement={addIndicatorMeasurement}
            />
            <AnnualWorkPlanDialog
              open={annualWorkPlanDialog.open}
              editing={Boolean(annualWorkPlanDialog.item)}
              values={annualWorkPlanForm}
              companies={companies}
              item={annualWorkPlanDialog.item}
              users={users}
              documents={documents}
              loading={loading}
              canPickCompany={isPlatformAdmin}
              canManageActivities={canManageDocuments}
              onChange={setAnnualWorkPlanForm}
              onClose={() => setAnnualWorkPlanDialog({ open: false })}
              onSave={saveAnnualWorkPlan}
              onLoadActivities={loadAnnualPlanActivities}
              onAddActivity={addAnnualPlanActivity}
              onUpdateActivity={updateAnnualPlanActivity}
              onDeleteActivity={(planId, activityId) => confirmDeleteAnnualPlanActivity(planId, activityId)}
            />
            <PlannedInspectionDialog
              open={plannedInspectionDialog.open}
              editing={Boolean(plannedInspectionDialog.item)}
              values={plannedInspectionForm}
              companies={companies}
              sites={sites}
              users={users}
              item={plannedInspectionDialog.item}
              loading={loading}
              canPickCompany={isPlatformAdmin}
              canRespond={canManageOperations}
              onChange={setPlannedInspectionForm}
              onClose={() => setPlannedInspectionDialog({ open: false })}
              onSave={savePlannedInspection}
              onUpdateItem={updatePlannedInspectionItem}
              onAddItem={addPlannedInspectionItem}
              onAddFinding={addPlannedInspectionFinding}
              onAddAction={addPlannedInspectionAction}
            />
            <UnplannedInspectionDialog
              open={unplannedInspectionDialog.open}
              editing={Boolean(unplannedInspectionDialog.item)}
              values={unplannedInspectionForm}
              companies={companies}
              sites={sites}
              users={users}
              loading={loading}
              canPickCompany={isPlatformAdmin}
              onChange={setUnplannedInspectionForm}
              onClose={() => setUnplannedInspectionDialog({ open: false })}
              onSave={saveUnplannedInspection}
            />
            <UnsafeReportDialog
              open={unsafeReportDialog.open}
              editing={Boolean(unsafeReportDialog.item)}
              values={unsafeReportForm}
              companies={companies}
              sites={sites}
              loading={loading}
              canPickCompany={isPlatformAdmin}
              canManage={canManageOperations}
              onChange={setUnsafeReportForm}
              onClose={() => setUnsafeReportDialog({ open: false })}
              onSave={saveUnsafeReport}
            />
            <PpeItemDialog
              open={ppeItemDialog.open}
              editing={Boolean(ppeItemDialog.item)}
              values={ppeItemForm}
              companies={companies}
              loading={loading}
              canPickCompany={isPlatformAdmin}
              onChange={setPpeItemForm}
              onClose={() => setPpeItemDialog({ open: false })}
              onSave={savePpeItem}
            />
            <PpeDeliveryDialog
              open={ppeDeliveryDialogOpen}
              values={ppeDeliveryForm}
              items={[]}
              deliveriesItems={ppeItems.map((item) => ({ id: item.id, name: item.name, stock: item.stock }))}
              employees={employees}
              loading={loading}
              canPickCompany={isPlatformAdmin}
              companies={companies}
              onChange={setPpeDeliveryForm}
              onClose={() => setPpeDeliveryDialogOpen(false)}
              onSave={savePpeDelivery}
            />
            <MedicalProfileDialog
              open={medicalProfileDialog}
              values={medicalProfileForm}
              companies={companies}
              risks={risks.map((risk) => ({ id: risk.id, title: risk.title, level: risk.level, position: risk.position }))}
              loading={loading}
              canPickCompany={isPlatformAdmin}
              onChange={setMedicalProfileForm}
              onClose={() => setMedicalProfileDialog(false)}
              onSave={saveMedicalProfile}
            />
            <MedicalSurveillanceProgramDialog
              open={surveillanceProgramDialog}
              values={surveillanceProgramForm}
              companies={companies}
              loading={loading}
              canPickCompany={isPlatformAdmin}
              onChange={setSurveillanceProgramForm}
              onClose={() => setSurveillanceProgramDialog(false)}
              onSave={saveSurveillanceProgram}
            />
            <MedicalExamDialog
              open={medicalExamDialog.open}
              editing={Boolean(medicalExamDialog.exam)}
              values={medicalExamForm}
              employees={employees.map((employee) => ({
                id: employee.id,
                firstName: employee.firstName,
                lastName: employee.lastName,
                document: employee.document,
              }))}
              loading={loading}
              canPickCompany={isPlatformAdmin}
              companies={companies}
              onChange={setMedicalExamForm}
              onClose={() => setMedicalExamDialog({ open: false })}
              onSave={saveMedicalExam}
            />
            <MedicalRestrictionDialog
              open={medicalRestrictionDialog}
              values={medicalRestrictionForm}
              employees={employees.map((employee) => ({
                id: employee.id,
                firstName: employee.firstName,
                lastName: employee.lastName,
                document: employee.document,
              }))}
              loading={loading}
              canPickCompany={isPlatformAdmin}
              companies={companies}
              onChange={setMedicalRestrictionForm}
              onClose={() => setMedicalRestrictionDialog(false)}
              onSave={saveMedicalRestriction}
            />
            <ChangePasswordDialog
              open={passwordDialogOpen}
              values={passwordForm}
              loading={loading}
              onChange={setPasswordForm}
              onClose={() => setPasswordDialogOpen(false)}
              onSave={changePassword}
            />
            <MfaSettingsDialog
              open={mfaSettingsOpen}
              enabled={Boolean(user.mfaEnabled)}
              secret={mfaSetup.secret}
              otpauthUrl={mfaSetup.otpauthUrl}
              code={mfaSetup.code}
              loading={loading}
              onCodeChange={(code) => setMfaSetup((current) => ({ ...current, code }))}
              onSetup={setupMfa}
              onEnable={enableMfa}
              onDisable={disableMfa}
              onClose={() => setMfaSettingsOpen(false)}
            />
          </Suspense>
          </ViewErrorBoundary>
        </AppLayout>
      )}
    </ThemeProvider>
  )
}

export default App
