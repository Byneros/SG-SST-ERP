import { Assessment, AssignmentTurnedIn, BugReport, Business, CalendarMonth, Campaign, ChangeCircle, Checklist, Description, Engineering, FactCheck, ForwardToInbox, Gavel, Groups, Handyman, HealthAndSafety, History, LocalFireDepartment, LocationCity, Logout, ManageAccounts, MedicalInformation, Menu, Notifications, People, Percent, Refresh, ReportProblem, School, SmartToy, SpaceDashboard, Tour, Troubleshoot, WarningAmber } from '@mui/icons-material'
import { Alert, AppBar, Avatar, Badge, Box, Button, Chip, Divider, Drawer, FormControl, IconButton, LinearProgress, List, ListItemButton, ListItemText, Menu as MuiMenu, MenuItem, Paper, Select, Stack, Toolbar, Tooltip, Typography } from '@mui/material'
import { useState, type ReactNode } from 'react'
import type { AppNotification, AuthUser, Company, View } from '../types'
import { initials } from '../utils'

const drawerWidth = 284

export function AppLayout({
  user,
  companies,
  activeCompanyId,
  view,
  selectedTitle,
  mobileOpen,
  loading,
  error,
  canViewUsers,
  canViewCommittees,
  canViewEmergency,
  canViewChangeRequests,
  canViewFindings,
  canViewContractors,
  canViewSites,
  canViewDocuments,
  canViewAnnualPlans,
  canViewInspections,
  canViewUnsafeReports,
  canViewMedical,
  canViewReports,
  canViewAudit,
  isDeveloper,
  canRetryDeliveries,
  canGenerateNotifications,
  canUseAssistant,
  notifications,
  notificationUnread,
  children,
  onMobileOpen,
  onMobileClose,
  onSelectView,
  onPreloadView,
  onRefresh,
  onSwitchCompany,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onGenerateNotifications,
  onChangePassword,
  onMfaSettings,
  onLogout,
}: {
  user: AuthUser
  companies: Company[]
  activeCompanyId?: string
  view: View
  selectedTitle: string
  mobileOpen: boolean
  loading: boolean
  error: string
  canViewUsers: boolean
  canViewCommittees: boolean
  canViewEmergency: boolean
  canViewChangeRequests: boolean
  canViewFindings: boolean
  canViewContractors: boolean
  canViewSites: boolean
  canViewDocuments: boolean
  canViewAnnualPlans: boolean
  canViewInspections: boolean
  canViewUnsafeReports: boolean
  canViewMedical: boolean
  canViewReports: boolean
  canViewAudit: boolean
  isDeveloper: boolean
  canRetryDeliveries?: boolean
  canGenerateNotifications: boolean
  canUseAssistant: boolean
  notifications: AppNotification[]
  notificationUnread: number
  children: ReactNode
  onMobileOpen: () => void
  onMobileClose: () => void
  onSelectView: (view: View) => void
  onPreloadView: (view: View) => void
  onRefresh: () => void
  onSwitchCompany: (companyId: string | null) => void
  onMarkNotificationRead: (id: string) => void
  onMarkAllNotificationsRead: () => void
  onGenerateNotifications: () => void
  onChangePassword: () => void
  onMfaSettings: () => void
  onLogout: () => void
}) {
  const [notificationAnchor, setNotificationAnchor] = useState<HTMLElement | null>(null)
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
        <NavButton active={view === 'dashboard'} icon={<SpaceDashboard />} label="Dashboard" onClick={() => onSelectView('dashboard')} onPreload={() => onPreloadView('dashboard')} />
        {canUseAssistant && <NavButton active={view === 'aiAssistant'} icon={<SmartToy />} label="Asistente IA" onClick={() => onSelectView('aiAssistant')} onPreload={() => onPreloadView('aiAssistant')} />}
        <NavButton active={view === 'companies'} icon={<Business />} label="Empresas" onClick={() => onSelectView('companies')} onPreload={() => onPreloadView('companies')} />
        {canViewCommittees && <NavButton active={view === 'committees'} icon={<Groups />} label="Comités" onClick={() => onSelectView('committees')} onPreload={() => onPreloadView('committees')} />}
        {canViewEmergency && <NavButton active={view === 'emergency'} icon={<LocalFireDepartment />} label="Emergencias" onClick={() => onSelectView('emergency')} onPreload={() => onPreloadView('emergency')} />}
        {canViewChangeRequests && <NavButton active={view === 'changeRequests'} icon={<ChangeCircle />} label="Gestión del cambio" onClick={() => onSelectView('changeRequests')} onPreload={() => onPreloadView('changeRequests')} />}
        {canViewFindings && <NavButton active={view === 'findings'} icon={<Troubleshoot />} label="Hallazgos" onClick={() => onSelectView('findings')} onPreload={() => onPreloadView('findings')} />}
        {canViewContractors && <NavButton active={view === 'contractors'} icon={<Handyman />} label="Contratistas" onClick={() => onSelectView('contractors')} onPreload={() => onPreloadView('contractors')} />}
        {canViewSites && <NavButton active={view === 'sites'} icon={<LocationCity />} label="Sedes" onClick={() => onSelectView('sites')} onPreload={() => onPreloadView('sites')} />}
        <NavButton active={view === 'employees'} icon={<People />} label="Empleados" onClick={() => onSelectView('employees')} onPreload={() => onPreloadView('employees')} />
        <NavButton active={view === 'incidents'} icon={<ReportProblem />} label="Incidentes" onClick={() => onSelectView('incidents')} onPreload={() => onPreloadView('incidents')} />
        <NavButton active={view === 'risks'} icon={<WarningAmber />} label="Riesgos" onClick={() => onSelectView('risks')} onPreload={() => onPreloadView('risks')} />
        <NavButton active={view === 'trainings'} icon={<School />} label="Capacitaciones" onClick={() => onSelectView('trainings')} onPreload={() => onPreloadView('trainings')} />
        {canViewDocuments && <NavButton active={view === 'documents'} icon={<Description />} label="Documentos" onClick={() => onSelectView('documents')} onPreload={() => onPreloadView('documents')} />}
        {canViewDocuments && <NavButton active={view === 'sgsstAudits'} icon={<AssignmentTurnedIn />} label="Auditorias SG-SST" onClick={() => onSelectView('sgsstAudits')} onPreload={() => onPreloadView('sgsstAudits')} />}
        {canViewDocuments && <NavButton active={view === 'sgsstEvaluations'} icon={<FactCheck />} label="Evaluacion Res. 0312" onClick={() => onSelectView('sgsstEvaluations')} onPreload={() => onPreloadView('sgsstEvaluations')} />}
        {canViewDocuments && <NavButton active={view === 'indicators'} icon={<Percent />} label="Indicadores" onClick={() => onSelectView('indicators')} onPreload={() => onPreloadView('indicators')} />}
        {canViewDocuments && <NavButton active={view === 'legalCompliance'} icon={<Gavel />} label="Mapa normativo" onClick={() => onSelectView('legalCompliance')} onPreload={() => onPreloadView('legalCompliance')} />}
        {canViewAnnualPlans && <NavButton active={view === 'annualWorkPlans'} icon={<CalendarMonth />} label="Plan Anual" onClick={() => onSelectView('annualWorkPlans')} onPreload={() => onPreloadView('annualWorkPlans')} />}
        {canViewInspections && <NavButton active={view === 'plannedInspections'} icon={<Checklist />} label="Inspecciones planeadas" onClick={() => onSelectView('plannedInspections')} onPreload={() => onPreloadView('plannedInspections')} />}
        {canViewInspections && <NavButton active={view === 'unplannedInspections'} icon={<Tour />} label="Inspecciones no planeadas" onClick={() => onSelectView('unplannedInspections')} onPreload={() => onPreloadView('unplannedInspections')} />}
        {canViewUnsafeReports && <NavButton active={view === 'unsafeReports'} icon={<Campaign />} label="Actos y condiciones" onClick={() => onSelectView('unsafeReports')} onPreload={() => onPreloadView('unsafeReports')} />}
        {canViewInspections && <NavButton active={view === 'ppe'} icon={<Engineering />} label="EPP" onClick={() => onSelectView('ppe')} onPreload={() => onPreloadView('ppe')} />}
        {canViewMedical && <NavButton active={view === 'medical'} icon={<MedicalInformation />} label="Medicina laboral" onClick={() => onSelectView('medical')} onPreload={() => onPreloadView('medical')} />}
        {canRetryDeliveries && <NavButton active={view === 'externalDeliveries'} icon={<ForwardToInbox />} label="Entregas externas" onClick={() => onSelectView('externalDeliveries')} onPreload={() => onPreloadView('externalDeliveries')} />}
        {canViewReports && <NavButton active={view === 'reports'} icon={<Assessment />} label="Mis reportes" onClick={() => onSelectView('reports')} onPreload={() => onPreloadView('reports')} />}
        {canViewUsers && <NavButton active={view === 'users'} icon={<ManageAccounts />} label="Usuarios" onClick={() => onSelectView('users')} onPreload={() => onPreloadView('users')} />}
        {canViewAudit && <NavButton active={view === 'audit'} icon={<History />} label="Auditoria" onClick={() => onSelectView('audit')} onPreload={() => onPreloadView('audit')} />}
        {isDeveloper && <NavButton active={view === 'developer'} icon={<BugReport />} label="Panel de desarrollador" onClick={() => onSelectView('developer')} onPreload={() => onPreloadView('developer')} />}
      </Box>
      <Paper variant="outlined" className="session-card">
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar className="user-avatar">{initials(user.name)}</Avatar>
          <Box>
            <Typography variant="subtitle2">{user.name}</Typography>
            <Chip size="small" label={user.role} color="primary" variant="outlined" />
          </Box>
        </Stack>
        <Button startIcon={<Logout />} fullWidth sx={{ mt: 2 }} onClick={onLogout}>
          Cerrar sesion
        </Button>
        <Button fullWidth sx={{ mt: 1 }} onClick={onChangePassword}>
          Cambiar contrasena
        </Button>
        <Button fullWidth sx={{ mt: 1 }} onClick={onMfaSettings}>
          MFA {user.mfaEnabled ? 'activo' : 'inactivo'}
        </Button>
      </Paper>
    </Box>
  )

  return (
    <Box className="app-shell">
      <AppBar position="fixed" className="topbar">
        <Toolbar>
          <IconButton edge="start" onClick={onMobileOpen} className="mobile-menu">
            <Menu />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6">{selectedTitle}</Typography>
            <Typography variant="caption" color="text.secondary">
              {user.email} - {user.role}
            </Typography>
          </Box>
          <FormControl size="small" sx={{ minWidth: 220, mr: 1 }}>
            <Select
              value={activeCompanyId ?? ''}
              onChange={(event) => onSwitchCompany(event.target.value || null)}
              displayEmpty
              disabled={companies.length === 0}
              renderValue={(value) => {
                if (!value) {
                  return 'Sin empresa activa'
                }
                const selectedCompany = companies.find((company) => company.id === value)
                return selectedCompany ? `Empresa: ${selectedCompany.name}` : 'Empresa: seleccionada'
              }}
            >
              <MenuItem value="">
                <em>Sin empresa activa</em>
              </MenuItem>
              {companies.map((company) => (
                <MenuItem key={company.id} value={company.id}>
                  {company.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Tooltip title="Recargar datos">
            <IconButton onClick={onRefresh}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <Tooltip title="Notificaciones">
            <IconButton onClick={(event) => setNotificationAnchor(event.currentTarget)}>
              <Badge badgeContent={notificationUnread} color="error">
                <Notifications />
              </Badge>
            </IconButton>
          </Tooltip>
          <MuiMenu
            anchorEl={notificationAnchor}
            open={Boolean(notificationAnchor)}
            onClose={() => setNotificationAnchor(null)}
            PaperProps={{ sx: { width: 360, maxWidth: 'calc(100vw - 24px)' } }}
          >
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="subtitle2">Notificaciones</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button size="small" onClick={onMarkAllNotificationsRead}>Marcar leidas</Button>
                {canGenerateNotifications && <Button size="small" onClick={onGenerateNotifications}>Generar alertas</Button>}
              </Stack>
            </Box>
            <Divider />
            <List dense disablePadding>
              {notifications.length === 0 ? (
                <ListItemButton disabled>
                  <ListItemText primary="Sin notificaciones" />
                </ListItemButton>
              ) : (
                notifications.map((notification) => (
                  <ListItemButton key={notification.id} selected={!notification.read} onClick={() => onMarkNotificationRead(notification.id)}>
                    <ListItemText
                      primary={notification.title}
                      secondary={`${notification.message} · ${notification.priority}`}
                    />
                  </ListItemButton>
                ))
              )}
            </List>
          </MuiMenu>
        </Toolbar>
      </AppBar>
      <Box component="nav">
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={onMobileClose}
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
          {children}
        </Stack>
      </Box>
    </Box>
  )
}

function NavButton({
  active,
  icon,
  label,
  onClick,
  onPreload,
}: {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
  onPreload: () => void
}) {
  return (
    <Button
      fullWidth
      startIcon={icon}
      className={active ? 'nav-item active' : 'nav-item'}
      onClick={onClick}
      onFocus={onPreload}
      onMouseEnter={onPreload}
    >
      {label}
    </Button>
  )
}
