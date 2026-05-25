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
import { CssBaseline, ThemeProvider } from '@mui/material'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { api, clearSession, getStoredSession, readApiError, saveSession, setUnauthorizedHandler } from './api/client'
import { ChangePasswordDialog, type ChangePasswordValues } from './auth/ChangePasswordDialog'
import { LoginPage } from './auth/LoginPage'
import {
  emptyCompany,
  emptyDocument,
  emptyEmployee,
  emptyMeta,
  emptySummary,
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
  preloadCompanyDialog,
  preloadDocumentDialog,
  preloadEmployeeDialog,
  preloadUserDialog,
  preloadView,
  UserDialog,
  UsersPage,
} from './routes/lazyRoutes'
import { theme } from './theme'
import type {
  AppNotification,
  AuditLog,
  AuthUser,
  Company,
  DashboardSummary,
  SgsstDocument,
  Employee,
  Paginated,
  SystemUser,
  View,
} from './types'
import { isPaginated, sanitize, tableParams } from './utils'

function App() {
  const [token, setToken] = useState(() => getStoredSession().token)
  const [user, setUser] = useState<AuthUser | null>(() => getStoredSession().user)
  const [view, setView] = useState<View>('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [documents, setDocuments] = useState<SgsstDocument[]>([])
  const [users, setUsers] = useState<SystemUser[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [notificationUnread, setNotificationUnread] = useState(0)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [dashboardSummary, setDashboardSummary] = useState(emptySummary)
  const [companyMeta, setCompanyMeta] = useState(emptyMeta)
  const [employeeMeta, setEmployeeMeta] = useState(emptyMeta)
  const [documentMeta, setDocumentMeta] = useState(emptyMeta)
  const [userMeta, setUserMeta] = useState(emptyMeta)
  const [auditMeta, setAuditMeta] = useState(emptyMeta)
  const [companyTable, setCompanyTable] = useState(initialTableState)
  const [employeeTable, setEmployeeTable] = useState(initialTableState)
  const [documentTable, setDocumentTable] = useState(initialTableState)
  const [userTable, setUserTable] = useState(initialTableState)
  const [auditTable, setAuditTable] = useState(initialTableState)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [login, setLogin] = useState({ email: '', password: '' })
  const [bootstrapOpen, setBootstrapOpen] = useState(false)
  const [bootstrap, setBootstrap] = useState({ name: '', email: '', password: '' })
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [passwordForm, setPasswordForm] = useState<ChangePasswordValues>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [companyDialog, setCompanyDialog] = useState<{ open: boolean; item?: Company }>({ open: false })
  const [employeeDialog, setEmployeeDialog] = useState<{ open: boolean; item?: Employee }>({ open: false })
  const [documentDialog, setDocumentDialog] = useState<{ open: boolean; item?: SgsstDocument }>({ open: false })
  const [userDialog, setUserDialog] = useState<{ open: boolean; item?: SystemUser }>({ open: false })
  const [companyForm, setCompanyForm] = useState(emptyCompany)
  const [employeeForm, setEmployeeForm] = useState(emptyEmployee)
  const [documentForm, setDocumentForm] = useState(emptyDocument)
  const [userForm, setUserForm] = useState(emptyUser)

  const canManageCompanies = user?.role === 'ADMIN'
  const canManageEmployees = user?.role === 'ADMIN' || user?.role === 'SST'
  const canViewDocuments = user?.role === 'ADMIN' || user?.role === 'SST' || user?.role === 'AUDITOR'
  const canManageDocuments = user?.role === 'ADMIN' || user?.role === 'SST'
  const canDeleteEmployees = user?.role === 'ADMIN'
  const canViewUsers = user?.role === 'ADMIN' || user?.role === 'SST'
  const canManageUsers = user?.role === 'ADMIN'
  const canViewAudit = user?.role === 'ADMIN' || user?.role === 'AUDITOR'

  const selectedTitle =
    view === 'dashboard'
      ? 'Dashboard'
      : view === 'companies'
        ? 'Empresas'
        : view === 'employees'
          ? 'Empleados'
          : view === 'documents'
            ? 'Documentos'
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
  }, [token, companyTable, employeeTable, documentTable, userTable, auditTable])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const companyRequest =
        user?.role === 'ADMIN'
          ? api.get<Paginated<Company>>('/companies', { params: tableParams(companyTable) })
          : user?.companyId
            ? api.get<Company>(`/companies/${user.companyId}`)
            : Promise.resolve({ data: [] as Company[] })
      const employeeRequest = api.get<Paginated<Employee>>('/employees', {
        params: {
          ...tableParams(employeeTable),
          ...(user?.role === 'ADMIN' ? {} : { companyId: user?.companyId }),
        },
      })
      const userRequest = canViewUsers
        ? api.get<Paginated<SystemUser>>('/users', {
            params: {
              ...tableParams(userTable),
              ...(user?.role === 'ADMIN' ? {} : { companyId: user?.companyId }),
            },
          })
        : Promise.resolve({ data: { data: [] as SystemUser[], meta: emptyMeta } })
      const documentRequest = canViewDocuments
        ? api.get<Paginated<SgsstDocument>>('/documents', {
            params: {
              ...tableParams(documentTable),
              ...(user?.role === 'ADMIN' ? {} : { companyId: user?.companyId }),
            },
          })
        : Promise.resolve({ data: { data: [] as SgsstDocument[], meta: emptyMeta } })
      const auditRequest = canViewAudit
        ? api.get<Paginated<AuditLog>>('/audit-logs', { params: tableParams(auditTable) })
        : Promise.resolve({ data: { data: [] as AuditLog[], meta: emptyMeta } })
      const notificationRequest = api.get<Paginated<AppNotification>>('/notifications', {
        params: { page: 1, pageSize: 8 },
      })
      const summaryRequest = api.get<DashboardSummary>('/dashboard/summary')
      const [companyResponse, employeeResponse, documentResponse, userResponse, auditResponse, notificationResponse, summaryResponse] =
        await Promise.all([companyRequest, employeeRequest, documentRequest, userRequest, auditRequest, notificationRequest, summaryRequest])

      if (isPaginated<Company>(companyResponse.data)) {
        setCompanies(companyResponse.data.data)
        setCompanyMeta(companyResponse.data.meta)
      } else {
        const data = Array.isArray(companyResponse.data) ? companyResponse.data : [companyResponse.data]
        setCompanies(data)
        setCompanyMeta({ ...emptyMeta, total: data.length, totalPages: 1 })
      }
      setEmployees(employeeResponse.data.data)
      setEmployeeMeta(employeeResponse.data.meta)
      setDocuments(documentResponse.data.data)
      setDocumentMeta(documentResponse.data.meta)
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
      saveSession(response.data.accessToken, response.data.user, response.data.refreshToken)
      setToken(response.data.accessToken)
      setUser(response.data.user)
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
    resetWorkspace()
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
    setEmployees([])
    setDocuments([])
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
          }
        : emptyCompany,
    )
    setCompanyDialog({ open: true, item })
    preloadCompanyDialog()
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
          }
        : { ...emptyEmployee, companyId: user?.companyId ?? companies[0]?.id ?? '' },
    )
    setEmployeeDialog({ open: true, item })
    preloadEmployeeDialog()
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
        : { ...emptyDocument, companyId: user?.companyId ?? companies[0]?.id ?? '' },
    )
    setDocumentDialog({ open: true, item })
    preloadDocumentDialog()
  }

  async function saveCompany() {
    await saveRecord(async () => {
      if (companyDialog.item) {
        await api.patch(`/companies/${companyDialog.item.id}`, sanitize(companyForm))
      } else {
        await api.post('/companies', sanitize(companyForm))
      }
      setCompanyDialog({ open: false })
    })
  }

  async function saveEmployee() {
    await saveRecord(async () => {
      if (employeeDialog.item) {
        await api.patch(`/employees/${employeeDialog.item.id}`, sanitize(employeeForm))
      } else {
        await api.post('/employees', sanitize(employeeForm))
      }
      setEmployeeDialog({ open: false })
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
      await loadData()
    } catch (currentError) {
      setError(readApiError(currentError))
    } finally {
      setLoading(false)
    }
  }

  async function removeCompany(id: string) {
    await saveRecord(() => api.delete(`/companies/${id}`).then())
  }

  async function restoreCompany(id: string) {
    await saveRecord(() => api.patch(`/companies/${id}`, { isActive: true }).then())
  }

  async function removeEmployee(id: string) {
    await saveRecord(() => api.delete(`/employees/${id}`).then())
  }

  async function restoreEmployee(id: string) {
    await saveRecord(() => api.patch(`/employees/${id}`, { isActive: true }).then())
  }

  async function removeDocument(id: string) {
    await saveRecord(() => api.delete(`/documents/${id}`).then())
  }

  async function restoreDocument(id: string) {
    await saveRecord(() => api.patch(`/documents/${id}`, { isActive: true }).then())
  }

  async function removeUser(id: string) {
    await saveRecord(() => api.delete(`/users/${id}`).then())
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

  function selectView(nextView: View) {
    setView(nextView)
    setMobileOpen(false)
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {!user || !token ? (
        <LoginPage
          login={login}
          bootstrap={bootstrap}
          bootstrapOpen={bootstrapOpen}
          error={error}
          loading={loading}
          onLoginChange={setLogin}
          onBootstrapChange={setBootstrap}
          onBootstrapOpen={() => setBootstrapOpen(true)}
          onBootstrapClose={() => setBootstrapOpen(false)}
          onLogin={handleLogin}
          onBootstrap={handleBootstrap}
        />
      ) : (
        <AppLayout
          user={user}
          view={view}
          selectedTitle={selectedTitle}
          mobileOpen={mobileOpen}
          loading={loading}
          error={error}
          canViewUsers={canViewUsers}
          canViewDocuments={canViewDocuments}
          canViewAudit={canViewAudit}
          canGenerateNotifications={canManageDocuments}
          notifications={notifications}
          notificationUnread={notificationUnread}
          onMobileOpen={() => setMobileOpen(true)}
          onMobileClose={() => setMobileOpen(false)}
          onSelectView={selectView}
          onPreloadView={preloadView}
          onRefresh={loadData}
          onMarkNotificationRead={markNotificationRead}
          onMarkAllNotificationsRead={markAllNotificationsRead}
          onGenerateNotifications={generateNotifications}
          onChangePassword={() => setPasswordDialogOpen(true)}
          onLogout={logout}
        >
          <Suspense fallback={null}>
            {view === 'dashboard' && <DashboardPage stats={stats} companies={companies} employees={employees} />}
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
                onDelete={removeCompany}
                onRestore={restoreCompany}
              />
            )}
            {view === 'employees' && (
              <EmployeesPage
                employees={employees}
                meta={employeeMeta}
                tableState={employeeTable}
                canManage={canManageEmployees}
                canDelete={canDeleteEmployees}
              onTableChange={setEmployeeTable}
              onCreate={() => openEmployeeForm()}
              onPreloadCreate={preloadEmployeeDialog}
              onEdit={openEmployeeForm}
                onDelete={removeEmployee}
                onRestore={restoreEmployee}
              />
            )}
            {view === 'documents' && (
              <DocumentsPage
                documents={documents}
                meta={documentMeta}
                tableState={documentTable}
                canManage={canManageDocuments}
                onTableChange={setDocumentTable}
                onCreate={() => openDocumentForm()}
                onPreloadCreate={preloadDocumentDialog}
                onEdit={openDocumentForm}
                onDelete={removeDocument}
                onRestore={restoreDocument}
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
                onDelete={removeUser}
                onRestore={restoreUser}
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
            <EmployeeDialog
              open={employeeDialog.open}
              editing={Boolean(employeeDialog.item)}
              values={employeeForm}
              companies={companies}
              loading={loading}
              canPickCompany={user.role === 'ADMIN'}
              onChange={setEmployeeForm}
              onClose={() => setEmployeeDialog({ open: false })}
              onSave={saveEmployee}
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
              canPickCompany={user.role === 'ADMIN'}
              onChange={setDocumentForm}
              onUpload={uploadDocumentFile}
              onClose={() => setDocumentDialog({ open: false })}
              onSave={saveDocument}
            />
            <ChangePasswordDialog
              open={passwordDialogOpen}
              values={passwordForm}
              loading={loading}
              onChange={setPasswordForm}
              onClose={() => setPasswordDialogOpen(false)}
              onSave={changePassword}
            />
          </Suspense>
        </AppLayout>
      )}
    </ThemeProvider>
  )
}

export default App
