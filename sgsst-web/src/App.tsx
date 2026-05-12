import {
  Add,
  Business,
  Delete,
  Edit,
  HealthAndSafety,
  Logout,
  ManageAccounts,
  Menu,
  People,
  ReportProblem,
  Refresh,
  RestoreFromTrash,
  Security,
  SpaceDashboard,
  School,
  WarningAmber,
} from '@mui/icons-material'
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  ThemeProvider,
  Toolbar,
  Tooltip,
  Typography,
  createTheme,
} from '@mui/material'
import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'

const drawerWidth = 284
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1',
})

type Role = 'ADMIN' | 'SST' | 'EMPLOYEE' | 'AUDITOR'
type View = 'dashboard' | 'companies' | 'employees' | 'users'
type CompanyRiskClass = 'CLASS_I' | 'CLASS_II' | 'CLASS_III' | 'CLASS_IV' | 'CLASS_V'
type DocumentType = 'CC' | 'CE' | 'TI' | 'PASSPORT' | 'NIT'
type ContractType = 'INDEFINITE' | 'FIXED_TERM' | 'SERVICE' | 'APPRENTICESHIP' | 'TEMPORARY'
type EmploymentStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'RETIRED'

type AuthUser = {
  id: string
  name: string
  email: string
  role: Role
  companyId?: string
}

type Company = {
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
  isActive: boolean
  deletedAt?: string
}

type Employee = {
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
  isActive: boolean
  deletedAt?: string
  company?: Pick<Company, 'id' | 'name' | 'nit'>
}

type SystemUser = {
  id: string
  name: string
  email: string
  role: Role
  isActive: boolean
  deletedAt?: string
  companyId?: string
  company?: Pick<Company, 'id' | 'name' | 'nit'>
}

type PageMeta = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

type Paginated<T> = {
  data: T[]
  meta: PageMeta
}

type TableState = {
  page: number
  pageSize: number
  search: string
  isActive: 'all' | 'active' | 'inactive'
}

type DashboardSummary = {
  companiesCount: number
  employeesCount: number
  usersCount: number
  criticalRisks: number
  openIncidents: number
  overdueTrainings: number
  upcomingTrainings: number
  inactiveCompanies: number
  inactiveEmployees: number
  inactiveUsers: number
  activeRate: number
}

const theme = createTheme({
  palette: {
    primary: { main: '#1d4f5f', dark: '#143944' },
    secondary: { main: '#6f7d3c' },
    background: { default: '#f4f7f8', paper: '#ffffff' },
    text: { primary: '#1d2939', secondary: '#667085' },
    success: { main: '#1f7a4d' },
    warning: { main: '#b76e00' },
    error: { main: '#b42318' },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    button: { textTransform: 'none', fontWeight: 700 },
    h5: { fontWeight: 800, letterSpacing: 0 },
    h6: { fontWeight: 760, letterSpacing: 0 },
  },
  components: {
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiButton: { defaultProps: { disableElevation: true } },
  },
})

const emptyCompany = {
  name: '',
  nit: '',
  arl: '',
  riskClass: 'CLASS_I' as CompanyRiskClass,
  economicActivity: '',
  city: '',
  department: '',
  address: '',
  phone: '',
  email: '',
}
const emptyEmployee = {
  firstName: '',
  lastName: '',
  documentType: 'CC' as DocumentType,
  document: '',
  position: '',
  workCenter: '',
  contractType: 'INDEFINITE' as ContractType,
  employmentStatus: 'ACTIVE' as EmploymentStatus,
  hireDate: '',
  email: '',
  phone: '',
  companyId: '',
}
const emptyUser = {
  name: '',
  email: '',
  password: '',
  role: 'EMPLOYEE' as Role,
  companyId: '',
}
const initialTableState: TableState = {
  page: 1,
  pageSize: 10,
  search: '',
  isActive: 'all',
}
const emptyMeta: PageMeta = {
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,
}
const emptySummary: DashboardSummary = {
  companiesCount: 0,
  employeesCount: 0,
  usersCount: 0,
  criticalRisks: 0,
  openIncidents: 0,
  overdueTrainings: 0,
  upcomingTrainings: 0,
  inactiveCompanies: 0,
  inactiveEmployees: 0,
  inactiveUsers: 0,
  activeRate: 0,
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('sgsst_token') ?? '')
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('sgsst_user')
    return stored ? JSON.parse(stored) : null
  })
  const [view, setView] = useState<View>('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [users, setUsers] = useState<SystemUser[]>([])
  const [dashboardSummary, setDashboardSummary] = useState(emptySummary)
  const [companyMeta, setCompanyMeta] = useState(emptyMeta)
  const [employeeMeta, setEmployeeMeta] = useState(emptyMeta)
  const [userMeta, setUserMeta] = useState(emptyMeta)
  const [companyTable, setCompanyTable] = useState(initialTableState)
  const [employeeTable, setEmployeeTable] = useState(initialTableState)
  const [userTable, setUserTable] = useState(initialTableState)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [login, setLogin] = useState({ email: '', password: '' })
  const [bootstrapOpen, setBootstrapOpen] = useState(false)
  const [bootstrap, setBootstrap] = useState({ name: '', email: '', password: '' })
  const [companyDialog, setCompanyDialog] = useState<{ open: boolean; item?: Company }>({
    open: false,
  })
  const [employeeDialog, setEmployeeDialog] = useState<{ open: boolean; item?: Employee }>({
    open: false,
  })
  const [userDialog, setUserDialog] = useState<{ open: boolean; item?: SystemUser }>({
    open: false,
  })
  const [companyForm, setCompanyForm] = useState(emptyCompany)
  const [employeeForm, setEmployeeForm] = useState(emptyEmployee)
  const [userForm, setUserForm] = useState(emptyUser)

  const canManageCompanies = user?.role === 'ADMIN'
  const canManageEmployees = user?.role === 'ADMIN' || user?.role === 'SST'
  const canDeleteEmployees = user?.role === 'ADMIN'
  const canViewUsers = user?.role === 'ADMIN' || user?.role === 'SST'
  const canManageUsers = user?.role === 'ADMIN'

  const visibleCompanies = companies
  const visibleEmployees = employees
  const visibleUsers = users
  const selectedTitle =
    view === 'dashboard'
      ? 'Dashboard'
      : view === 'companies'
        ? 'Empresas'
        : view === 'employees'
          ? 'Empleados'
          : 'Usuarios'

  const stats = useMemo(
    () => [
      {
        label: 'Empresas activas',
        value: dashboardSummary.companiesCount,
        icon: <Business />,
      },
      {
        label: 'Empleados activos',
        value: dashboardSummary.employeesCount,
        icon: <People />,
      },
      {
        label: 'Riesgos criticos',
        value: dashboardSummary.criticalRisks,
        icon: <WarningAmber />,
      },
      {
        label: 'Incidentes abiertos',
        value: dashboardSummary.openIncidents,
        icon: <ReportProblem />,
      },
      {
        label: 'Capacitaciones vencidas',
        value: dashboardSummary.overdueTrainings,
        icon: <School />,
      },
      {
        label: 'Rol de sesion',
        value: user?.role ?? '-',
        icon: <Security />,
      },
      {
        label: 'Usuarios activos',
        value: dashboardSummary.usersCount,
        icon: <ManageAccounts />,
      },
      {
        label: 'Registros activos',
        value: `${dashboardSummary.activeRate}%`,
        icon: <SpaceDashboard />,
      },
    ],
    [dashboardSummary, user?.role],
  )

  useEffect(() => {
    api.defaults.headers.common.Authorization = token ? `Bearer ${token}` : undefined
    if (token) {
      void loadData()
    }
  }, [token, companyTable, employeeTable, userTable])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const companyRequest =
        user?.role === 'ADMIN'
          ? api.get<Paginated<Company>>('/companies', {
              params: tableParams(companyTable),
            })
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
      const summaryRequest = api.get<DashboardSummary>('/dashboard/summary')
      const [companyResponse, employeeResponse, userResponse, summaryResponse] = await Promise.all([
        companyRequest,
        employeeRequest,
        userRequest,
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
      setEmployees(employeeResponse.data.data)
      setEmployeeMeta(employeeResponse.data.meta)
      setUsers(userResponse.data.data)
      setUserMeta(userResponse.data.meta)
      setDashboardSummary(summaryResponse.data)
    } catch (currentError) {
      setError(readError(currentError))
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin() {
    setLoading(true)
    setError('')
    try {
      const response = await api.post('/auth/login', login)
      localStorage.setItem('sgsst_token', response.data.accessToken)
      localStorage.setItem('sgsst_user', JSON.stringify(response.data.user))
      setToken(response.data.accessToken)
      setUser(response.data.user)
    } catch (currentError) {
      setError(readError(currentError))
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
      setError(readError(currentError))
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    localStorage.removeItem('sgsst_token')
    localStorage.removeItem('sgsst_user')
    setToken('')
    setUser(null)
    setCompanies([])
    setEmployees([])
    setUsers([])
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
  }

  async function saveCompany() {
    setLoading(true)
    setError('')
    try {
      if (companyDialog.item) {
        await api.patch(`/companies/${companyDialog.item.id}`, sanitize(companyForm))
      } else {
        await api.post('/companies', sanitize(companyForm))
      }
      setCompanyDialog({ open: false })
      await loadData()
    } catch (currentError) {
      setError(readError(currentError))
    } finally {
      setLoading(false)
    }
  }

  async function saveEmployee() {
    setLoading(true)
    setError('')
    try {
      if (employeeDialog.item) {
        await api.patch(`/employees/${employeeDialog.item.id}`, sanitize(employeeForm))
      } else {
        await api.post('/employees', sanitize(employeeForm))
      }
      setEmployeeDialog({ open: false })
      await loadData()
    } catch (currentError) {
      setError(readError(currentError))
    } finally {
      setLoading(false)
    }
  }

  async function saveUser() {
    setLoading(true)
    setError('')
    try {
      const payload = sanitize(userForm)
      if (userDialog.item) {
        const { password: _password, ...updatePayload } = payload
        await api.patch(`/users/${userDialog.item.id}`, updatePayload)
      } else {
        await api.post('/users', payload)
      }
      setUserDialog({ open: false })
      await loadData()
    } catch (currentError) {
      setError(readError(currentError))
    } finally {
      setLoading(false)
    }
  }

  async function removeCompany(id: string) {
    setLoading(true)
    setError('')
    try {
      await api.delete(`/companies/${id}`)
      await loadData()
    } catch (currentError) {
      setError(readError(currentError))
    } finally {
      setLoading(false)
    }
  }

  async function restoreCompany(id: string) {
    setLoading(true)
    setError('')
    try {
      await api.patch(`/companies/${id}`, { isActive: true })
      await loadData()
    } catch (currentError) {
      setError(readError(currentError))
    } finally {
      setLoading(false)
    }
  }

  async function removeEmployee(id: string) {
    setLoading(true)
    setError('')
    try {
      await api.delete(`/employees/${id}`)
      await loadData()
    } catch (currentError) {
      setError(readError(currentError))
    } finally {
      setLoading(false)
    }
  }

  async function restoreEmployee(id: string) {
    setLoading(true)
    setError('')
    try {
      await api.patch(`/employees/${id}`, { isActive: true })
      await loadData()
    } catch (currentError) {
      setError(readError(currentError))
    } finally {
      setLoading(false)
    }
  }

  async function removeUser(id: string) {
    setLoading(true)
    setError('')
    try {
      await api.delete(`/users/${id}`)
      await loadData()
    } catch (currentError) {
      setError(readError(currentError))
    } finally {
      setLoading(false)
    }
  }

  async function restoreUser(id: string) {
    setLoading(true)
    setError('')
    try {
      await api.patch(`/users/${id}`, { isActive: true })
      await loadData()
    } catch (currentError) {
      setError(readError(currentError))
    } finally {
      setLoading(false)
    }
  }

  if (!user || !token) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box className="login-page">
          <Paper className="login-panel" variant="outlined">
            <Stack spacing={2.5}>
              <Box className="login-brand">
                <Box className="brand-mark">
                  <HealthAndSafety />
                </Box>
                <Box>
                  <Typography variant="h5">SG-SST ERP</Typography>
                  <Typography color="text.secondary">Ingreso seguro con JWT y roles</Typography>
                </Box>
              </Box>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                label="Correo"
                type="email"
                value={login.email}
                onChange={(event) => setLogin({ ...login, email: event.target.value })}
              />
              <TextField
                label="Contrasena"
                type="password"
                value={login.password}
                onChange={(event) => setLogin({ ...login, password: event.target.value })}
              />
              <Button
                variant="contained"
                size="large"
                onClick={handleLogin}
                disabled={loading || !login.email || !login.password}
              >
                Iniciar sesion
              </Button>
              <Button onClick={() => setBootstrapOpen(true)}>
                Crear primer administrador
              </Button>
            </Stack>
          </Paper>
          <BootstrapDialog
            open={bootstrapOpen}
            values={bootstrap}
            loading={loading}
            onChange={setBootstrap}
            onClose={() => setBootstrapOpen(false)}
            onSave={handleBootstrap}
          />
        </Box>
      </ThemeProvider>
    )
  }

  const drawer = (
    <Box className="sidebar">
      <Box className="brand-block">
        <Box className="brand-mark">
          <HealthAndSafety fontSize="small" />
        </Box>
        <Box>
          <Typography variant="h6">SG-SST ERP</Typography>
          <Typography variant="caption" color="text.secondary">
            Seguridad y salud en el trabajo
          </Typography>
        </Box>
      </Box>
      <Divider />
      <Box className="nav-scroll">
        <Button
          fullWidth
          startIcon={<SpaceDashboard />}
          className={view === 'dashboard' ? 'nav-item active' : 'nav-item'}
          onClick={() => selectView('dashboard')}
        >
          Dashboard
        </Button>
        <Button
          fullWidth
          startIcon={<Business />}
          className={view === 'companies' ? 'nav-item active' : 'nav-item'}
          onClick={() => selectView('companies')}
        >
          Empresas
        </Button>
        <Button
          fullWidth
          startIcon={<People />}
          className={view === 'employees' ? 'nav-item active' : 'nav-item'}
          onClick={() => selectView('employees')}
        >
          Empleados
        </Button>
        {canViewUsers && (
          <Button
            fullWidth
            startIcon={<ManageAccounts />}
            className={view === 'users' ? 'nav-item active' : 'nav-item'}
            onClick={() => selectView('users')}
          >
            Usuarios
          </Button>
        )}
      </Box>
      <Paper variant="outlined" className="session-card">
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar className="user-avatar">{initials(user.name)}</Avatar>
          <Box>
            <Typography variant="subtitle2">{user.name}</Typography>
            <Chip size="small" label={user.role} color="primary" variant="outlined" />
          </Box>
        </Stack>
        <Button startIcon={<Logout />} fullWidth sx={{ mt: 2 }} onClick={logout}>
          Cerrar sesion
        </Button>
      </Paper>
    </Box>
  )

  function selectView(nextView: View) {
    setView(nextView)
    setMobileOpen(false)
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box className="app-shell">
        <AppBar position="fixed" className="topbar">
          <Toolbar>
            <IconButton edge="start" onClick={() => setMobileOpen(true)} className="mobile-menu">
              <Menu />
            </IconButton>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6">{selectedTitle}</Typography>
              <Typography variant="caption" color="text.secondary">
                {user.email} · {user.role}
              </Typography>
            </Box>
            <Tooltip title="Recargar datos">
              <IconButton onClick={loadData}>
                <Refresh />
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>
        <Box component="nav">
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            sx={{ display: { xs: 'block', lg: 'none' }, '& .MuiDrawer-paper': { width: drawerWidth } }}
          >
            {drawer}
          </Drawer>
          <Drawer
            variant="permanent"
            open
            sx={{ display: { xs: 'none', lg: 'block' }, '& .MuiDrawer-paper': { width: drawerWidth } }}
          >
            {drawer}
          </Drawer>
        </Box>
        <Box component="main" className="content">
          <Toolbar />
          <Stack spacing={2}>
            {loading && <LinearProgress />}
            {error && <Alert severity="error">{error}</Alert>}
            {view === 'dashboard' && <DashboardView stats={stats} companies={companies} employees={employees} />}
            {view === 'companies' && (
              <CompaniesView
                companies={visibleCompanies}
                meta={companyMeta}
                tableState={companyTable}
                canManage={canManageCompanies}
                onTableChange={setCompanyTable}
                onCreate={() => openCompanyForm()}
                onEdit={openCompanyForm}
                onDelete={removeCompany}
                onRestore={restoreCompany}
              />
            )}
            {view === 'employees' && (
              <EmployeesView
                employees={visibleEmployees}
                meta={employeeMeta}
                tableState={employeeTable}
                canManage={canManageEmployees}
                canDelete={canDeleteEmployees}
                onTableChange={setEmployeeTable}
                onCreate={() => openEmployeeForm()}
                onEdit={openEmployeeForm}
                onDelete={removeEmployee}
                onRestore={restoreEmployee}
              />
            )}
            {view === 'users' && (
              <UsersView
                users={visibleUsers}
                meta={userMeta}
                tableState={userTable}
                canManage={canManageUsers}
                currentUserId={user.id}
                onTableChange={setUserTable}
                onCreate={() => openUserForm()}
                onEdit={openUserForm}
                onDelete={removeUser}
                onRestore={restoreUser}
              />
            )}
          </Stack>
        </Box>
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
      </Box>
    </ThemeProvider>
  )
}

function DashboardView({
  stats,
  companies,
  employees,
}: {
  stats: Array<{ label: string; value: string | number; icon: React.ReactNode }>
  companies: Company[]
  employees: Employee[]
}) {
  return (
    <>
      <Grid container spacing={2}>
        {stats.map((stat) => (
          <Grid key={stat.label} size={{ xs: 12, md: 4 }}>
            <Paper className="kpi-card" variant="outlined">
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="text.secondary">{stat.label}</Typography>
                  <Typography variant="h5">{stat.value}</Typography>
                </Box>
                <Box className="kpi-icon">{stat.icon}</Box>
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper className="panel" variant="outlined">
            <Typography variant="h6">Ultimas empresas</Typography>
            <Stack spacing={1.2} sx={{ mt: 2 }}>
              {companies.slice(0, 5).map((company) => (
                <Stack key={company.id} direction="row" justifyContent="space-between">
                  <Typography fontWeight={700}>{company.name}</Typography>
                  <Typography color="text.secondary">{company.nit}</Typography>
                </Stack>
              ))}
              {companies.length === 0 && <Typography color="text.secondary">Sin empresas registradas.</Typography>}
            </Stack>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper className="panel" variant="outlined">
            <Typography variant="h6">Ultimos empleados</Typography>
            <Stack spacing={1.2} sx={{ mt: 2 }}>
              {employees.slice(0, 5).map((employee) => (
                <Stack key={employee.id} direction="row" justifyContent="space-between">
                  <Typography fontWeight={700}>
                    {employee.firstName} {employee.lastName}
                  </Typography>
                  <Typography color="text.secondary">{employee.position}</Typography>
                </Stack>
              ))}
              {employees.length === 0 && <Typography color="text.secondary">Sin empleados registrados.</Typography>}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </>
  )
}

function CompaniesView(props: {
  companies: Company[]
  meta: PageMeta
  tableState: TableState
  canManage: boolean
  onTableChange: (state: TableState) => void
  onCreate: () => void
  onEdit: (item: Company) => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
}) {
  return (
    <Paper className="panel" variant="outlined">
      <TableHeader title="CRUD Empresas" canCreate={props.canManage} onCreate={props.onCreate} />
      <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar por empresa, NIT o correo" />
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Empresa</TableCell>
              <TableCell>NIT</TableCell>
              <TableCell>ARL / Riesgo</TableCell>
              <TableCell>Ciudad</TableCell>
              <TableCell>Contacto</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.companies.map((company) => (
              <TableRow key={company.id} hover>
                <TableCell>{company.name}</TableCell>
                <TableCell>{company.nit}</TableCell>
                <TableCell>
                  {company.arl || '-'} / {riskClassLabels[company.riskClass]}
                </TableCell>
                <TableCell>{[company.city, company.department].filter(Boolean).join(', ') || '-'}</TableCell>
                <TableCell>{company.email || company.phone || '-'}</TableCell>
                <TableCell>
                  <ActiveChip active={company.isActive} />
                </TableCell>
                <TableCell align="right">
                  <IconButton disabled={!props.canManage} onClick={() => props.onEdit(company)}>
                    <Edit />
                  </IconButton>
                  {company.isActive ? (
                    <IconButton disabled={!props.canManage} color="error" onClick={() => props.onDelete(company.id)}>
                      <Delete />
                    </IconButton>
                  ) : (
                    <IconButton disabled={!props.canManage} color="success" onClick={() => props.onRestore(company.id)}>
                      <RestoreFromTrash />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Pager meta={props.meta} state={props.tableState} onChange={props.onTableChange} />
    </Paper>
  )
}

function EmployeesView(props: {
  employees: Employee[]
  meta: PageMeta
  tableState: TableState
  canManage: boolean
  canDelete: boolean
  onTableChange: (state: TableState) => void
  onCreate: () => void
  onEdit: (item: Employee) => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
}) {
  return (
    <Paper className="panel" variant="outlined">
      <TableHeader title="CRUD Empleados" canCreate={props.canManage} onCreate={props.onCreate} />
      <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar por nombre, documento, cargo o correo" />
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Empleado</TableCell>
              <TableCell>Documento</TableCell>
              <TableCell>Cargo</TableCell>
              <TableCell>Contrato</TableCell>
              <TableCell>Centro</TableCell>
              <TableCell>Empresa</TableCell>
              <TableCell>Contacto</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.employees.map((employee) => (
              <TableRow key={employee.id} hover>
                <TableCell>
                  {employee.firstName} {employee.lastName}
                </TableCell>
                <TableCell>
                  {employee.documentType} {employee.document}
                </TableCell>
                <TableCell>{employee.position}</TableCell>
                <TableCell>{contractTypeLabels[employee.contractType]}</TableCell>
                <TableCell>{employee.workCenter || '-'}</TableCell>
                <TableCell>{employee.company?.name ?? '-'}</TableCell>
                <TableCell>{employee.email || employee.phone || '-'}</TableCell>
                <TableCell>
                  <ActiveChip active={employee.isActive} />
                </TableCell>
                <TableCell align="right">
                  <IconButton disabled={!props.canManage} onClick={() => props.onEdit(employee)}>
                    <Edit />
                  </IconButton>
                  {employee.isActive ? (
                    <IconButton disabled={!props.canDelete} color="error" onClick={() => props.onDelete(employee.id)}>
                      <Delete />
                    </IconButton>
                  ) : (
                    <IconButton disabled={!props.canManage} color="success" onClick={() => props.onRestore(employee.id)}>
                      <RestoreFromTrash />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Pager meta={props.meta} state={props.tableState} onChange={props.onTableChange} />
    </Paper>
  )
}

function UsersView(props: {
  users: SystemUser[]
  meta: PageMeta
  tableState: TableState
  canManage: boolean
  currentUserId: string
  onTableChange: (state: TableState) => void
  onCreate: () => void
  onEdit: (item: SystemUser) => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
}) {
  return (
    <Paper className="panel" variant="outlined">
      <TableHeader title="CRUD Usuarios" canCreate={props.canManage} onCreate={props.onCreate} />
      <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar por nombre o correo" />
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Usuario</TableCell>
              <TableCell>Correo</TableCell>
              <TableCell>Rol</TableCell>
              <TableCell>Empresa</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.users.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.email}</TableCell>
                <TableCell>
                  <Chip size="small" label={item.role} color="primary" variant="outlined" />
                </TableCell>
                <TableCell>{item.company?.name ?? '-'}</TableCell>
                <TableCell>
                  <ActiveChip active={item.isActive} />
                </TableCell>
                <TableCell align="right">
                  <IconButton disabled={!props.canManage} onClick={() => props.onEdit(item)}>
                    <Edit />
                  </IconButton>
                  {item.isActive ? (
                    <IconButton
                      disabled={!props.canManage || item.id === props.currentUserId}
                      color="error"
                      onClick={() => props.onDelete(item.id)}
                    >
                      <Delete />
                    </IconButton>
                  ) : (
                    <IconButton
                      disabled={!props.canManage}
                      color="success"
                      onClick={() => props.onRestore(item.id)}
                    >
                      <RestoreFromTrash />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Pager meta={props.meta} state={props.tableState} onChange={props.onTableChange} />
    </Paper>
  )
}

function TableHeader({
  title,
  canCreate,
  onCreate,
}: {
  title: string
  canCreate: boolean
  onCreate: () => void
}) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
      <Box>
        <Typography variant="h6">{title}</Typography>
        <Typography color="text.secondary">Operaciones protegidas por JWT y permisos de rol.</Typography>
      </Box>
      <Button startIcon={<Add />} variant="contained" disabled={!canCreate} onClick={onCreate}>
        Nuevo
      </Button>
    </Stack>
  )
}

function TableControls({
  state,
  onChange,
  placeholder,
}: {
  state: TableState
  onChange: (state: TableState) => void
  placeholder: string
}) {
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
      <TextField
        size="small"
        placeholder={placeholder}
        value={state.search}
        onChange={(event) => onChange({ ...state, page: 1, search: event.target.value })}
        sx={{ minWidth: { md: 320 } }}
      />
      <TextField
        select
        size="small"
        label="Estado"
        value={state.isActive}
        onChange={(event) =>
          onChange({
            ...state,
            page: 1,
            isActive: event.target.value as TableState['isActive'],
          })
        }
        sx={{ minWidth: 160 }}
      >
        <MenuItem value="all">Todos</MenuItem>
        <MenuItem value="active">Activos</MenuItem>
        <MenuItem value="inactive">Inactivos</MenuItem>
      </TextField>
    </Stack>
  )
}

function Pager({
  meta,
  state,
  onChange,
}: {
  meta: PageMeta
  state: TableState
  onChange: (state: TableState) => void
}) {
  return (
    <TablePagination
      component="div"
      count={meta.total}
      page={Math.max(0, state.page - 1)}
      rowsPerPage={state.pageSize}
      rowsPerPageOptions={[5, 10, 25, 50]}
      labelRowsPerPage="Filas"
      onPageChange={(_, page) => onChange({ ...state, page: page + 1 })}
      onRowsPerPageChange={(event) =>
        onChange({ ...state, page: 1, pageSize: Number(event.target.value) })
      }
    />
  )
}

function ActiveChip({ active }: { active: boolean }) {
  return (
    <Chip
      size="small"
      label={active ? 'Activo' : 'Inactivo'}
      color={active ? 'success' : 'default'}
      variant={active ? 'filled' : 'outlined'}
    />
  )
}

function CompanyDialog(props: {
  open: boolean
  editing: boolean
  values: typeof emptyCompany
  loading: boolean
  onChange: (values: typeof emptyCompany) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Editar empresa' : 'Nueva empresa'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Razon social"
            value={props.values.name}
            onChange={(event) => props.onChange({ ...props.values, name: event.target.value })}
            required
          />
          <TextField
            label="NIT"
            value={props.values.nit}
            helperText="Formato: 900123456-7, sin puntos"
            onChange={(event) => props.onChange({ ...props.values, nit: event.target.value })}
            required
          />
          <TextField
            label="ARL"
            value={props.values.arl}
            onChange={(event) => props.onChange({ ...props.values, arl: event.target.value })}
          />
          <TextField
            select
            label="Clase de riesgo"
            value={props.values.riskClass}
            onChange={(event) =>
              props.onChange({ ...props.values, riskClass: event.target.value as CompanyRiskClass })
            }
          >
            {riskClassOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {riskClassLabels[option]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Actividad economica"
            value={props.values.economicActivity}
            onChange={(event) =>
              props.onChange({ ...props.values, economicActivity: event.target.value })
            }
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label="Ciudad"
              value={props.values.city}
              onChange={(event) => props.onChange({ ...props.values, city: event.target.value })}
            />
            <TextField
              fullWidth
              label="Departamento"
              value={props.values.department}
              onChange={(event) =>
                props.onChange({ ...props.values, department: event.target.value })
              }
            />
          </Stack>
          <TextField
            label="Direccion"
            value={props.values.address}
            onChange={(event) => props.onChange({ ...props.values, address: event.target.value })}
          />
          <TextField
            label="Telefono"
            value={props.values.phone}
            onChange={(event) => props.onChange({ ...props.values, phone: event.target.value })}
          />
          <TextField
            label="Correo"
            type="email"
            value={props.values.email}
            onChange={(event) => props.onChange({ ...props.values, email: event.target.value })}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button variant="contained" disabled={props.loading || !props.values.name || !props.values.nit} onClick={props.onSave}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function EmployeeDialog(props: {
  open: boolean
  editing: boolean
  values: typeof emptyEmployee
  companies: Company[]
  loading: boolean
  canPickCompany: boolean
  onChange: (values: typeof emptyEmployee) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Editar empleado' : 'Nuevo empleado'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Nombres" value={props.values.firstName} onChange={(event) => props.onChange({ ...props.values, firstName: event.target.value })} required />
          <TextField label="Apellidos" value={props.values.lastName} onChange={(event) => props.onChange({ ...props.values, lastName: event.target.value })} required />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select
              fullWidth
              label="Tipo documento"
              value={props.values.documentType}
              onChange={(event) =>
                props.onChange({ ...props.values, documentType: event.target.value as DocumentType })
              }
              required
            >
              {documentTypeOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {documentTypeLabels[option]}
                </MenuItem>
              ))}
            </TextField>
            <TextField fullWidth label="Documento" value={props.values.document} onChange={(event) => props.onChange({ ...props.values, document: event.target.value })} required />
          </Stack>
          <TextField label="Cargo" value={props.values.position} onChange={(event) => props.onChange({ ...props.values, position: event.target.value })} required />
          <TextField label="Centro de trabajo" value={props.values.workCenter} onChange={(event) => props.onChange({ ...props.values, workCenter: event.target.value })} />
          <TextField
            select
            label="Tipo de contrato"
            value={props.values.contractType}
            onChange={(event) =>
              props.onChange({ ...props.values, contractType: event.target.value as ContractType })
            }
          >
            {contractTypeOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {contractTypeLabels[option]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Estado laboral"
            value={props.values.employmentStatus}
            onChange={(event) =>
              props.onChange({
                ...props.values,
                employmentStatus: event.target.value as EmploymentStatus,
              })
            }
          >
            {employmentStatusOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {employmentStatusLabels[option]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="date"
            label="Fecha de ingreso"
            InputLabelProps={{ shrink: true }}
            value={props.values.hireDate}
            onChange={(event) => props.onChange({ ...props.values, hireDate: event.target.value })}
          />
          <TextField select label="Empresa" value={props.values.companyId} disabled={!props.canPickCompany} onChange={(event) => props.onChange({ ...props.values, companyId: event.target.value })} required>
            {props.companies.map((company) => (
              <MenuItem key={company.id} value={company.id}>
                {company.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="Correo" value={props.values.email} onChange={(event) => props.onChange({ ...props.values, email: event.target.value })} />
          <TextField label="Telefono" value={props.values.phone} onChange={(event) => props.onChange({ ...props.values, phone: event.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={
            props.loading ||
            !props.values.firstName ||
            !props.values.lastName ||
            !props.values.document ||
            !props.values.position ||
            !props.values.companyId
          }
          onClick={props.onSave}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function UserDialog(props: {
  open: boolean
  editing: boolean
  values: typeof emptyUser
  companies: Company[]
  loading: boolean
  onChange: (values: typeof emptyUser) => void
  onClose: () => void
  onSave: () => void
}) {
  const needsCompany = props.values.role !== 'ADMIN'

  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Nombre"
            value={props.values.name}
            onChange={(event) => props.onChange({ ...props.values, name: event.target.value })}
            required
          />
          <TextField
            label="Correo"
            type="email"
            value={props.values.email}
            onChange={(event) => props.onChange({ ...props.values, email: event.target.value })}
            required
          />
          {!props.editing && (
            <TextField
              label="Contrasena"
              type="password"
              value={props.values.password}
              onChange={(event) =>
                props.onChange({ ...props.values, password: event.target.value })
              }
              helperText="Minimo 8 caracteres"
              required
            />
          )}
          <TextField
            select
            label="Rol"
            value={props.values.role}
            onChange={(event) =>
              props.onChange({
                ...props.values,
                role: event.target.value as Role,
                companyId: event.target.value === 'ADMIN' ? '' : props.values.companyId,
              })
            }
            required
          >
            {(['ADMIN', 'SST', 'EMPLOYEE', 'AUDITOR'] as Role[]).map((role) => (
              <MenuItem key={role} value={role}>
                {role}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Empresa"
            value={props.values.companyId}
            disabled={!needsCompany}
            onChange={(event) => props.onChange({ ...props.values, companyId: event.target.value })}
            required={needsCompany}
          >
            {props.companies.map((company) => (
              <MenuItem key={company.id} value={company.id}>
                {company.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={
            props.loading ||
            !props.values.name ||
            !props.values.email ||
            (!props.editing && props.values.password.length < 8) ||
            (needsCompany && !props.values.companyId)
          }
          onClick={props.onSave}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function BootstrapDialog(props: {
  open: boolean
  values: { name: string; email: string; password: string }
  loading: boolean
  onChange: (values: { name: string; email: string; password: string }) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Primer administrador</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Nombre" value={props.values.name} onChange={(event) => props.onChange({ ...props.values, name: event.target.value })} />
          <TextField label="Correo" type="email" value={props.values.email} onChange={(event) => props.onChange({ ...props.values, email: event.target.value })} />
          <TextField label="Contrasena" type="password" value={props.values.password} onChange={(event) => props.onChange({ ...props.values, password: event.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button variant="contained" disabled={props.loading || props.values.password.length < 8 || !props.values.email || !props.values.name} onClick={props.onSave}>
          Crear ADMIN
        </Button>
      </DialogActions>
    </Dialog>
  )
}

const riskClassOptions: CompanyRiskClass[] = [
  'CLASS_I',
  'CLASS_II',
  'CLASS_III',
  'CLASS_IV',
  'CLASS_V',
]
const riskClassLabels: Record<CompanyRiskClass, string> = {
  CLASS_I: 'I - Riesgo minimo',
  CLASS_II: 'II - Riesgo bajo',
  CLASS_III: 'III - Riesgo medio',
  CLASS_IV: 'IV - Riesgo alto',
  CLASS_V: 'V - Riesgo maximo',
}
const documentTypeOptions: DocumentType[] = ['CC', 'CE', 'TI', 'PASSPORT', 'NIT']
const documentTypeLabels: Record<DocumentType, string> = {
  CC: 'Cedula de ciudadania',
  CE: 'Cedula de extranjeria',
  TI: 'Tarjeta de identidad',
  PASSPORT: 'Pasaporte',
  NIT: 'NIT',
}
const contractTypeOptions: ContractType[] = [
  'INDEFINITE',
  'FIXED_TERM',
  'SERVICE',
  'APPRENTICESHIP',
  'TEMPORARY',
]
const contractTypeLabels: Record<ContractType, string> = {
  INDEFINITE: 'Indefinido',
  FIXED_TERM: 'Termino fijo',
  SERVICE: 'Prestacion de servicios',
  APPRENTICESHIP: 'Aprendizaje',
  TEMPORARY: 'Temporal',
}
const employmentStatusOptions: EmploymentStatus[] = ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'RETIRED']
const employmentStatusLabels: Record<EmploymentStatus, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  ON_LEAVE: 'Licencia',
  RETIRED: 'Retirado',
}

function tableParams(state: TableState) {
  return {
    page: state.page,
    pageSize: state.pageSize,
    search: state.search || undefined,
    isActive:
      state.isActive === 'all' ? undefined : state.isActive === 'active' ? true : false,
  }
}

function isPaginated<T>(value: unknown): value is Paginated<T> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'data' in value &&
      'meta' in value &&
      Array.isArray((value as Paginated<T>).data),
  )
}

function sanitize<T extends Record<string, string>>(values: T) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value.trim() || undefined]),
  )
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function readError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message
    return Array.isArray(message) ? message.join(', ') : message || error.message
  }
  return 'Ocurrio un error inesperado'
}

export default App
