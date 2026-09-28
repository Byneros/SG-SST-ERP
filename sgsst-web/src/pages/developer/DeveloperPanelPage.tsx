import { BugReport, Refresh } from '@mui/icons-material'
import { Alert, AlertTitle, Button, Chip, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import type { DeveloperPanelData } from '../../types'

/**
 * Panel tecnico de plataforma (rol DEVELOPER). Refleja UNICAMENTE datos que
 * entrega el backend (/developer/*): health real, flags de configuracion y
 * audit log. No inventa metricas ni expone secretos.
 */
export function DeveloperPanelPage(props: {
  data: DeveloperPanelData
  loading: boolean
  onRefresh: () => void
}) {
  const { overview, modules, queues, audit, diagnostics, errors } = props.data
  const dependencyColor = (value?: 'ok' | 'error') =>
    value === 'ok' ? 'success' : value === 'error' ? 'error' : 'default'

  return (
    <Paper className="panel" variant="outlined">
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <BugReport color="primary" />
          <Stack>
            <Typography variant="h6">Panel de desarrollador</Typography>
            <Typography color="text.secondary">
              Estado técnico de la plataforma (sin datos de empresas).
            </Typography>
          </Stack>
        </Stack>
        <Button startIcon={<Refresh />} variant="contained" disabled={props.loading} onClick={props.onRefresh}>
          Actualizar
        </Button>
      </Stack>

      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography variant="subtitle2">Estado de la aplicación</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              label={`API: ${overview ? overview.status : 'sin datos'}`}
              color={overview ? 'success' : 'default'}
              variant="outlined"
            />
            <Chip
              size="small"
              label={`PostgreSQL: ${overview?.dependencies.database ?? 'desconocido'}`}
              color={dependencyColor(overview?.dependencies.database)}
              variant="outlined"
            />
            <Chip
              size="small"
              label={`Redis: ${overview?.dependencies.redis ?? 'desconocido'}`}
              color={dependencyColor(overview?.dependencies.redis)}
              variant="outlined"
            />
            {overview && (
              <Chip size="small" label={`Entorno: ${overview.environment}`} variant="outlined" />
            )}
          </Stack>
        </Stack>

        {queues && (
          <Stack spacing={1}>
            <Typography variant="subtitle2">Colas de trabajo (BullMQ)</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                label={`notifications: ${queues.notifications.enabled ? 'activa' : 'apagada'} · worker ${queues.notifications.worker ? 'on' : 'off'} · cron ${queues.notifications.cron}`}
                color={queues.notifications.enabled ? 'primary' : 'default'}
                variant="outlined"
              />
              <Chip
                size="small"
                label={`reports: ${queues.reports.enabled ? 'activa' : 'apagada'} · worker ${queues.reports.worker ? 'on' : 'off'}`}
                color={queues.reports.enabled ? 'primary' : 'default'}
                variant="outlined"
              />
            </Stack>
          </Stack>
        )}

        {modules && (
          <Stack spacing={1}>
            <Typography variant="subtitle2">Módulos del sistema</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {modules.modules.map((module) => (
                <Chip
                  key={module.name}
                  size="small"
                  label={module.detail ? `${module.name} (${module.detail})` : module.name}
                  color={module.enabled ? 'primary' : 'default'}
                  variant={module.enabled ? 'filled' : 'outlined'}
                />
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Plataforma: {modules.platform.companies} empresas · {modules.platform.users} usuarios ·{' '}
              {modules.platform.auditLogs} registros de auditoría · entorno {modules.platform.environment}
            </Typography>
          </Stack>
        )}

        {diagnostics && (
          <Stack spacing={1}>
            <Typography variant="subtitle2">Diagnóstico</Typography>
            <Typography variant="body2" color="text.secondary">
              Empresas activas {diagnostics.companies.active}/{diagnostics.companies.total} · usuarios activos{' '}
              {diagnostics.users.active}/{diagnostics.users.total} · cuentas DEVELOPER:{' '}
              {diagnostics.users.developers} · base de datos {diagnostics.database}
            </Typography>
          </Stack>
        )}

        <Stack spacing={1}>
          <Typography variant="subtitle2">Actividad administrativa reciente</Typography>
          {audit.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Sin registros de auditoría todavía.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Acción</TableCell>
                    <TableCell>Entidad</TableCell>
                    <TableCell>Actor</TableCell>
                    <TableCell>Rol</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {audit.map((entry) => (
                    <TableRow key={entry.id} hover>
                      <TableCell>{new Date(entry.createdAt).toLocaleString()}</TableCell>
                      <TableCell>{entry.action}</TableCell>
                      <TableCell>
                        {entry.entity}
                        {entry.entityId ? ` (${entry.entityId.slice(0, 8)}…)` : ''}
                      </TableCell>
                      <TableCell>{entry.actor?.email ?? 'sistema'}</TableCell>
                      <TableCell>{entry.actor?.role ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>

        {errors && (
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2">Errores técnicos ({errors.total} retenidos)</Typography>
              {errors.data.length === 0 && (
                <Chip size="small" color="success" label="sin eventos" variant="outlined" />
              )}
            </Stack>
            {errors.data.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Sin errores o avisos en el proceso actual. El buffer se reinicia al reiniciar la API.
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Fecha</TableCell>
                      <TableCell>Nivel</TableCell>
                      <TableCell>Contexto</TableCell>
                      <TableCell>Mensaje</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {errors.data.map((event, index) => (
                      <TableRow key={`${event.timestamp}-${index}`} hover>
                        <TableCell>{new Date(event.timestamp).toLocaleString()}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={event.level}
                            color={event.level === 'error' ? 'error' : 'warning'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>{event.context}</TableCell>
                        <TableCell sx={{ maxWidth: 420, wordBreak: 'break-word' }}>
                          {event.message}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Stack>
        )}

        <Alert severity="info" variant="outlined">
          <AlertTitle>Alcance del rol DEVELOPER</AlertTitle>
          Este panel solo muestra estado técnico de la plataforma. No expone
          contenido de negocio de las empresas ni credenciales; las operaciones
          administrativas quedan registradas en el audit log.
        </Alert>
      </Stack>
    </Paper>
  )
}
