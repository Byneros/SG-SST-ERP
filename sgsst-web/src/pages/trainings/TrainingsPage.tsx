import { useEffect, useState } from 'react'
import { Delete, Edit, Group, WarningAmber } from '@mui/icons-material'
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem,
  Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import { ModuleAssistantButton } from '../../components/ModuleAssistantButton'
import { ActiveCompanyBanner, ActiveSiteFilterChip, Pager, TableControls, TableHeader, ViewBreadcrumb } from '../../components/TablePieces'
import { api, readApiError } from '../../api/client'
import { isPaginated } from '../../utils'
import type {
  PageMeta, Site, TableState, Training, TrainingAttendee, TrainingAttendeeStatus, TrainingExpirations, View,
} from '../../types'

const ATTENDEE_STATUS_OPTIONS: TrainingAttendeeStatus[] = ['ATTENDED', 'PASSED', 'FAILED']
const STATUS_LABELS: Record<TrainingAttendeeStatus, string> = {
  ATTENDED: 'Asistió', PASSED: 'Aprobó', FAILED: 'Reprobó',
}
const STATUS_COLORS: Record<TrainingAttendeeStatus, 'default' | 'success' | 'error'> = {
  ATTENDED: 'default', PASSED: 'success', FAILED: 'error',
}

/** Panel de vencimientos de certificados (#58): autocontenida porque el
 *  backend restringe el dashboard a ADMIN/SST/AUDITOR (el EMPLOYEE ve la
 *  tabla sin el panel; el 403 se degrada a oculto). */
function ExpirationsPanel({ days }: { days?: number }) {
  const [data, setData] = useState<TrainingExpirations | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    api
      .get<TrainingExpirations>('/trainings/expirations', { params: days ? { days } : undefined })
      .then((response) => setData(response.data))
      .catch(() => setHidden(true)) // EMPLOYEE: sin permiso para el dashboard
  }, [days])

  if (hidden || !data) return null
  const { expired, expiringSoon } = data.summary
  if (expired + expiringSoon === 0) return null

  return (
    <Alert severity={expired > 0 ? 'warning' : 'info'} icon={<WarningAmber />} sx={{ mb: 2 }}>
      <Typography variant="body2">
        {expired > 0 && ` ${expired} certificado(s) vencido(s).`} {expiringSoon > 0 && ` ${expiringSoon} vence(n) en ${data.windowDays} días.`}
      </Typography>
      {data.items.slice(0, 5).map((item) => (
        <Typography key={item.id} variant="caption" display="block">
          {item.name} · {item.training.title} → {item.expiresAt?.slice(0, 10) ?? '-'}
        </Typography>
      ))}
      {data.items.length > 5 && <Typography variant="caption">+ {data.items.length - 5} más…</Typography>}
    </Alert>
  )
}

/** Dialog de asistentes de una capacitación (#58). */
function AttendeesDialog(props: {
  training: Training | null
  canManage: boolean
  canUseEmployees: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const [attendees, setAttendees] = useState<TrainingAttendee[]>([])
  const [error, setError] = useState('')
  const [employees, setEmployees] = useState<Array<{ id: string; firstName: string; lastName: string }>>([])
  const employeeOptions = employees.filter((e) => e && typeof e.id === 'string')
  const [employeeId, setEmployeeId] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<TrainingAttendeeStatus>('ATTENDED')
  const [score, setScore] = useState('')
  const [saving, setSaving] = useState(false)
  const open = !!props.training

  useEffect(() => {
    if (!open || !props.training) return
    setError('')
    api
      .get<Training>(`/trainings/${props.training.id}`)
      .then((response) => setAttendees(response.data.attendees ?? []))
      .catch((err) => setError(readApiError(err)))
    if (props.canUseEmployees) {
      api
        .get('/employees', { params: { pageSize: 100 } })
        .then((response) => {
          const payload = isPaginated<{ id: string; firstName: string; lastName: string }>(response.data)
            ? response.data.data
            : Array.isArray(response.data)
              ? response.data
              : []
          setEmployees(payload)
        })
        .catch(() => setEmployees([]))
    }
  }, [open, props.training?.id, props.canUseEmployees])

  async function refresh() {
    if (!props.training) return
    const response = await api.get<Training>(`/trainings/${props.training.id}`)
    setAttendees(response.data.attendees ?? [])
    props.onChanged()
  }

  async function addAttendee() {
    if (!props.training) return
    setSaving(true)
    setError('')
    try {
      const body: Record<string, unknown> = { status }
      if (employeeId) body.employeeId = employeeId
      else {
        if (!name.trim()) {
          setError('Escribe el nombre del asistente externo o elige un trabajador.')
          setSaving(false)
          return
        }
        body.name = name.trim()
      }
      if (score !== '') body.score = Number(score)
      await api.post(`/trainings/${props.training.id}/attendees`, body)
      setEmployeeId('')
      setName('')
      setScore('')
      await refresh()
    } catch (err) {
      setError(readApiError(err))
    } finally {
      setSaving(false)
    }
  }

  async function patchAttendee(id: string, body: Record<string, unknown>) {
    setError('')
    try {
      await api.patch(`/trainings/attendees/${id}`, body)
      await refresh()
    } catch (err) {
      setError(readApiError(err))
    }
  }

  async function removeAttendee(id: string) {
    setError('')
    try {
      await api.delete(`/trainings/attendees/${id}`)
      await refresh()
    } catch (err) {
      setError(readApiError(err))
    }
  }

  return (
    <Dialog open={open} onClose={props.onClose} maxWidth="md" fullWidth>
      <DialogTitle>Asistentes — {props.training?.title}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Asistente</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Nota</TableCell>
                <TableCell>Vence</TableCell>
                <TableCell>Evidencia</TableCell>
                {props.canManage && <TableCell align="right">Acciones</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {attendees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={props.canManage ? 6 : 5}>
                    <Typography variant="body2" color="text.secondary">Sin asistentes registrados.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {attendees.map((attendee) => (
                <TableRow key={attendee.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">{attendee.name}</Typography>
                      {attendee.employee && (
                        <Typography variant="caption" color="text.secondary">CC {attendee.employee.document}</Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {props.canManage ? (
                      <TextField
                        select size="small" value={attendee.status} sx={{ minWidth: 130 }}
                        onChange={(event) => void patchAttendee(attendee.id, { status: event.target.value })}
                      >
                        {ATTENDEE_STATUS_OPTIONS.map((s) => (
                          <MenuItem key={s} value={s}>{STATUS_LABELS[s]}</MenuItem>
                        ))}
                      </TextField>
                    ) : (
                      <Chip size="small" label={STATUS_LABELS[attendee.status]} color={STATUS_COLORS[attendee.status]} variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell>{attendee.score ?? '-'}</TableCell>
                  <TableCell>{attendee.expiresAt?.slice(0, 10) ?? '-'}</TableCell>
                  <TableCell>
                    {attendee.evidence ? (
                      <Chip size="small" label={attendee.evidence.name} variant="outlined" />
                    ) : (
                      <Typography variant="caption" color="text.secondary">Sin evidencia</Typography>
                    )}
                  </TableCell>
                  {props.canManage && (
                    <TableCell align="right">
                      <IconButton size="small" color="error" title="Quitar asistente" onClick={() => void removeAttendee(attendee.id)}>
                        <Delete />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {props.canManage && props.training && (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mt: 2 }} alignItems={{ md: 'flex-start' }}>
            <Typography variant="subtitle2" sx={{ minWidth: 90, pt: 1 }}>Nuevo asistente</Typography>
            {props.canUseEmployees && (
              <TextField select size="small" label="Trabajador" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} sx={{ minWidth: 220 }}>
                <MenuItem value="">— Externo (por nombre) —</MenuItem>
                {employeeOptions.map((employee) => (
                  <MenuItem key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <TextField size="small" label="Nombre (externo)" value={name} disabled={!!employeeId} onChange={(event) => setName(event.target.value)} sx={{ minWidth: 200 }} />
            <TextField select size="small" label="Estado" value={status} onChange={(event) => setStatus(event.target.value as TrainingAttendeeStatus)} sx={{ minWidth: 120 }}>
              {ATTENDEE_STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{STATUS_LABELS[s]}</MenuItem>)}
            </TextField>
            <TextField size="small" label="Nota (evaluación)" value={score} onChange={(event) => setScore(event.target.value)} sx={{ maxWidth: 140 }} />
            <Button variant="contained" startIcon={<Group />} disabled={saving} onClick={() => void addAttendee()}>
              Añadir
            </Button>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}

export function TrainingsPage(props: {
  trainings: Training[]
  meta: PageMeta
  tableState: TableState
  canManage: boolean
  canUseEmployees: boolean
  sites: Site[]
  siteFilter: string
  onSiteFilterChange: (siteId: string) => void
  onTableChange: (state: TableState) => void
  onCreate: () => void
  onPreloadCreate?: () => void
  onEdit: (item: Training) => void
  onDelete: (id: string) => void
  onOpenAssistant?: (view: View, assistantId: string) => void
  activeCompanyName?: string
}) {
  const [attendeesFor, setAttendeesFor] = useState<Training | null>(null)

  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <ViewBreadcrumb view="Capacitaciones" />
      <TableHeader
        title="Capacitaciones"
        canCreate={props.canManage}
        onCreate={props.onCreate}
        onPreloadCreate={props.onPreloadCreate}
        assistant={props.onOpenAssistant && <ModuleAssistantButton assistantId="trainings" onOpen={props.onOpenAssistant} />}
      />
      {props.siteFilter !== 'all' && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <ActiveSiteFilterChip
            siteName={props.sites.find((site) => site.id === props.siteFilter)?.name ?? (props.siteFilter === 'none' ? 'Sin sede asignada' : props.siteFilter)}
            onClear={() => props.onSiteFilterChange('all')}
          />
        </Stack>
      )}
      <ExpirationsPanel />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          select
          size="small"
          label="Sede"
          value={props.siteFilter}
          onChange={(event) => props.onSiteFilterChange(event.target.value)}
          sx={{ minWidth: 240 }}
        >
          <MenuItem value="all">Todas las sedes</MenuItem>
          {props.sites.map((site) => (
            <MenuItem key={site.id} value={site.id}>
              {site.code ? `${site.name} (${site.code})` : site.name}
            </MenuItem>
          ))}
          <MenuItem value="none">Sin sede asignada</MenuItem>
        </TextField>
      </Stack>
      <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar por titulo o descripcion" />
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Capacitacion</TableCell>
              <TableCell>Empresa</TableCell>
              <TableCell>Instructor</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell>Asistentes</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.trainings.map((training) => (
              <TableRow key={training.id} hover>
                <TableCell>
                  <Box>
                    <Typography variant="body2">{training.title}</Typography>
                    {training.validityMonths ? (
                      <Typography variant="caption" color="text.secondary">Certificado vigente {training.validityMonths} meses</Typography>
                    ) : null}
                  </Box>
                </TableCell>
                <TableCell>{training.company?.name ?? '-'}</TableCell>
                <TableCell>{training.instructor ?? '-'}</TableCell>
                <TableCell>{training.date.slice(0, 10)}</TableCell>
                <TableCell>
                  <IconButton size="small" title="Asistentes" onClick={() => setAttendeesFor(training)}>
                    <Group fontSize="small" />
                  </IconButton>
                  <Typography variant="caption" sx={{ ml: 0.5 }}>
                    {training.attendees?.length ?? 0}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <IconButton disabled={!props.canManage} title="Asistentes" onClick={() => setAttendeesFor(training)}>
                    <Group />
                  </IconButton>
                  <IconButton disabled={!props.canManage} onClick={() => props.onEdit(training)}>
                    <Edit />
                  </IconButton>
                  <IconButton disabled={!props.canManage} color="error" onClick={() => props.onDelete(training.id)}>
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Pager meta={props.meta} state={props.tableState} onChange={props.onTableChange} />
      <AttendeesDialog
        training={attendeesFor}
        canManage={props.canManage}
        canUseEmployees={props.canUseEmployees}
        onClose={() => setAttendeesFor(null)}
        onChanged={() => props.onTableChange({ ...props.tableState })}
      />
    </Paper>
  )
}
