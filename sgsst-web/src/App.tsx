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
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, CssBaseline, ThemeProvider } from '@mui/material'
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
import {
  emptyCompany,
  emptyDocument,
  emptyEmployee,
  emptyIncident,
  emptyMeta,
  emptyReportMetrics,
  emptyRisk,
  emptySgsstAudit,
  emptySite,
  emptySummary,
  emptyTraining,
  emptyUser,
  initialTableState,
} from './constants/forms'
import { AppLayout } from './layout/AppLayout'
import {
  AuditPage,
  CompaniesPage,
  CompanyDialog,
  DashboardPage,
  DocumentDialog,
  DocumentsPage,
  EmployeeDialog,
  EmployeesPage,
  IncidentDialog,
  IncidentsPage,
  LegalCompliancePage,
  ReportExportsPage,
  RiskDialog,
  RisksPage,
  SgsstAuditDialog,
  SgsstAuditsPage,
  preloadSgsstAuditDialog,
  preloadCompanyDialog,
  preloadDocumentDialog,
  preloadEmployeeDialog,
  preloadIncidentDialog,
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
  AppNotification,
  AuditLog,
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
  Site,
  SystemUser,
  Training,
  View,
} from './types'
import { isPaginated, reportExportParams, sanitize, tableParams } from './utils'

function App() {
  const [token, setToken] = useState(() => getStoredSession().token)
  const [user, setUser] = useState<AuthUser | null>(() => getStoredSession().user)
  const [view, setView] = useState<View>('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [risks, setRisks] = useState<Risk[]>([])
  const [trainings, setTrainings] = useState<Training[]>([])
  const [documents, setDocuments] = useState<SgsstDocument[]>([])
  const [sgsstAudits, setSgsstAudits] = useState<SgsstAudit[]>([])
  const [reportExports, setReportExports] = useState<ReportExport[]>([])
  const [reportMetrics, setReportMetrics] = useState<ReportExportMetrics>(emptyReportMetrics)
  const [reportMetricHistory, setReportMetricHistory] = useState<ReportExportMetricSnapshot[]>([])
  const [users, setUsers] = useState<SystemUser[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [notificationUnread, setNotificationUnread] = useState(0)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [dashboardSummary, setDashboardSummary] = useState(emptySummary)
  const [companyMeta, setCompanyMeta] = useState(emptyMeta)
  const [siteMeta, setSiteMeta] = useState(emptyMeta)
  const [employeeMeta, setEmployeeMeta] = useState(emptyMeta)
  const [incidentMeta, setIncidentMeta] = useState(emptyMeta)
  const [riskMeta, setRiskMeta] = useState(emptyMeta)
  const [trainingMeta, setTrainingMeta] = useState(emptyMeta)
  const [documentMeta, setDocumentMeta] = useState(emptyMeta)
  const [sgsstAuditMeta, setSgsstAuditMeta] = useState(emptyMeta)
  const [reportExportMeta, setReportExportMeta] = useState(emptyMeta)
  const [userMeta, setUserMeta] = useState(emptyMeta)
  const [auditMeta, setAuditMeta] = useState(emptyMeta)
  const [companyTable, setCompanyTable] = useState(initialTableState)
  const [siteTable, setSiteTable] = useState(initialTableState)
  const [employeeTable, setEmployeeTable] = useState(initialTableState)
  const [employeeSiteFilter, setEmployeeSiteFilter] = useState('all')
  const [incidentTable, setIncidentTable] = useState(initialTableState)
  const [riskTable, setRiskTable] = useState(initialTableState)
  const [trainingTable, setTrainingTable] = useState(initialTableState)
  const [documentTable, setDocumentTable] = useState(initialTableState)
  const [sgsstAuditTable, setSgsstAuditTable] = useState(initialTableState)
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
  const [siteDialog, setSiteDialog] = useState<{ open: boolean; item?: Site }>({ open: false })
  const [employeeDialog, setEmployeeDialog] = useState<{ open: boolean; item?: Employee }>({ open: false })
  const [incidentDialog, setIncidentDialog] = useState<{ open: boolean; item?: Incident }>({ open: false })
  const [riskDialog, setRiskDialog] = useState<{ open: boolean; item?: Risk }>({ open: false })
  const [trainingDialog, setTrainingDialog] = useState<{ open: boolean; item?: Training }>({ open: false })
  const [documentDialog, setDocumentDialog] = useState<{ open: boolean; item?: SgsstDocument }>({ open: false })
  const [sgsstAuditDialog, setSgsstAuditDialog] = useState<{ open: boolean; item?: SgsstAudit }>({ open: false })
  const [userDialog, setUserDialog] = useState<{ open: boolean; item?: SystemUser }>({ open: false })
  const [companyForm, setCompanyForm] = useState(emptyCompany)
  const [siteForm, setSiteForm] = useState(emptySite)
  const [employeeForm, setEmployeeForm] = useState(emptyEmployee)
  const [incidentForm, setIncidentForm] = useState(emptyIncident)
  const [riskForm, setRiskForm] = useState(emptyRisk)
  const [trainingForm, setTrainingForm] = useState(emptyTraining)
  const [documentForm, setDocumentForm] = useState(emptyDocument)
  const [sgsstAuditForm, setSgsstAuditForm] = useState(emptySgsstAudit)
  const [userForm, setUserForm] = useState(emptyUser)

  const isPlatformAdmin = user?.role === 'SUPER_ADMIN'
  const isEmployee = user?.role === 'EMPLOYEE'
  const activeCompanyId = user?.activeCompanyId ?? user?.companyId
  const canManageCompanies = isPlatformAdmin || user?.role === 'ADMIN' || user?.role === 'SST' || user?.role === 'AUDITOR'
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
  // EMPLOYEE consulta datos y dashboard, pero no genera exports (solo-backoffice).
  const canExportReports = canViewReports
  const canViewReportHistory = isPlatformAdmin
  const canManageDocuments = isPlatformAdmin || user?.role === 'ADMIN' || user?.role === 'SST'
  const canDeleteEmployees = isPlatformAdmin || user?.role === 'ADMIN'
  const canViewUsers = isPlatformAdmin || user?.role === 'ADMIN' || user?.role === 'SST'
  const canManageUsers = isPlatformAdmin || user?.role === 'ADMIN'
  const canViewAudit = isPlatformAdmin || user?.role === 'ADMIN' || user?.role === 'AUDITOR'

  const selectedTitle =
    view === 'dashboard'
      ? 'Dashboard'
      : view === 'companies'
        ? 'Empresas'
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
                    : view === 'legalCompliance'
                      ? 'Mapa normativo'
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
  }, [token, companyTable, siteTable, employeeTable, employeeSiteFilter, incidentTable, riskTable, trainingTable, documentTable, sgsstAuditTable, reportExportTable, reportExportFilters, userTable, auditTable])

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
      const siteRequest = canViewSites && hasCompanyScope
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
            },
          })
        : Promise.resolve({ data: { data: [] as Incident[], meta: emptyMeta } })
      const risksRequest = hasCompanyScope
        ? api.get<Paginated<Risk>>('/risks', {
            params: {
              ...tableParams(riskTable),
              ...(isPlatformAdmin ? {} : { companyId: activeCompanyId }),
            },
          })
        : Promise.resolve({ data: { data: [] as Risk[], meta: emptyMeta } })
      const trainingsRequest = hasCompanyScope
        ? api.get<Paginated<Training>>('/trainings', {
            params: {
              ...tableParams(trainingTable),
              ...(isPlatformAdmin ? {} : { companyId: activeCompanyId }),
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
            },
          })
        : Promise.resolve({ data: { data: [] as SgsstDocument[], meta: emptyMeta } })
      const auditRequest = canViewAudit
        ? api.get<Paginated<AuditLog>>('/audit-logs', { params: tableParams(auditTable) })
        : Promise.resolve({ data: { data: [] as AuditLog[], meta: emptyMeta } })
      const sgsstAuditRequest = canViewDocuments && hasCompanyScope
        ? api.get<Paginated<SgsstAudit>>('/sgsst-audits', {
            params: {
              ...tableParams(sgsstAuditTable),
              ...(isPlatformAdmin ? {} : { companyId: activeCompanyId }),
            },
          })
        : Promise.resolve({ data: { data: [] as SgsstAudit[], meta: emptyMeta } })
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
        siteResponse,
        employeeResponse,
        incidentsResponse,
        risksResponse,
        trainingsResponse,
        documentResponse,
        sgsstAuditResponse,
        reportExportsResponse,
        reportMetricsResponse,
        reportMetricHistoryResponse,
        userResponse,
        auditResponse,
        notificationResponse,
        summaryResponse,
      ] = await Promise.all([
        companyRequest,
        siteRequest,
        employeeRequest,
        incidentsRequest,
        risksRequest,
        trainingsRequest,
        documentRequest,
        sgsstAuditRequest,
        reportExportsRequest,
        reportMetricsRequest,
        reportMetricHistoryRequest,
        userRequest,
        auditRequest,
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
      setReportExports(reportExportsResponse.data.data)
      setReportExportMeta(reportExportsResponse.data.meta)
      setReportMetrics(reportMetricsResponse.data)
      setReportMetricHistory(reportMetricHistoryResponse.data)
      setUsers(userResponse.data.data)
      setUserMeta(userResponse.data.meta)
      setAuditLogs(auditResponse.data.data)
      setAuditMeta(auditResponse.data.meta)
      setNotifications(notificationResponse.data.data)
      setNotificationUnread(notificationResponse.data.meta.unread ?? 0)
      setDashboardSummary(summaryResponse.data)
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
    setReportExports([])
    setReportMetrics(emptyReportMetrics)
    setReportMetricHistory([])
    setUsers([])
    setNotifications([])
    setNotificationUnread(0)
    setAuditLogs([])
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
      if (incidentDialog.item) {
        await api.patch(`/incidents/${incidentDialog.item.id}`, sanitize(incidentForm))
      } else {
        // El estado inicial lo fija el backend (PENDING); no se envia en creacion.
        const { status: _status, ...createPayload } = sanitize(incidentForm)
        await api.post('/incidents', createPayload)
      }
      setIncidentDialog({ open: false })
    })
  }

  async function saveRisk() {
    await saveRecord(async () => {
      if (riskDialog.item) {
        await api.patch(`/risks/${riskDialog.item.id}`, sanitize(riskForm))
      } else {
        await api.post('/risks', sanitize(riskForm))
      }
      setRiskDialog({ open: false })
    })
  }

  async function saveTraining() {
    await saveRecord(async () => {
      if (trainingDialog.item) {
        await api.patch(`/trainings/${trainingDialog.item.id}`, sanitize(trainingForm))
      } else {
        await api.post('/trainings', sanitize(trainingForm))
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
      if (documentDialog.item) {
        await api.patch(`/documents/${documentDialog.item.id}`, sanitize(documentForm))
      } else {
        await api.post('/documents', sanitize(documentForm))
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

  function confirmRestoreDocument(documentItem: SgsstDocument) {
    openConfirmDialog(
      'Restaurar documento',
      `¿Seguro que deseas restaurar el documento ${documentItem.name}?`,
      'Restaurar',
      'success',
      () => { void restoreDocument(documentItem.id) },
    )
  }

  async function restoreDocument(id: string) {
    await saveRecord(() => api.patch(`/documents/${id}`, { isActive: true }).then())
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
    const employeeBlocked: View[] = ['companies', 'documents', 'sgsstAudits', 'legalCompliance', 'reports', 'users', 'externalDeliveries', 'audit', 'sites']
    if (isEmployee && employeeBlocked.includes(nextView)) {
      return
    }
    setView(nextView)
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
          canViewSites={canViewSites}
          canViewDocuments={canViewDocuments}
          canViewReports={canViewReports}
          canViewAudit={canViewAudit}
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
                onSiteFilterChange={(siteId) => {
                  setEmployeeTable((current) => ({ ...current, page: 1 }))
                  setEmployeeSiteFilter(siteId)
                }}
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
                onRestore={(id) => {
                  const documentItem = documents.find((item) => item.id === id)
                  if (documentItem) {
                    confirmRestoreDocument(documentItem)
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
            <CompanyDialog
              open={companyDialog.open}
              editing={Boolean(companyDialog.item)}
              values={companyForm}
              loading={loading}
              onChange={setCompanyForm}
              onClose={() => setCompanyDialog({ open: false })}
              onSave={saveCompany}
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
