import { useState } from 'react'
import { Delete, Edit, TaskAlt } from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { ActiveCompanyBanner, Pager, TableControls, TableHeader } from '../../components/TablePieces'
import type {
  Company,
  Finding,
  PageMeta,
  SystemUser,
  TableState,
  Task,
  TaskPriority,
  TaskSourceType,
  TaskStatus,
} from '../../types'

const statusLabel: Record<TaskStatus, string> = {
  OPEN: 'Abierta',
  IN_PROGRESS: 'En gestión',
  DONE: 'Hecha',
  CANCELLED: 'Cancelada',
}

const statusColor: Record<TaskStatus, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  OPEN: 'default',
  IN_PROGRESS: 'info',
  DONE: 'success',
  CANCELLED: 'error',
}

const priorityLabel: Record<TaskPriority, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
}

const priorityColor: Record<TaskPriority, 'default' | 'warning' | 'error'> = {
  LOW: 'default',
  MEDIUM: 'default',
  HIGH: 'warning',
  CRITICAL: 'error',
}

const sourceLabel: Record<TaskSourceType, string> = {
  FINDING: 'Hallazgo',
  ACTION_PLAN: 'Acción',
  CHANGE_REQUEST: 'Cambio',
  MANUAL: 'Manual',
}

export type TaskDialogValues = {
  title: string
  description: string
  sourceType: TaskSourceType
  sourceId: string
  ownerId: string
  dueDate: string
  priority: TaskPriority
  companyId: string
}

function daysUntil(dueDate?: string | null): number | null {
  if (!dueDate) return null
  return Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000)
}

function dueChip(task: Task) {
  const days = daysUntil(task.dueDate)
  const done = task.status === 'DONE' || task.status === 'CANCELLED'
  if (done || days === null) return null
  if (days < 0) return <Chip size="small" color="error" label={`Vencida ${Math.abs(days)}d`} />
  if (days <= 7) return <Chip size="small" color="warning" label={`Vence en ${days}d`} />
  return null
}

export function TasksPage(props: {
  tasks: Task[]
  meta: PageMeta
  tableState: TableState
  users: SystemUser[]
  findings: Finding[]
  companies: Company[]
  canManage: boolean
  activeCompanyId?: string | null
  activeCompanyName?: string
  onTableChange: (state: TableState) => void
  onCreate: () => void
  onPreloadCreate?: () => void
  onEdit: (item: Task) => void
  onDelete: (item: Task) => void
  onOpenDetail: (item: Task) => void
  onQuickStatus: (item: Task, status: 'IN_PROGRESS' | 'DONE') => void
  onPreloadDetail?: () => void
}) {
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all')
  const [onlyOverdue, setOnlyOverdue] = useState(false)

  const visible = props.tasks.filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false
    if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false
    if (onlyOverdue) {
      const days = daysUntil(item.dueDate)
      const active = item.status === 'OPEN' || item.status === 'IN_PROGRESS'
      if (!(active && days !== null && days < 0)) return false
    }
    return true
  })

  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <TableHeader title="Tareas" canCreate={props.canManage} onCreate={props.onCreate} onPreloadCreate={props.onPreloadCreate} />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar por título o descripción" />
        </Box>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            color={onlyOverdue ? 'error' : 'default'}
            variant={onlyOverdue ? 'filled' : 'outlined'}
            label="Solo vencidas"
            onClick={() => setOnlyOverdue((current) => !current)}
          />
        </Stack>
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <TextField
          select
          size="small"
          label="Estado"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as 'all' | TaskStatus)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="all">Todo estado</MenuItem>
          {(Object.keys(statusLabel) as TaskStatus[]).map((status) => (
            <MenuItem key={status} value={status}>{statusLabel[status]}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Prioridad"
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value as 'all' | TaskPriority)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="all">Toda prioridad</MenuItem>
          {(Object.keys(priorityLabel) as TaskPriority[]).map((priority) => (
            <MenuItem key={priority} value={priority}>{priorityLabel[priority]}</MenuItem>
          ))}
        </TextField>
      </Stack>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Tarea</TableCell>
              <TableCell>Origen</TableCell>
              <TableCell>Responsable</TableCell>
              <TableCell>Vence</TableCell>
              <TableCell>Prioridad</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((task) => (
              <TableRow key={task.id} hover>
                <TableCell>
                  <Stack>
                    <Typography
                      fontWeight={700}
                      sx={{ cursor: 'pointer' }}
                      onClick={() => props.onOpenDetail(task)}
                    >
                      {task.title}
                    </Typography>
                    {task.description && (
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 320 }}>
                        {task.description}
                      </Typography>
                    )}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Chip size="small" variant="outlined" label={sourceLabel[task.sourceType]} />
                </TableCell>
                <TableCell>{task.owner?.name ?? 'Sin asignar'}</TableCell>
                <TableCell>
                  <Stack spacing={0.5}>
                    <Typography variant="body2">{task.dueDate?.slice(0, 10) ?? 'Sin fecha'}</Typography>
                    {dueChip(task)}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Chip size="small" color={priorityColor[task.priority]} label={priorityLabel[task.priority]} />
                </TableCell>
                <TableCell>
                  <Chip size="small" color={statusColor[task.status]} label={statusLabel[task.status]} />
                </TableCell>
                <TableCell align="right">
                  {props.canManage && (
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      {(task.status === 'OPEN' || task.status === 'IN_PROGRESS') && (
                        <>
                          {task.status === 'OPEN' && (
                            <Button size="small" onClick={() => props.onQuickStatus(task, 'IN_PROGRESS')}>
                              Iniciar
                            </Button>
                          )}
                          <Button size="small" color="success" onClick={() => props.onQuickStatus(task, 'DONE')}>
                            Completar
                          </Button>
                        </>
                      )}
                      <IconButton size="small" aria-label="editar" onClick={() => props.onEdit(task)}>
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton size="small" aria-label="eliminar" onClick={() => props.onDelete(task)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Stack>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
                    No hay tareas que coincidan con los filtros.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Pager meta={props.meta} state={props.tableState} onChange={props.onTableChange} />
    </Paper>
  )
}

export function TaskDialog(props: {
  open: boolean
  item: Task | null
  users: SystemUser[]
  findings: Finding[]
  companies: Company[]
  activeCompanyId?: string | null
  onClose: () => void
  onSave: () => void
  onChange: (values: TaskDialogValues) => void
  values: TaskDialogValues
}) {
  const isEdit = Boolean(props.item)
  const set = <K extends keyof TaskDialogValues>(key: K, value: TaskDialogValues[K]) =>
    props.onChange({ ...props.values, [key]: value })

  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle>{isEdit ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Título"
            value={props.values.title}
            onChange={(event) => set('title', event.target.value)}
            fullWidth
            required
          />
          <TextField
            label="Descripción"
            value={props.values.description}
            onChange={(event) => set('description', event.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select
              label="Origen"
              value={props.values.sourceType}
              onChange={(event) => set('sourceType', event.target.value as TaskSourceType)}
              fullWidth
              disabled={isEdit}
            >
              <MenuItem value="MANUAL">Manual</MenuItem>
              <MenuItem value="FINDING">Hallazgo</MenuItem>
              <MenuItem value="ACTION_PLAN">Acción</MenuItem>
              <MenuItem value="CHANGE_REQUEST">Cambio</MenuItem>
            </TextField>
            {props.values.sourceType === 'FINDING' && (
              <TextField
                select
                label="Hallazgo"
                value={props.values.sourceId}
                onChange={(event) => set('sourceId', event.target.value)}
                fullWidth
                disabled={isEdit}
              >
                <MenuItem value="">Sin hallazgo</MenuItem>
                {props.findings.map((finding) => (
                  <MenuItem key={finding.id} value={finding.id}>
                    {finding.title}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select
              label="Responsable"
              value={props.values.ownerId}
              onChange={(event) => set('ownerId', event.target.value)}
              fullWidth
            >
              <MenuItem value="">Sin asignar</MenuItem>
              {props.users.map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  {user.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Prioridad"
              value={props.values.priority}
              onChange={(event) => set('priority', event.target.value as TaskPriority)}
              fullWidth
            >
              {(Object.keys(priorityLabel) as TaskPriority[]).map((priority) => (
                <MenuItem key={priority} value={priority}>{priorityLabel[priority]}</MenuItem>
              ))}
            </TextField>
          </Stack>
          <TextField
            label="Vencimiento"
            type="date"
            value={props.values.dueDate}
            onChange={(event) => set('dueDate', event.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          {!props.activeCompanyId && props.companies.length > 0 && (
            <TextField
              select
              label="Empresa"
              value={props.values.companyId}
              onChange={(event) => set('companyId', event.target.value)}
              fullWidth
            >
              {props.companies.map((company) => (
                <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>
              ))}
            </TextField>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button variant="contained" onClick={props.onSave} disabled={props.values.title.trim().length < 3}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function TaskDetailDialog(props: {
  detail: Task | null
  detailSaving: boolean
  error?: string
  canManage: boolean
  onClose: () => void
  onSetStatus: (status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED') => void
  onAddComment: (body: string) => void
  onRemoveComment: (commentId: string) => void
}) {
  const [comment, setComment] = useState('')

  if (!props.detail) return null
  const closed = props.detail.status === 'DONE' || props.detail.status === 'CANCELLED'

  return (
    <Dialog open={Boolean(props.detail)} onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle>{props.detail.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {props.error && <Alert severity="error">{props.error}</Alert>}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" color={statusColor[props.detail.status]} label={statusLabel[props.detail.status]} />
            <Chip size="small" color={priorityColor[props.detail.priority]} label={priorityLabel[props.detail.priority]} />
            <Chip size="small" variant="outlined" label={`Origen: ${sourceLabel[props.detail.sourceType]}`} />
            {dueChip(props.detail)}
          </Stack>
          {props.detail.description && (
            <Typography variant="body2">{props.detail.description}</Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            Responsable: {props.detail.owner?.name ?? 'Sin asignar'}
            {props.detail.dueDate ? ` · Vence: ${props.detail.dueDate.slice(0, 10)}` : ' · Sin fecha'}
          </Typography>
          {props.canManage && !closed && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {props.detail.status === 'OPEN' && (
                <Button size="small" onClick={() => props.onSetStatus('IN_PROGRESS')}>
                  Iniciar gestión
                </Button>
              )}
              {props.detail.status === 'IN_PROGRESS' && (
                <Button size="small" onClick={() => props.onSetStatus('OPEN')}>
                  Volver a abierta
                </Button>
              )}
              <Button size="small" color="success" onClick={() => props.onSetStatus('DONE')}>
                Completar
              </Button>
              <Button size="small" color="error" onClick={() => props.onSetStatus('CANCELLED')}>
                Cancelar tarea
              </Button>
            </Stack>
          )}
          <Typography variant="subtitle2">Comentarios</Typography>
          <Stack spacing={1}>
            {(props.detail.comments ?? []).map((taskComment) => (
              <Stack key={taskComment.id} direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {taskComment.author?.name ?? 'Usuario'} · {taskComment.createdAt.slice(0, 16).replace('T', ' ')}
                  </Typography>
                  <Typography variant="body2">{taskComment.body}</Typography>
                </Box>
                <IconButton size="small" aria-label="eliminar comentario" onClick={() => props.onRemoveComment(taskComment.id)}>
                  <Delete fontSize="small" />
                </IconButton>
              </Stack>
            ))}
            {(props.detail.comments ?? []).length === 0 && (
              <Typography variant="body2" color="text.secondary">Sin comentarios.</Typography>
            )}
          </Stack>
          {!closed && (
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <TextField
                label="Agregar comentario"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                size="small"
                fullWidth
                multiline
              />
              <Button
                variant="contained"
                disabled={comment.trim().length < 2 || props.detailSaving}
                onClick={() => {
                  props.onAddComment(comment.trim())
                  setComment('')
                }}
              >
                Comentar
              </Button>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button startIcon={<TaskAlt />} onClick={props.onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}
