import {
  Add,
  Analytics,
  AssignmentTurnedIn,
  Business,
  CalendarMonth,
  CheckCircle,
  Close,
  Dashboard,
  Description,
  FactCheck,
  HealthAndSafety,
  Inventory2,
  Menu,
  Notifications,
  People,
  ReportProblem,
  School,
  Search,
  Security,
  Tune,
  WarningAmber,
} from '@mui/icons-material'
import {
  AppBar,
  Avatar,
  Badge,
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
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ThemeProvider,
  Toolbar,
  Tooltip,
  Typography,
  createTheme,
} from '@mui/material'
import type { SelectChangeEvent } from '@mui/material'
import { useMemo, useState } from 'react'

const drawerWidth = 292

type ModuleKey =
  | 'dashboard'
  | 'companies'
  | 'employees'
  | 'risks'
  | 'documents'
  | 'trainings'
  | 'inspections'
  | 'incidents'
  | 'audits'
  | 'annualPlan'
  | 'indicators'
  | 'settings'

type Status = 'Al dia' | 'En riesgo' | 'Vencido' | 'Abierto' | 'Cerrado'

type WorkItem = {
  id: string
  module: ModuleKey
  title: string
  owner: string
  site: string
  dueDate: string
  status: Status
  priority: 'Baja' | 'Media' | 'Alta' | 'Critica'
  progress: number
}

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1d4f5f', dark: '#143944' },
    secondary: { main: '#6f7d3c' },
    error: { main: '#b42318' },
    warning: { main: '#b76e00' },
    success: { main: '#1f7a4d' },
    background: { default: '#f4f7f8', paper: '#ffffff' },
    text: { primary: '#1d2939', secondary: '#667085' },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h5: { fontWeight: 750, letterSpacing: 0 },
    h6: { fontWeight: 730, letterSpacing: 0 },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
    },
  },
})

const modules: Array<{
  key: ModuleKey
  label: string
  icon: React.ReactNode
  group: string
}> = [
  { key: 'dashboard', label: 'Dashboard', icon: <Dashboard />, group: 'Operacion' },
  { key: 'companies', label: 'Empresas', icon: <Business />, group: 'Operacion' },
  { key: 'employees', label: 'Empleados', icon: <People />, group: 'Operacion' },
  { key: 'risks', label: 'Matriz de riesgos', icon: <WarningAmber />, group: 'SG-SST' },
  { key: 'documents', label: 'Documentos', icon: <Description />, group: 'SG-SST' },
  { key: 'trainings', label: 'Capacitaciones', icon: <School />, group: 'SG-SST' },
  { key: 'inspections', label: 'Inspecciones', icon: <FactCheck />, group: 'SG-SST' },
  { key: 'incidents', label: 'Incidentes', icon: <ReportProblem />, group: 'SG-SST' },
  { key: 'audits', label: 'Auditorias', icon: <AssignmentTurnedIn />, group: 'Control' },
  { key: 'annualPlan', label: 'Plan anual', icon: <CalendarMonth />, group: 'Control' },
  { key: 'indicators', label: 'Indicadores', icon: <Analytics />, group: 'Control' },
  { key: 'settings', label: 'Configuracion', icon: <Security />, group: 'Sistema' },
]

const initialItems: WorkItem[] = [
  {
    id: 'R-1048',
    module: 'risks',
    title: 'Actualizar matriz de peligros de bodega',
    owner: 'Laura Mendez',
    site: 'Bogota - Planta Norte',
    dueDate: '2026-05-18',
    status: 'En riesgo',
    priority: 'Alta',
    progress: 64,
  },
  {
    id: 'CAP-226',
    module: 'trainings',
    title: 'Reinduccion SG-SST personal operativo',
    owner: 'Carlos Rivas',
    site: 'Medellin',
    dueDate: '2026-05-21',
    status: 'Abierto',
    priority: 'Media',
    progress: 42,
  },
  {
    id: 'INC-091',
    module: 'incidents',
    title: 'Investigacion casi accidente montacargas',
    owner: 'Diana Castro',
    site: 'Cali',
    dueDate: '2026-05-09',
    status: 'Vencido',
    priority: 'Critica',
    progress: 28,
  },
  {
    id: 'DOC-318',
    module: 'documents',
    title: 'Aprobacion procedimiento trabajo en caliente',
    owner: 'Andres Gomez',
    site: 'Barranquilla',
    dueDate: '2026-05-30',
    status: 'Al dia',
    priority: 'Media',
    progress: 82,
  },
  {
    id: 'AUD-047',
    module: 'audits',
    title: 'Auditoria interna Resolucion 0312',
    owner: 'Mariana Ruiz',
    site: 'Todas las sedes',
    dueDate: '2026-06-12',
    status: 'Abierto',
    priority: 'Alta',
    progress: 35,
  },
  {
    id: 'INS-662',
    module: 'inspections',
    title: 'Inspeccion mensual de extintores',
    owner: 'Felipe Mora',
    site: 'Bogota - Oficinas',
    dueDate: '2026-05-14',
    status: 'Al dia',
    priority: 'Baja',
    progress: 76,
  },
]

const kpis = [
  { label: 'Cumplimiento plan anual', value: '78%', trend: '+6%', icon: <CalendarMonth />, color: 'primary' },
  { label: 'Riesgos criticos abiertos', value: '12', trend: '-3', icon: <WarningAmber />, color: 'warning' },
  { label: 'Capacitacion cubierta', value: '84%', trend: '+11%', icon: <School />, color: 'success' },
  { label: 'Incidentes en investigacion', value: '7', trend: '+2', icon: <ReportProblem />, color: 'error' },
] as const

const indicatorRows = [
  { name: 'Frecuencia de accidentalidad', value: '2.4', target: '< 3.0', progress: 80 },
  { name: 'Severidad', value: '14 dias', target: '< 20 dias', progress: 70 },
  { name: 'Cierre de acciones', value: '72%', target: '>= 85%', progress: 72 },
  { name: 'Documentos vigentes', value: '91%', target: '>= 95%', progress: 91 },
]

function App() {
  const [selectedModule, setSelectedModule] = useState<ModuleKey>('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [items, setItems] = useState(initialItems)
  const [formOpen, setFormOpen] = useState(false)
  const [formValues, setFormValues] = useState({
    title: '',
    module: 'risks' as ModuleKey,
    owner: '',
    site: '',
    dueDate: '',
    priority: 'Media' as WorkItem['priority'],
  })

  const activeModule = modules.find((moduleItem) => moduleItem.key === selectedModule)

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesModule =
        selectedModule === 'dashboard' ||
        selectedModule === 'indicators' ||
        item.module === selectedModule
      const matchesQuery = `${item.id} ${item.title} ${item.owner} ${item.site}`
        .toLowerCase()
        .includes(query.toLowerCase())
      const matchesStatus = statusFilter === 'Todos' || item.status === statusFilter
      return matchesModule && matchesQuery && matchesStatus
    })
  }, [items, query, selectedModule, statusFilter])

  function handleCreateItem() {
    const nextItem: WorkItem = {
      id: `${formValues.module.toUpperCase().slice(0, 3)}-${Math.floor(Math.random() * 900 + 100)}`,
      title: formValues.title,
      module: formValues.module,
      owner: formValues.owner,
      site: formValues.site,
      dueDate: formValues.dueDate,
      status: 'Abierto',
      priority: formValues.priority,
      progress: 0,
    }
    setItems((current) => [nextItem, ...current])
    setFormOpen(false)
    setFormValues({
      title: '',
      module: selectedModule === 'dashboard' ? 'risks' : selectedModule,
      owner: '',
      site: '',
      dueDate: '',
      priority: 'Media',
    })
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
            Gestion integral de seguridad
          </Typography>
        </Box>
      </Box>

      <Divider />

      <Box className="nav-scroll">
        {['Operacion', 'SG-SST', 'Control', 'Sistema'].map((group) => (
          <Box key={group} className="nav-group">
            <Typography className="nav-group-title">{group}</Typography>
            {modules
              .filter((moduleItem) => moduleItem.group === group)
              .map((moduleItem) => (
                <Button
                  key={moduleItem.key}
                  fullWidth
                  startIcon={moduleItem.icon}
                  className={
                    selectedModule === moduleItem.key ? 'nav-item active' : 'nav-item'
                  }
                  onClick={() => {
                    setSelectedModule(moduleItem.key)
                    setMobileOpen(false)
                  }}
                >
                  {moduleItem.label}
                </Button>
              ))}
          </Box>
        ))}
      </Box>

      <Paper variant="outlined" className="compliance-card">
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Inventory2 color="secondary" />
          <Box>
            <Typography variant="subtitle2">Resolucion 0312</Typography>
            <Typography variant="caption" color="text.secondary">
              Autoevaluacion 2026
            </Typography>
          </Box>
        </Stack>
        <LinearProgress variant="determinate" value={82} sx={{ mt: 2 }} />
        <Typography variant="caption" color="text.secondary">
          82% de estandares soportados
        </Typography>
      </Paper>
    </Box>
  )

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box className="app-shell">
        <AppBar position="fixed" className="topbar">
          <Toolbar>
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setMobileOpen(true)}
              className="mobile-menu"
            >
              <Menu />
            </IconButton>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6">{activeModule?.label}</Typography>
              <Typography variant="caption" color="text.secondary">
                Empresa: Industrias Andinas S.A.S. · Riesgo ARL IV · Periodo 2026
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Tooltip title="Filtros avanzados">
                <IconButton>
                  <Tune />
                </IconButton>
              </Tooltip>
              <Tooltip title="Notificaciones">
                <IconButton>
                  <Badge badgeContent={6} color="error">
                    <Notifications />
                  </Badge>
                </IconButton>
              </Tooltip>
              <Avatar className="user-avatar">LM</Avatar>
            </Stack>
          </Toolbar>
        </AppBar>

        <Box component="nav">
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              display: { xs: 'block', lg: 'none' },
              '& .MuiDrawer-paper': { width: drawerWidth },
            }}
          >
            {drawer}
          </Drawer>
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: 'none', lg: 'block' },
              '& .MuiDrawer-paper': { width: drawerWidth },
            }}
            open
          >
            {drawer}
          </Drawer>
        </Box>

        <Box component="main" className="content">
          <Toolbar />

          <Stack spacing={3}>
            <Grid container spacing={2}>
              {kpis.map((kpi) => (
                <Grid key={kpi.label} size={{ xs: 12, sm: 6, xl: 3 }}>
                  <Paper className="kpi-card" variant="outlined">
                    <Stack direction="row" justifyContent="space-between">
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {kpi.label}
                        </Typography>
                        <Typography variant="h5">{kpi.value}</Typography>
                      </Box>
                      <Box className={`kpi-icon ${kpi.color}`}>{kpi.icon}</Box>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }}>
                      <Chip size="small" label={kpi.trend} color={kpi.color} />
                      <Typography variant="caption" color="text.secondary">
                        frente al mes anterior
                      </Typography>
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, xl: 8 }}>
                <Paper className="panel" variant="outlined">
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={2}
                    justifyContent="space-between"
                    alignItems={{ xs: 'stretch', md: 'center' }}
                  >
                    <Box>
                      <Typography variant="h6">Bandeja operacional</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Seguimiento de actividades, acciones y evidencias por modulo.
                      </Typography>
                    </Box>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                      <TextField
                        size="small"
                        placeholder="Buscar actividad"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Search fontSize="small" />
                            </InputAdornment>
                          ),
                        }}
                      />
                      <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel>Estado</InputLabel>
                        <Select
                          label="Estado"
                          value={statusFilter}
                          onChange={(event: SelectChangeEvent) =>
                            setStatusFilter(event.target.value)
                          }
                        >
                          {['Todos', 'Al dia', 'En riesgo', 'Vencido', 'Abierto', 'Cerrado'].map(
                            (status) => (
                              <MenuItem key={status} value={status}>
                                {status}
                              </MenuItem>
                            ),
                          )}
                        </Select>
                      </FormControl>
                      <Button
                        startIcon={<Add />}
                        variant="contained"
                        onClick={() => setFormOpen(true)}
                      >
                        Nuevo registro
                      </Button>
                    </Stack>
                  </Stack>

                  <TableContainer sx={{ mt: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Codigo</TableCell>
                          <TableCell>Actividad</TableCell>
                          <TableCell>Responsable</TableCell>
                          <TableCell>Sede</TableCell>
                          <TableCell>Vence</TableCell>
                          <TableCell>Prioridad</TableCell>
                          <TableCell>Estado</TableCell>
                          <TableCell>Avance</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredItems.map((item) => (
                          <TableRow key={item.id} hover>
                            <TableCell>
                              <Typography variant="body2" fontWeight={700}>
                                {item.id}
                              </Typography>
                            </TableCell>
                            <TableCell>{item.title}</TableCell>
                            <TableCell>{item.owner}</TableCell>
                            <TableCell>{item.site}</TableCell>
                            <TableCell>{item.dueDate}</TableCell>
                            <TableCell>
                              <PriorityChip priority={item.priority} />
                            </TableCell>
                            <TableCell>
                              <StatusChip status={item.status} />
                            </TableCell>
                            <TableCell sx={{ minWidth: 130 }}>
                              <LinearProgress
                                variant="determinate"
                                value={item.progress}
                                color={item.progress >= 70 ? 'success' : 'warning'}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {item.progress}%
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, xl: 4 }}>
                <Paper className="panel" variant="outlined">
                  <Typography variant="h6">Indicadores criticos</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    KPIs SG-SST con meta y avance del periodo.
                  </Typography>
                  <Stack spacing={2}>
                    {indicatorRows.map((row) => (
                      <Box key={row.name}>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.7 }}>
                          <Typography variant="body2" fontWeight={700}>
                            {row.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {row.value}
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={row.progress}
                          color={row.progress >= 80 ? 'success' : 'warning'}
                        />
                        <Typography variant="caption" color="text.secondary">
                          Meta: {row.target}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Paper>

                <Paper className="panel next-panel" variant="outlined">
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <CheckCircle color="success" />
                    <Box>
                      <Typography variant="subtitle1" fontWeight={750}>
                        Proximo hito
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Revision por la direccion programada para el 28 de mayo.
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          </Stack>
        </Box>

        <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              Crear registro SG-SST
              <IconButton onClick={() => setFormOpen(false)}>
                <Close />
              </IconButton>
            </Stack>
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 0 }}>
              <Grid size={{ xs: 12, md: 8 }}>
                <TextField
                  fullWidth
                  required
                  label="Nombre de la actividad"
                  value={formValues.title}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, title: event.target.value }))
                  }
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel>Modulo</InputLabel>
                  <Select
                    label="Modulo"
                    value={formValues.module}
                    onChange={(event: SelectChangeEvent) =>
                      setFormValues((current) => ({
                        ...current,
                        module: event.target.value as ModuleKey,
                      }))
                    }
                  >
                    {modules
                      .filter((moduleItem) => moduleItem.key !== 'dashboard')
                      .map((moduleItem) => (
                        <MenuItem key={moduleItem.key} value={moduleItem.key}>
                          {moduleItem.label}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  required
                  label="Responsable"
                  value={formValues.owner}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, owner: event.target.value }))
                  }
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  required
                  label="Sede o centro de trabajo"
                  value={formValues.site}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, site: event.target.value }))
                  }
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  required
                  type="date"
                  label="Fecha limite"
                  InputLabelProps={{ shrink: true }}
                  value={formValues.dueDate}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, dueDate: event.target.value }))
                  }
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel>Prioridad</InputLabel>
                  <Select
                    label="Prioridad"
                    value={formValues.priority}
                    onChange={(event: SelectChangeEvent) =>
                      setFormValues((current) => ({
                        ...current,
                        priority: event.target.value as WorkItem['priority'],
                      }))
                    }
                  >
                    {['Baja', 'Media', 'Alta', 'Critica'].map((priority) => (
                      <MenuItem key={priority} value={priority}>
                        {priority}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField fullWidth label="Evidencia requerida" defaultValue="Documento / foto" />
              </Grid>
              <Grid size={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={4}
                  label="Descripcion, criterio legal o requisito SG-SST"
                  placeholder="Describe el hallazgo, actividad, control o evidencia esperada."
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button
              variant="contained"
              onClick={handleCreateItem}
              disabled={
                !formValues.title ||
                !formValues.owner ||
                !formValues.site ||
                !formValues.dueDate
              }
            >
              Guardar registro
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  )
}

function StatusChip({ status }: { status: Status }) {
  const color =
    status === 'Vencido'
      ? 'error'
      : status === 'En riesgo'
        ? 'warning'
        : status === 'Cerrado' || status === 'Al dia'
          ? 'success'
          : 'default'
  return <Chip size="small" label={status} color={color} variant="outlined" />
}

function PriorityChip({ priority }: { priority: WorkItem['priority'] }) {
  const color =
    priority === 'Critica' ? 'error' : priority === 'Alta' ? 'warning' : 'default'
  return <Chip size="small" label={priority} color={color} />
}

export default App
